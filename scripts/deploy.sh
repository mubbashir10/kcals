#!/usr/bin/env bash
#
# Provision Neon + deploy to Vercel in one go.
#
# Prereqs (one-time):
#   brew install neonctl
#   npm i -g vercel
#   neonctl auth          # opens browser
#   vercel login          # opens browser
#
# Required env vars (set them before running, or pass via prompts):
#   USDA_API_KEY          your FoodData Central key
#
# Re-running is safe: existing Neon project / Vercel link is reused.

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────────────
PROJECT_NAME="${PROJECT_NAME:-kcals}"
NEON_BRANCH="${NEON_BRANCH:-main}"
NEON_ROLE="${NEON_ROLE:-neondb_owner}"
NEON_DATABASE="${NEON_DATABASE:-neondb}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
step()   { printf "\n\033[1;36m→ %s\033[0m\n" "$*"; }

require() {
  command -v "$1" >/dev/null 2>&1 || {
    red "Missing CLI: $1"
    red "Install it and re-run: $2"
    exit 1
  }
}

# ──────────────────────────────────────────────────────────────────────
# 1. Preflight — required CLIs + auth
# ──────────────────────────────────────────────────────────────────────
step "Preflight"
require neonctl   "brew install neonctl"
require vercel    "npm i -g vercel"
require pnpm      "npm i -g pnpm"

neonctl me >/dev/null 2>&1 || {
  red "neonctl is not authenticated."
  yellow "Run: neonctl auth"
  exit 1
}

vercel whoami >/dev/null 2>&1 || {
  red "vercel is not logged in."
  yellow "Run: vercel login"
  exit 1
}

green "All CLIs present + authenticated."

# ──────────────────────────────────────────────────────────────────────
# 2. Neon — find or create project, capture DATABASE_URL
# ──────────────────────────────────────────────────────────────────────
step "Neon: provisioning"

# Look for an existing project with this name first.
PROJECT_ID="$(neonctl projects list --output json \
  | jq -r --arg n "$PROJECT_NAME" '.projects[] | select(.name == $n) | .id' \
  | head -n1)"

if [ -n "$PROJECT_ID" ]; then
  green "Reusing existing Neon project: $PROJECT_NAME ($PROJECT_ID)"
else
  yellow "Creating Neon project: $PROJECT_NAME"
  PROJECT_ID="$(neonctl projects create \
    --name "$PROJECT_NAME" \
    --output json \
    | jq -r '.project.id')"
  green "Created Neon project: $PROJECT_ID"
fi

# Pooled URL — best for serverless (Vercel)
DATABASE_URL="$(neonctl connection-string "$NEON_BRANCH" \
  --project-id "$PROJECT_ID" \
  --role-name "$NEON_ROLE" \
  --database-name "$NEON_DATABASE" \
  --pooled)"

# Direct (unpooled) URL — Prisma needs this for migrations + introspection
DATABASE_URL_UNPOOLED="$(neonctl connection-string "$NEON_BRANCH" \
  --project-id "$PROJECT_ID" \
  --role-name "$NEON_ROLE" \
  --database-name "$NEON_DATABASE")"

green "Got connection strings (pooled + direct)."

# ──────────────────────────────────────────────────────────────────────
# 3. Prisma — generate initial migration (if none) and apply
# ──────────────────────────────────────────────────────────────────────
step "Prisma: migrate"

export DATABASE_URL="$DATABASE_URL_UNPOOLED"

if [ ! -d "$ROOT/prisma/migrations" ] || [ -z "$(ls -A "$ROOT/prisma/migrations" 2>/dev/null)" ]; then
  yellow "No migrations yet — creating 'init' against Neon."
  pnpm exec prisma migrate dev --name init --skip-seed
else
  green "Applying existing migrations."
  pnpm exec prisma migrate deploy
fi

pnpm exec prisma generate >/dev/null

# ──────────────────────────────────────────────────────────────────────
# 4. Vercel — link, set env vars, deploy
# ──────────────────────────────────────────────────────────────────────
step "Vercel: link + env"

# Link the project. `vercel link` is idempotent — re-running just confirms.
if [ ! -f "$ROOT/.vercel/project.json" ]; then
  vercel link --project "$PROJECT_NAME" --yes
else
  green "Already linked to Vercel project."
fi

# Helper to set/replace an env var in all three Vercel envs.
set_vercel_env() {
  local key="$1" value="$2"
  for env in production preview development; do
    # Remove silently if exists, then add — ensures we overwrite cleanly.
    vercel env rm "$key" "$env" --yes >/dev/null 2>&1 || true
    printf "%s" "$value" | vercel env add "$key" "$env" >/dev/null
  done
}

yellow "Setting DATABASE_URL (pooled) on Vercel"
set_vercel_env "DATABASE_URL" "$DATABASE_URL"

yellow "Setting DATABASE_URL_UNPOOLED on Vercel (for migrations)"
set_vercel_env "DATABASE_URL_UNPOOLED" "$DATABASE_URL_UNPOOLED"

# USDA key — read from env or prompt
USDA_API_KEY="${USDA_API_KEY:-}"
if [ -z "$USDA_API_KEY" ]; then
  if [ -f "$ROOT/.env.local" ] && grep -q "^USDA_API_KEY=" "$ROOT/.env.local"; then
    USDA_API_KEY="$(grep "^USDA_API_KEY=" "$ROOT/.env.local" | head -1 | cut -d= -f2-)"
    yellow "Using USDA_API_KEY from .env.local"
  else
    read -r -p "USDA_API_KEY: " USDA_API_KEY
  fi
fi
set_vercel_env "USDA_API_KEY" "$USDA_API_KEY"

# ──────────────────────────────────────────────────────────────────────
# 5. Deploy
# ──────────────────────────────────────────────────────────────────────
step "Vercel: deploy --prod"
vercel --prod --yes

green "
✓ Done.
  Neon project:    $PROJECT_NAME ($PROJECT_ID)
  Vercel project:  $PROJECT_NAME

Next time, just run: ./scripts/deploy.sh
"

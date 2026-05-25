// Prisma 7 config — datasource URLs live here, not in schema.prisma.
// See https://pris.ly/d/config-datasource
import "dotenv/config";
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "prisma/config";

// Match Next.js's load order: .env.local overrides .env for local dev.
// `dotenv/config` above already loaded .env (if present); this picks up
// .env.local without re-overriding anything that's already set in the
// real environment (CI, Vercel build, etc.).
loadDotenv({ path: ".env.local", override: false });

// Prisma CLI (migrate, introspect, push) needs a direct, unpooled URL.
// At runtime the app uses the pooled DATABASE_URL via the @prisma/adapter-pg
// driver adapter (src/lib/db.ts) — that path doesn't read this file.
const url =
  process.env["DATABASE_URL_UNPOOLED"] || process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: { url },
});

// One-off: apply the CustomFood name trigram index directly to the DB.
// Run with: node scripts/apply-trgm-index.mjs
// Idempotent (IF NOT EXISTS). Uses the pooled connection (the unpooled
// endpoint isn't reachable here); on a small table a plain CREATE INDEX
// locks only momentarily. For a large table, run the CONCURRENTLY form
// in prisma/manual-indexes.sql against a direct connection instead.
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", override: false });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

async function indexes() {
  const { rows } = await client.query(
    `SELECT indexname, indexdef FROM pg_indexes
     WHERE tablename = 'CustomFood' ORDER BY indexname`
  );
  return rows;
}

await client.connect();
try {
  console.log("Indexes before:");
  for (const r of await indexes()) console.log("  -", r.indexname);

  await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  console.log("pg_trgm extension ensured.");

  await client.query(
    `CREATE INDEX IF NOT EXISTS "CustomFood_name_trgm_idx"
       ON "CustomFood" USING gin ("name" gin_trgm_ops)`
  );
  console.log("Created/verified CustomFood_name_trgm_idx.");

  console.log("Indexes after:");
  for (const r of await indexes()) {
    console.log("  -", r.indexname, "::", r.indexdef);
  }
} finally {
  await client.end();
}

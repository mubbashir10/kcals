// One-off: title-case existing AI-generated CustomFood names so they match
// the manually-entered rows ("qalmi date" -> "Qalmi Date"). Only touches
// source='AI' rows; user-entered names are left exactly as the user typed.
// Run with: node scripts/titlecase-ai-foods.mjs
// Idempotent — re-running only updates rows whose name still differs.
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", override: false });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

// Mirror of titleCase() in src/lib/food-format.ts — keep in sync.
function titleCase(s) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const { rows } = await client.query(
    `SELECT id, name FROM "CustomFood" WHERE source = 'AI' ORDER BY id`
  );
  console.log(`AI foods: ${rows.length}`);

  let changed = 0;
  for (const row of rows) {
    const next = titleCase(row.name.trim());
    if (next === row.name) continue;
    await client.query(`UPDATE "CustomFood" SET name = $1 WHERE id = $2`, [
      next,
      row.id,
    ]);
    console.log(`  ${row.id}: "${row.name}" -> "${next}"`);
    changed++;
  }

  console.log(`Updated ${changed} row(s); ${rows.length - changed} already fine.`);
} finally {
  await client.end();
}

/**
 * One-shot migration runner.
 * Usage: npx tsx src/db/migrate.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("POSTGRES_URL not set.");
    process.exit(1);
  }
  const sql = readFileSync(resolve(__dirname, "schema.sql"), "utf8");
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(sql);
    console.log("Schema applied.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

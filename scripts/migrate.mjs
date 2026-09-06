import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const baselineThrough = process.argv.includes("--baseline-through")
  ? process.argv[process.argv.indexOf("--baseline-through") + 1]
  : null;

if (!process.env.SUPABASE_DB_URL) {
  throw new Error(
    [
      "Usage: node scripts/migrate.mjs [--baseline-through <filename>]",
      "SUPABASE_DB_URL must be the direct connection on port 5432.",
      "The transaction pooler on 6543 cannot run these statements.",
      "--baseline-through records every file up to that name as applied without running it.",
    ].join("\n")
  );
}

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(`
  create table if not exists public.schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default timezone('utc', now())
  )
`);

const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
const { rows } = await client.query("select filename from public.schema_migrations");
const applied = new Set(rows.map((row) => row.filename));

if (baselineThrough && !files.includes(baselineThrough)) {
  await client.end();
  throw new Error(`No such migration: ${baselineThrough}`);
}

let ran = 0;
for (const filename of files) {
  if (applied.has(filename)) continue;

  if (baselineThrough && filename <= baselineThrough) {
    await client.query("insert into public.schema_migrations (filename) values ($1)", [filename]);
    console.log(`baseline  ${filename}`);
    continue;
  }

  const sql = await readFile(new URL(filename, migrationsDir), "utf8");
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into public.schema_migrations (filename) values ($1)", [filename]);
    await client.query("commit");
    ran += 1;
    console.log(`applied   ${filename}`);
  } catch (error) {
    await client.query("rollback");
    await client.end();
    throw new Error(`Failed on ${filename}: ${error.message}`);
  }
}

await client.end();
console.log(ran === 0 ? "nothing to apply" : `${ran} applied`);

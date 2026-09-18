// Applies every pending file in supabase/migrations to the database, once
// each, in filename order. Wired into `npm run build`, so a deploy carries its
// own schema rather than depending on somebody remembering to paste SQL.
//
// WHY THIS EXISTS. The change-marker column had a finished SQL file sitting in
// this repo, unrun, because running it was a manual step. The app quietly fell
// back to re-reading whole tables every fifteen seconds and spent 11.42 GB of
// a 5 GB monthly allowance before anyone noticed. A migration nobody runs is
// not a migration.
//
// NOT `DATABASE_URL`. That name already means "use MySQL instead of Supabase"
// to server/db-driver.ts, and setting it would switch the whole app over. This
// reads SUPABASE_DB_URL: Supabase Dashboard → Project Settings → Database →
// Connection string → URI.
//
// Use the DIRECT connection (port 5432), not the transaction pooler (6543).
// The pooler hands out a different backend per statement, which breaks both
// the advisory lock and the per-file transaction this relies on.

import "dotenv/config";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

/** One fixed key, so two builds racing each other queue instead of colliding. */
const LOCK_KEY = 4_120_907_311;

const url = process.env.SUPABASE_DB_URL || "";

// Not configured is not a failure. A contributor building the front end has no
// business holding a database password, and their build must still work. It is
// said loudly rather than silently, because silence is precisely how the last
// migration went unrun for a month.
if (!url) {
  console.warn(
    "\n  ⚠ SUPABASE_DB_URL is not set — DATABASE MIGRATIONS WERE SKIPPED.\n" +
      "    The build continues, but the database is whatever it already was.\n" +
      "    Set it in Vercel (and .env locally) to have deploys carry the schema.\n",
  );
  process.exit(0);
}

if (/:6543\b/.test(url)) {
  console.warn(
    "  ⚠ That looks like the transaction pooler (port 6543). Migrations need\n" +
      "    the direct connection (5432) — a pooled connection changes backend\n" +
      "    between statements, which breaks the lock and the transaction.",
  );
}

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (!files.length) {
  console.log("✓ No migrations to apply.");
  process.exit(0);
}

const sha = (text) => createHash("sha256").update(text).digest("hex").slice(0, 16);

// Supabase terminates plaintext connections, so SSL is required there. A local
// Postgres — the one these migrations get rehearsed against before they go
// near production — has no certificate at all, and forcing SSL on it fails the
// connection outright. So the host decides, and an explicit sslmode in the
// string always wins.
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
const ssl =
  /sslmode=disable/.test(url) || isLocal ? false : { rejectUnauthorized: false };

const client = new pg.Client({ connectionString: url, ssl });

let locked = false;
try {
  await client.connect();

  // The ledger records what has run. It is created outside the lock because
  // the lock statement below is the first thing that needs it to exist.
  await client.query(`
    create table if not exists public.schema_migrations (
      name       text primary key,
      checksum   text not null,
      applied_at timestamptz not null default now()
    )
  `);

  await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);
  locked = true;

  const { rows: done } = await client.query("select name, checksum from public.schema_migrations");
  const applied = new Map(done.map((r) => [r.name, r.checksum]));

  let ran = 0;
  for (const name of files) {
    const sql = readFileSync(join(DIR, name), "utf8");
    const sum = sha(sql);
    const seen = applied.get(name);

    if (seen) {
      // An applied migration that has since been edited means the database and
      // the repo disagree about what was run, and no later file can be trusted
      // to assume the earlier shape. Refused rather than guessed at.
      if (seen !== sum) {
        throw new Error(
          `${name} has changed since it was applied (recorded ${seen}, now ${sum}). ` +
            `Applied migrations are history — add a new file instead of editing this one.`,
        );
      }
      continue;
    }

    // One transaction per file, so a migration either lands whole or not at
    // all. The ledger row goes in the SAME transaction: a file that ran
    // without being recorded would run again on the next deploy.
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations (name, checksum) values ($1, $2)",
        [name, sum],
      );
      await client.query("commit");
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw new Error(`${name} failed: ${err.message}`);
    }
    console.log(`  ↑ applied ${name}`);
    ran += 1;
  }

  console.log(
    ran
      ? `✓ Database migrated — ${ran} of ${files.length} file${files.length === 1 ? "" : "s"} applied.`
      : `✓ Database already up to date (${files.length} migration${files.length === 1 ? "" : "s"}).`,
  );
} catch (err) {
  // A failed migration fails the build on purpose. Deploying code that expects
  // a column the database has not got is the worse outcome.
  console.error(`\n✗ Migration failed: ${err.message}\n`);
  process.exitCode = 1;
} finally {
  if (locked) await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  await client.end().catch(() => {});
}

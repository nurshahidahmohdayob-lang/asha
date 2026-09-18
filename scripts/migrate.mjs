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
// reads SUPABASE_DB_URL: Supabase Dashboard → Connect → Session pooler.
//
// WHICH of the three strings Supabase offers, and why it is not the obvious
// one. Direct connection resolves to an IPv6 address only, and a Vercel build
// runs on IPv4 — it cannot reach it at all. Transaction pooler (port 6543)
// hands out a different backend per statement, which breaks both the advisory
// lock and the per-file transaction this relies on. Session pooler is the one
// that is both reachable and honest: port 5432, one backend for the whole
// session, IPv4.

import "dotenv/config";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { parse as parseConn } from "pg-connection-string";

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

/* ── Read the string before trusting it ───────────────────────────────────
   A malformed value fails deep inside the driver as something like
   "getaddrinfo ENOTFOUND base" — a host nobody typed, out of a value nobody
   can read back, because it is stored write-only. Parsing it up here lets the
   error name what is actually wrong. The password is never printed; only
   whether there is one and whether it still says YOUR-PASSWORD. */
let conn;
try {
  conn = parseConn(url);
} catch (e) {
  console.error(
    `\n✗ SUPABASE_DB_URL is not a usable connection string: ${e.message}\n\n` +
      "  A password containing # / or ? breaks the URL unless it is\n" +
      "  percent-encoded:  # → %23   / → %2F   ? → %3F   @ → %40\n",
  );
  process.exit(1);
}

const host = String(conn.host || "");

// Printed on every run, and the single most useful line here: it is what
// turns "ENOTFOUND base" into something anyone can act on. No password.
console.log(
  `  connecting as ${conn.user || "(none)"} to ${host || "(no host)"}:${conn.port || 5432}` +
    `/${conn.database || "(no database)"}`,
);

if (/YOUR-PASSWORD/i.test(String(conn.password || ""))) {
  console.error(
    "\n✗ The password is still the placeholder. Replace [YOUR-PASSWORD] with\n" +
      "  the real one — Supabase Dashboard → Project Settings → Database →\n" +
      "  Reset database password, if it is not to hand.\n",
  );
  process.exit(1);
}

const looksLikeSupabase = host.endsWith(".supabase.com") || host.endsWith(".supabase.co");
const looksLocal = /^(localhost|127\.0\.0\.1|::1)$/.test(host);

if (!looksLikeSupabase && !looksLocal) {
  console.error(
    `\n✗ That string parsed to host "${host}", which is not a Supabase host.\n\n` +
      "  The value is malformed rather than merely wrong — something in it is\n" +
      "  ending the hostname early. Usually that is a special character in the\n" +
      "  password, which has to be percent-encoded:\n" +
      "      # → %23   / → %2F   ? → %3F   @ → %40\n\n" +
      "  Copy it again from Dashboard → Connect → Session pooler, encode the\n" +
      "  password, and check the host reads <something>.pooler.supabase.com\n",
  );
  process.exit(1);
}

if (String(conn.port) === "6543") {
  console.warn(
    "  ⚠ That is the TRANSACTION pooler (port 6543), which changes backend\n" +
      "    between statements and breaks both the advisory lock and the\n" +
      "    per-file transaction. Use the Session pooler (port 5432).",
  );
}

// A direct-connection host resolves to IPv6 only, so on an IPv4 network —
// which is what a Vercel build runs on — it fails as ENETUNREACH with nothing
// to say why. Still a warning, not an error: from an IPv6 machine it works.
if (/^db\.[a-z0-9]+\.supabase\.co$/.test(host)) {
  console.warn(
    "  ⚠ That is the DIRECT connection host, which Supabase publishes over\n" +
      "    IPv6 only. It works from an IPv6 network and fails as 'network\n" +
      "    unreachable' from an IPv4 one, a Vercel build included. Prefer the\n" +
      "    Session pooler (port 5432).",
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
const ssl =
  /sslmode=disable/.test(url) || looksLocal ? false : { rejectUnauthorized: false };

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

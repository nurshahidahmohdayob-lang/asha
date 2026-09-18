# Migrations

These run automatically. `npm run build` calls `scripts/migrate.mjs` before it
builds anything, so every deploy applies whatever the database has not seen
yet, and the schema travels with the code that needs it.

## Rules

- **Add a file, never edit one that has run.** Applied migrations are recorded
  with a checksum; changing one afterwards fails the next build rather than
  letting the database and the repo drift apart silently.
- **Make every file idempotent** — `if not exists`, `add column if not exists`,
  `drop ... if exists`. The ledger already prevents a second run, but a
  database that was set up by hand has objects no ledger knows about, and the
  first migration has to be able to land on top of it harmlessly.
- Name them `NNNN_short_description.sql`. They run in filename order.

## Configuration

`SUPABASE_DB_URL` — Supabase Dashboard → Project Settings → Database →
Connection string → URI. Use the **direct connection (port 5432)**, not the
transaction pooler (6543); a pooled connection changes backend between
statements, which breaks both the advisory lock and the per-file transaction.

Deliberately not called `DATABASE_URL`: that name already means "use MySQL
instead of Supabase" to `server/db-driver.ts`, and setting it would switch the
whole app off Supabase.

When the variable is absent the runner skips with a loud warning and the build
continues, so a front-end build needs no database password.

## The loose .sql files one directory up

`schema.sql`, `rls-lockdown.sql`, `sso.sql` and `updated-at.sql` are the
originals, kept as history. They were meant to be pasted into the SQL editor by
hand, and `updated-at.sql` shows how that goes: it sat here finished and unrun
while the app re-read whole tables every fifteen seconds, spending 11.42 GB of
a 5 GB monthly allowance. Their content now lives in `0001` and `0002`. Nothing
reads them — change the migrations instead.

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

`SUPABASE_DB_URL` — Supabase Dashboard → **Connect** → **Session pooler** →
copy the URI, and put the database password where the string says
`[YOUR-PASSWORD]`.

Supabase offers three strings and only one of them works here:

| | port | why not |
|---|---|---|
| Direct connection | 5432 | IPv6 only. A Vercel build is IPv4 and cannot reach it. |
| Transaction pooler | 6543 | Different backend per statement — breaks the advisory lock and the per-file transaction. |
| **Session pooler** | **5432** | **One backend for the whole session, over IPv4. Use this.** |

The session pooler's username is `postgres.<project-ref>`, not `postgres`; the
string the dashboard gives you already has it.

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

-- ═══════════ Commun SSO — the single-use ticket guard ════════════════════
--
-- Run this once in the Supabase SQL editor:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- Commun's tickets are single-use by contract: a jti that has been presented
-- once must never be accepted again. On a serverless deployment there is no
-- process that outlives a request to remember them in, and two replays can
-- land in two different instances at the same moment, so the database is the
-- only thing that can honestly answer "has this been used".
--
-- The primary key IS the guard. server/commun-sso.ts inserts the jti and
-- treats a unique violation as "already used" — one statement, so a replay
-- racing the original cannot slip between a read and a write.

create table if not exists public.sso_used_tickets (
  jti        text primary key,
  used_at    timestamptz not null default now(),
  -- When this row stops being worth keeping. The contract asks for at least
  -- ticket lifetime plus clock-skew leeway; this is set an hour out, which is
  -- far past a ticket's ~60 seconds.
  expires_at timestamptz not null
);

create index if not exists sso_used_tickets_expires_idx
  on public.sso_used_tickets (expires_at);

-- Same lockdown as every other table: RLS on with no policies, so only the
-- service_role key the app's own server holds can reach it. The browser never
-- sees this table and has no reason to.
alter table public.sso_used_tickets enable row level security;

-- ── Housekeeping ─────────────────────────────────────────────────────────
-- Spent tickets are worthless once they could no longer be replayed, but they
-- accumulate one row per sign-in forever. Sweep them with either of these:
--
--   1. pg_cron, if the project has it enabled:
--        select cron.schedule('sso-ticket-sweep', '0 3 * * *',
--          $$delete from public.sso_used_tickets where expires_at < now()$$);
--
--   2. by hand, whenever. It is a small table and nothing depends on it being
--      swept — an unswept row only costs space:
--        delete from public.sso_used_tickets where expires_at < now();

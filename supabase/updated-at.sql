-- ═══════════ A change marker, so watchers can fetch only what moved ═══════
--
-- Run this once in the Supabase SQL editor:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- There is no realtime channel here — that would need a database key in the
-- browser — so watching is polling. Re-reading a whole table every 15 seconds
-- is fine at today's two submissions and ruinous at a year's worth: a reviewer
-- watching 1,000 submissions would pull about 1 MB per poll, roughly 1.9 GB a
-- day, against a 5 GB monthly allowance.
--
-- With this column a watcher can ask for id and updated_at only — tens of
-- bytes per row instead of kilobytes — and fetch full rows just for the ones
-- that actually changed. The server stamps it on every write.

do $$
declare t text;
begin
  foreach t in array array[
    'projects','folders','submitted_plans','submitted_folders',
    'users','school_config','professional_development'
  ] loop
    execute format('alter table public.%I add column if not exists updated_at bigint', t);
    execute format(
      'create index if not exists %I on public.%I (updated_at desc)',
      t || '_updated_idx', t);
  end loop;
end $$;

-- Seed it so the first poll has a baseline rather than a table of nulls.
--
-- "timestamp" MUST be quoted. Unquoted it parses as the TYPE name rather than
-- the column, and the statement fails with a syntax error — which, because the
-- editor runs a script as one transaction, silently takes the ALTERs with it.
-- Written out per table rather than generated, so a mistake like that is
-- visible in the statement instead of buried in a format() argument.
update public.projects
  set updated_at = coalesce(updated_at, "timestamp", 0) where updated_at is null;
update public.folders
  set updated_at = coalesce(updated_at, "timestamp", 0) where updated_at is null;
update public.submitted_plans
  set updated_at = coalesce(updated_at, "timestamp", 0) where updated_at is null;
update public.submitted_folders
  set updated_at = coalesce(updated_at, created_at, 0) where updated_at is null;
update public.users
  set updated_at = coalesce(updated_at, 0) where updated_at is null;
update public.school_config
  set updated_at = coalesce(updated_at, 0) where updated_at is null;
update public.professional_development
  set updated_at = coalesce(updated_at, 0) where updated_at is null;

-- ── Check it ─────────────────────────────────────────────────────────────
-- Expect seven rows, one per table, all bigint.
select table_name, data_type
from information_schema.columns
where table_schema = 'public'
  and column_name = 'updated_at'
order by table_name;

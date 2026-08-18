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
    -- Seed it so the first poll has a baseline rather than a table of nulls.
    execute format(
      'update public.%I set updated_at = coalesce(updated_at, %s, 0) where updated_at is null',
      t,
      case when t in ('projects','folders','submitted_plans') then 'timestamp'
           when t = 'submitted_folders' then 'created_at'
           else '0' end);
    execute format(
      'create index if not exists %I on public.%I (updated_at desc)',
      t || '_updated_idx', t);
  end loop;
end $$;

-- ── Check it ─────────────────────────────────────────────────────────────
-- Expect: every table listed, nulls = 0.
select
  table_name,
  (xpath('/row/c/text()',
    query_to_xml(format('select count(*) as c from public.%I where updated_at is null', table_name),
    false, true, '')))[1]::text::int as nulls
from information_schema.columns
where table_schema = 'public'
  and column_name = 'updated_at'
order by table_name;

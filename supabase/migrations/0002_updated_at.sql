-- ═══════════ 0002 — a change marker, so watchers fetch only what moved ════
--
-- There is no realtime channel here — that would need a database key in the
-- browser — so watching is polling. Without this column a watcher re-reads
-- every row of a table every fifteen seconds.
--
-- That is not a theoretical cost. It ran for a month: about 2.5 MB of
-- projects plus 1.9 MB of submissions, pulled four times a minute by every
-- open reviewer tab — roughly 1 GB an hour — against a 5 GB monthly
-- allowance. The bill was 11.42 GB.
--
-- With the column a watcher asks for id and updated_at only, tens of bytes a
-- row, and fetches whole rows just for the ones that actually changed. The
-- server stamps it on every write, guarded by a probe for the column, so this
-- migration is the entire switch — no application change turns it on.

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
-- the column, and the statement fails with a syntax error — which, because a
-- migration runs as one transaction, would silently take the ALTERs with it.
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

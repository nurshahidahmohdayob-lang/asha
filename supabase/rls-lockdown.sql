-- ═══════════ Close the anon-key hole left open by step 2 ═════════════════
--
-- Run this once in the Supabase SQL editor:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- schema.sql ended with a WARNING: with auth on Firebase there is no Supabase
-- session, so RLS could not check row ownership, and the placeholder policies
-- it created let anyone holding the anon key read or write every row. It
-- offered two ways to close that. Step 3 took the first — the app's own server
-- holds the service_role key and checks a Firebase ID token on every request,
-- so the browser never receives a database key at all.
--
-- That makes the placeholder policies pure exposure with nothing left to gain
-- from them. Dropping them leaves RLS enabled with no policies at all, which
-- denies anon and authenticated everything. service_role bypasses RLS, so the
-- server carries on working exactly as it does now.

do $$
declare t text;
begin
  foreach t in array array[
    'projects','folders','submitted_plans','submitted_folders',
    'users','school_config','professional_development'
  ] loop
    execute format('drop policy if exists app_read on public.%I', t);
    execute format('drop policy if exists app_write on public.%I', t);
    -- RLS itself stays ON. With no policies, only service_role gets through.
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ── Check it ─────────────────────────────────────────────────────────────
-- Expect: every table rls_enabled = true, policy_count = 0.
select
  c.relname                       as table_name,
  c.relrowsecurity                as rls_enabled,
  count(p.polname)                as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relname in (
    'projects','folders','submitted_plans','submitted_folders',
    'users','school_config','professional_development')
group by c.relname, c.relrowsecurity
order by c.relname;

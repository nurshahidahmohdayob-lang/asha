-- ═══════════ Zera Education Suite — Supabase schema ═══════════════════════
--
-- Run this once in the Supabase SQL editor:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- Shape follows the Firestore collections it replaces. Each row keeps the
-- document's own id and a jsonb `data` column holding the record exactly as
-- the app already writes it, so nothing in the app has to be reshaped to move
-- across. Columns are lifted out only where they are filtered or sorted on.
--
-- AUTH NOTE: teacher accounts stay on Firebase. Supabase therefore never sees
-- a Supabase user, so auth.uid() is always null here and cannot be used for
-- ownership. Ownership is enforced by the app passing the Firebase uid, and by
-- the policies below restricting what the anon key can reach. This is weaker
-- than Firestore's rules were, so read the WARNING at the bottom before going
-- live with real data.

-- ── Projects: a teacher's saved lesson plans, slides, worksheets ──────────
create table if not exists public.projects (
  id            text primary key,
  user_id       text not null,
  folder_id     text,
  title         text,
  category      text,
  status        text default 'draft',
  teacher_name  text,
  timestamp     bigint not null,
  data          jsonb not null default '{}'::jsonb
);
create index if not exists projects_user_idx on public.projects (user_id);
create index if not exists projects_user_time_idx
  on public.projects (user_id, timestamp desc);

-- ── Folders a teacher groups their own projects into ─────────────────────
create table if not exists public.folders (
  id        text primary key,
  user_id   text not null,
  name      text,
  timestamp bigint not null,
  data      jsonb not null default '{}'::jsonb
);
create index if not exists folders_user_idx on public.folders (user_id);

-- ── Submitted plans: what a teacher sends for review ─────────────────────
create table if not exists public.submitted_plans (
  id            text primary key,
  user_id       text not null,
  folder_id     text,
  title         text,
  category      text,
  status        text default 'submitted',
  review_stage  text default 'pending_hod',
  teacher_name  text,
  subject       text,
  year_group    text,
  week_id       int,
  timestamp     bigint not null,
  data          jsonb not null default '{}'::jsonb
);
create index if not exists submitted_plans_user_idx
  on public.submitted_plans (user_id);
create index if not exists submitted_plans_stage_idx
  on public.submitted_plans (review_stage);
create index if not exists submitted_plans_time_idx
  on public.submitted_plans (timestamp desc);

-- ── One folder per teacher in the submissions area ───────────────────────
create table if not exists public.submitted_folders (
  id             text primary key,
  name           text,
  teacher_folder boolean default true,
  created_by     text,
  created_at     bigint,
  data           jsonb not null default '{}'::jsonb
);

-- ── User records (profile + roles). Auth itself stays on Firebase. ───────
create table if not exists public.users (
  uid          text primary key,
  email        text,
  teacher_name text,
  roles        text[] default array['educator'],
  created_at   text,
  data         jsonb not null default '{}'::jsonb
);
create index if not exists users_email_idx on public.users (lower(email));

-- ── School-wide settings: timetable, staff directory, assignments ────────
create table if not exists public.school_config (
  id   text primary key,
  data jsonb not null default '{}'::jsonb
);

-- ── Professional development records, one row per teacher ────────────────
create table if not exists public.professional_development (
  user_id text primary key,
  data    jsonb not null default '{}'::jsonb
);

-- ═══════════ Row-level security ══════════════════════════════════════════
alter table public.projects                 enable row level security;
alter table public.folders                  enable row level security;
alter table public.submitted_plans          enable row level security;
alter table public.submitted_folders        enable row level security;
alter table public.users                    enable row level security;
alter table public.school_config            enable row level security;
alter table public.professional_development enable row level security;

-- With auth on Firebase there is no Supabase session, so these policies
-- cannot check "is this row yours" the way the Firestore rules did. They
-- allow the anon key to work while the app enforces ownership by always
-- filtering on user_id. See the WARNING below.
do $$
declare t text;
begin
  foreach t in array array[
    'projects','folders','submitted_plans','submitted_folders',
    'users','school_config','professional_development'
  ] loop
    execute format('drop policy if exists app_read on public.%I', t);
    execute format('drop policy if exists app_write on public.%I', t);
    execute format(
      'create policy app_read on public.%I for select to anon, authenticated using (true)', t);
    execute format(
      'create policy app_write on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ═══════════ WARNING — READ BEFORE PUTTING REAL DATA HERE ════════════════
--
-- Firestore's rules stopped one teacher reading another's work at the
-- DATABASE level: a teacher could only list projects where userId matched
-- their signed-in account, no matter what the app asked for.
--
-- Because auth stays on Firebase, Supabase has no idea who is calling, so
-- the policies above cannot reproduce that. Anyone holding the anon key —
-- which ships in the browser bundle and is readable by anyone who opens
-- devtools — could read or modify every row.
--
-- That is a real downgrade in privacy for teachers' work, and it must be
-- closed before this holds live data. Two ways:
--
--   1. Route database calls through this app's own Express server, keeping
--      the service_role key server-side and checking the Firebase ID token
--      on every request. The browser never gets a database key. This is the
--      recommended fix and reuses the server that already exists.
--
--   2. Mint Supabase JWTs signed with the project's JWT secret, carrying the
--      Firebase uid as the subject, so auth.uid() works and the policies can
--      compare it to user_id. More moving parts.
--
-- Until one of those is in place, keep the Firestore backend switched on.

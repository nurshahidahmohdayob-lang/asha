-- ═══════════ 0001 — the shape the app stores ══════════════════════════════
--
-- The baseline: every table and index the suite needs, row-level security on,
-- and the single-use ticket guard the SSO sign-in depends on. Assembled from
-- schema.sql, rls-lockdown.sql and sso.sql, which were three loose files
-- somebody had to remember to paste into the SQL editor, in the right order,
-- on the right project.
--
-- Idempotent throughout — "if not exists" on every object — so running this
-- against the live database, where all of it already exists, changes nothing.
-- That is the point rather than a nicety: a migration has to be safe to
-- re-run, because the runner will try it on any database that has not
-- recorded it yet, including one that was set up by hand.

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

-- ── Commun SSO: the single-use ticket guard ──────────────────────────────
-- The primary key IS the guard. server/commun-sso.ts inserts the jti and
-- treats a unique violation as "already used" — one statement, so a replay
-- racing the original cannot slip between a read and a write.
create table if not exists public.sso_used_tickets (
  jti        text primary key,
  used_at    timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sso_used_tickets_expires_idx
  on public.sso_used_tickets (expires_at);

-- ═══════════ Row-level security ══════════════════════════════════════════
--
-- RLS on with NO policies, which denies anon and authenticated everything.
-- service_role bypasses RLS, and the app's own server is the only thing
-- holding that key — it verifies a Firebase ID token on every request and
-- decides what the caller may touch. The browser never receives a database
-- key at all.
--
-- An earlier revision shipped placeholder policies that let anyone holding
-- the anon key read or write every row. The anon key ships in the browser
-- bundle, so that was a real hole. It is closed by dropping them, and they
-- are dropped here rather than merely not created, so a database that still
-- carries them is repaired by running this.
do $$
declare t text;
begin
  foreach t in array array[
    'projects','folders','submitted_plans','submitted_folders',
    'users','school_config','professional_development','sso_used_tickets'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists app_read on public.%I', t);
    execute format('drop policy if exists app_write on public.%I', t);
  end loop;
end $$;

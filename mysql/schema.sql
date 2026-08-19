-- ═══════════ Zera Education Suite — MySQL schema ═════════════════════════
--
-- Run once against the dev database:
--   mysql -h 127.0.0.1 -P 3307 -u sha -p `zera-education-suite` < mysql/schema.sql
-- or paste into a GUI client connected through the SSH tunnel.
--
-- Mirrors supabase/schema.sql so the app above the store does not change: each
-- row keeps the document's own id and a `data` JSON column holding the record
-- exactly as the app writes it. Columns are lifted out only where they are
-- filtered or sorted on.
--
-- Differences forced by MySQL rather than chosen:
--   * jsonb            → json
--   * text primary key → varchar(191). utf8mb4 costs 4 bytes a character and
--                        an InnoDB index key stops at 767; 191 is the largest
--                        safe width. Firestore ids are ~20 chars, so this is
--                        far more than needed.
--   * text[] roles     → json array. Defaults for json need MySQL 8.0.13+, so
--                        the column is nullable and the server supplies
--                        ["educator"] instead of relying on the database.
--   * `timestamp` and `data` are quoted everywhere. Both are reserved-ish in
--     MySQL and fail with a bare syntax error otherwise.
--   * No "create index if not exists" in MySQL, so indexes are declared inside
--     the table and the whole file is re-runnable via "if not exists" there.

-- ── Projects: a teacher's saved lesson plans, slides, worksheets ──────────
create table if not exists `projects` (
  `id`           varchar(191) not null,
  `user_id`      varchar(191) not null,
  `folder_id`    varchar(191) null,
  `title`        text null,
  `category`     varchar(64) null,
  `status`       varchar(32) null default 'draft',
  `teacher_name` varchar(191) null,
  `timestamp`    bigint not null,
  `updated_at`   bigint null,
  `data`         json not null,
  primary key (`id`),
  key `projects_user_idx` (`user_id`),
  key `projects_user_time_idx` (`user_id`, `timestamp` desc),
  key `projects_updated_idx` (`updated_at` desc)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ── Folders a teacher groups their own projects into ─────────────────────
create table if not exists `folders` (
  `id`         varchar(191) not null,
  `user_id`    varchar(191) not null,
  `name`       varchar(255) null,
  `timestamp`  bigint not null,
  `updated_at` bigint null,
  `data`       json not null,
  primary key (`id`),
  key `folders_user_idx` (`user_id`),
  key `folders_updated_idx` (`updated_at` desc)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ── Submitted plans: what a teacher sends for review ─────────────────────
create table if not exists `submitted_plans` (
  `id`           varchar(191) not null,
  `user_id`      varchar(191) not null,
  `folder_id`    varchar(191) null,
  `title`        text null,
  `category`     varchar(64) null,
  `status`       varchar(32) null default 'submitted',
  `review_stage` varchar(48) null default 'pending_hod',
  `teacher_name` varchar(191) null,
  `subject`      varchar(191) null,
  `year_group`   varchar(64) null,
  `week_id`      int null,
  `timestamp`    bigint not null,
  `updated_at`   bigint null,
  `data`         json not null,
  primary key (`id`),
  key `submitted_plans_user_idx` (`user_id`),
  key `submitted_plans_stage_idx` (`review_stage`),
  key `submitted_plans_time_idx` (`timestamp` desc),
  key `submitted_plans_updated_idx` (`updated_at` desc)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ── One folder per teacher in the submissions area ───────────────────────
create table if not exists `submitted_folders` (
  `id`             varchar(191) not null,
  `name`           varchar(255) null,
  `teacher_folder` tinyint(1) null default 1,
  `created_by`     varchar(191) null,
  `created_at`     bigint null,
  `updated_at`     bigint null,
  `data`           json not null,
  primary key (`id`),
  key `submitted_folders_updated_idx` (`updated_at` desc)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ── User records (profile + roles). Auth itself stays on Firebase. ───────
create table if not exists `users` (
  `uid`          varchar(191) not null,
  `email`        varchar(255) null,
  `teacher_name` varchar(191) null,
  `roles`        json null,
  `created_at`   varchar(64) null,
  `updated_at`   bigint null,
  `data`         json not null,
  primary key (`uid`),
  key `users_email_idx` (`email`),
  key `users_updated_idx` (`updated_at` desc)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ── School-wide settings: timetable, staff directory, assignments ────────
create table if not exists `school_config` (
  `id`         varchar(191) not null,
  `updated_at` bigint null,
  `data`       json not null,
  primary key (`id`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ── Professional development records, one row per teacher ────────────────
create table if not exists `professional_development` (
  `user_id`    varchar(191) not null,
  `updated_at` bigint null,
  `data`       json not null,
  primary key (`user_id`),
  key `pd_updated_idx` (`updated_at` desc)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ═══════════ Access control ══════════════════════════════════════════════
--
-- There is no row-level security here, and none is needed for the same reason
-- it is not needed on Supabase: the browser never receives a database
-- credential. It sends its Firebase ID token to this app's own server, which
-- verifies the token, works out who is asking, and pins ownership on every
-- query itself. See server/data-api.ts.
--
-- What that DOES mean is that the `sha` MySQL account is the whole boundary.
-- Anyone holding it can read and write every teacher's work, so it belongs on
-- the server and nowhere else — never in a browser bundle, never in a repo.

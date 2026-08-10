-- The Path — schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) before policies.sql.

create table training_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  week         integer not null,        -- program week index. Matches computeRx's weekIndex exactly.
  day          integer not null,        -- day-of-week int (0=Sunday..6=Saturday), matches day-plan.js's DAY_IDS keys
  exercise_id  text not null,           -- must be a key in progression-engine.js's RULE_MAP
  value        numeric,                 -- primary result: seconds / reps / lbs, OR tier index for TIER exercises
  sub_value    numeric,                 -- TIER exercises only: performance at that stage. Unused otherwise.
  form_clean   boolean not null default false,
  notes        text,
  is_baseline  boolean not null default false,  -- this exercise's current reference point for computeRx.
                                                  -- Initially the week-0 row; a completed retest week moves
                                                  -- it forward without deleting any prior history.
  created_at   timestamptz not null default now()
);

create index training_entries_user_week_idx on training_entries (user_id, exercise_id, week);

-- One row per (user, week, day, exercise): the last completed set that day. A user may
-- re-log the same day (edit past entry per the design's "Read-only, Edit unlocks it"
-- behavior) — this constraint makes that an atomic upsert (entries-repo.js uses
-- .upsert(row, { onConflict: 'user_id,week,day,exercise_id' })) instead of an
-- unguarded select-then-write with a race window.
create unique index training_entries_unique_slot on training_entries (user_id, week, day, exercise_id);

-- At most one baseline row per (user, exercise) at a time — entries-repo.js's
-- setBaseline() always unsets the previous one first, this is the DB-level backstop.
create unique index training_entries_one_baseline_per_exercise
  on training_entries (user_id, exercise_id) where is_baseline;

-- ── Access control ──────────────────────────────────────────────────
-- Anyone can sign in with Google (Supabase Auth creates a real auth.users row regardless).
-- Whether that account can read/write anything is gated entirely by this table via RLS
-- (see policies.sql) — this is what makes revoking access (e.g. a lapsed subscription)
-- a one-row update, never a data deletion.
create table allowed_users (
  email      text primary key,
  active     boolean not null default true,
  note       text,
  added_at   timestamptz not null default now()
);

-- ── Calendar date derivation + vacation weeks ───────────────────────
-- Program week/day are abstract integers; real calendar dates are derived client-side
-- (calendar-service.js) from these two tables rather than stored per-entry.
create table program_settings (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  start_date           date not null,   -- this user's week-0/day-1 date. Changed only via a full
                                         -- "restart program" action (see policies.sql comment + app).
  rest_seconds_load    integer not null default 180,  -- rest after LOAD (barbell) exercises: squat/deadlift/bench
  rest_seconds_default integer not null default 90,   -- rest after everything else — holds, reps, tiers
  pending_retest_week  integer,         -- set by the Baselines screen's "Retest" button: the program week
                                         -- (always today's current week + 1) that should run as a test week.
                                         -- Left in place after that week passes — a true historical record
                                         -- of which week was a retest, not just a one-shot flag to clear.
  updated_at           timestamptz not null default now()
);

create table week_skips (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  after_week   integer not null,        -- a 1-calendar-week gap is inserted before this program week starts
  created_at   timestamptz not null default now(),
  unique (user_id, after_week)
);

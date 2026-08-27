-- Run once, in the Supabase SQL editor (schema/RLS changes can't go through the REST
-- API — this is the one piece of the per-user Program Builder feature that has to be
-- run by hand, everything else ships as code + a separate REST data seed).
--
-- Turns the app's hardcoded global weekly schedule (js/data/day-plan.js's DAY_IDS/
-- DAY_META — one shared schedule for every user) into per-user, editable config. The
-- exercise LIBRARY (EXERCISES in exercises.js, RULE_MAP in progression-engine.js) stays
-- code-defined — this is only about which of those exercises run on which day, in what
-- order, per user, plus a per-user day title.
--
-- Two tables:
--   program_days      — one row per (user, day) that's been named; day-of-week 0-6,
--                        matching training_entries.day.
--   program_exercises — one row per (user, day, exercise) scheduled, with an explicit
--                        position for ordering. A day is a REST day purely by having
--                        zero rows here — no separate boolean, so a day can never be
--                        inconsistently "marked rest" while also holding exercises.
--                        This also means rest is no longer hardcoded to Sunday; any of
--                        the 7 days can be a user's rest day. An exercise can legally
--                        appear on more than one day for one user (e.g. pull-ups twice
--                        a week) — baselines/progression are keyed by exercise_id alone
--                        (see training_entries_one_baseline_per_exercise), already
--                        safely shared across however many days it's scheduled on.
--
-- exercise_id has no FK/check against the code-defined EXERCISES/RULE_MAP catalog here
-- (can't — it's not a table) — js/services/program-service.js's setDayExercises is the
-- only writer, and the Program Builder UI only ever offers real ids from that catalog.
--
-- Existing accounts need their starting data seeded separately, directly via REST with
-- the service-role key (same approach used for migration_006/007's data content) — not
-- from this file. See the plan/commit this migration shipped with for the exact seed.

create table program_days (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        integer not null check (day >= 0 and day <= 6),
  title      text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table program_exercises (
  user_id     uuid not null references auth.users(id) on delete cascade,
  day         integer not null check (day >= 0 and day <= 6),
  exercise_id text not null,
  position    integer not null,   -- 0-based order within the day. setDayExercises always
                                   -- rewrites every row for a day at once (delete + bulk
                                   -- insert), position = array index — never diffed.
  primary key (user_id, day, exercise_id)
);

-- Backstop against two rows in the same day ever claiming the same position — never
-- actually reachable given setDayExercises' atomic-replace write pattern, but every
-- other per-user table in this schema has an analogous unique-index backstop (see
-- training_entries_one_baseline_per_exercise), so this matches that precedent.
create unique index program_exercises_unique_position on program_exercises (user_id, day, position);

alter table program_days      enable row level security;
alter table program_exercises enable row level security;

create policy "owner full access" on program_days
  for all
  using (
    auth.uid() = user_id
    and exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.active)
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.active)
  );

create policy "owner full access" on program_exercises
  for all
  using (
    auth.uid() = user_id
    and exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.active)
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.active)
  );

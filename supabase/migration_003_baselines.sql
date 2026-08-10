-- Run this once in the Supabase SQL editor against an existing project. A fresh install
-- doesn't need this — schema.sql already includes these columns/indexes.
-- Each line is an independent statement (see migration_002's commit message for why:
-- a partial paste that drops a shared header can silently orphan a chained clause).

alter table training_entries add column if not exists is_baseline boolean not null default false;

create unique index if not exists training_entries_one_baseline_per_exercise
  on training_entries (user_id, exercise_id) where is_baseline;

alter table program_settings add column if not exists pending_retest_week integer;

-- One-time backfill: mark each exercise's existing week-0 row (if any) as its baseline,
-- so computeRx keeps working exactly as before for anyone who already has data logged.
-- Safe to run even if some exercises have no week-0 row yet (backfills nothing for them).
update training_entries
  set is_baseline = true
  where week = 0
    and not exists (
      select 1 from training_entries te2
      where te2.user_id = training_entries.user_id
        and te2.exercise_id = training_entries.exercise_id
        and te2.is_baseline = true
    );

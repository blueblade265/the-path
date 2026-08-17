-- Already applied 2026-08-17 via 8 direct REST inserts (service role key) — the source
-- data was only 4 rows (2 weeks x 2 exercises), so it was faster to duplicate them
-- directly than to run this SQL. Kept here, idempotent (NOT EXISTS-guarded), as the
-- documented record and as the general-purpose script for any future account (e.g. a
-- spouse's) that logs single-leg-balance/side-lever history under the old combined ids
-- before switching to the split ones.
--
-- single-leg-balance and side-lever were split into independent left/right exercise ids
-- (see RULE_MAP in js/lib/progression-engine.js,
-- EXERCISES in js/data/exercises.js, and DAY_IDS in js/data/day-plan.js) so each side can
-- progress independently — Day 5 (Legs + Hip) and Day 6 (Core + Integration) each go from
-- 5 logged movements to 6.
--
-- Both new ids for each exercise inherit the FULL existing history (every logged week,
-- including the baseline row) of the old combined id — same
-- week/day/value/sub_value/form_clean/notes/is_baseline — so each side's progression
-- continues from where the combined tracking left off instead of resetting to zero. This
-- also matters for Calendar's day-preview and the movement-history detail sheet: both
-- render using the CURRENT day-plan's exercise ids (not whatever id was live on the date
-- being viewed), so past dates need rows under the new ids to display anything at all.
--
-- Scoped to majoriaadam@gmail.com only. His wife's rows for the same two old exercise ids
-- are untouched — her account needs fresh baselines logged via Bulk Entry for the four new
-- ids, since the RULE_MAP/exercises.js/day-plan.js changes apply globally but this data
-- backfill does not.
--
-- The old combined ids (single-leg-balance, side-lever) are NOT deleted or modified —
-- they remain valid RULE_MAP/EXERCISES entries (required so exercises.js's drift-check
-- never fires) but were removed from DAY_IDS, so nothing new ever logs against them again.
--
-- The dragon-flag RULE_MAP change (subUnit 'reps' -> 'sec') shipping alongside this split
-- needs NO data migration — it's a pure reinterpretation of existing sub_value numbers
-- going forward, not a change to any stored row.
--
-- Idempotent: the NOT EXISTS guard means a partial or repeat run only inserts what's still
-- missing. Never violates training_entries_unique_slot or
-- training_entries_one_baseline_per_exercise — each new id is its own distinct
-- exercise_id, so is_baseline=true on single-leg-balance AND single-leg-balance-left AND
-- single-leg-balance-right simultaneously is legal (the partial unique index is scoped per
-- exercise_id).

with mapping(old_id, new_id) as (
  values
    ('single-leg-balance', 'single-leg-balance-left'),
    ('single-leg-balance', 'single-leg-balance-right'),
    ('side-lever', 'side-lever-left'),
    ('side-lever', 'side-lever-right')
)
insert into training_entries (user_id, week, day, exercise_id, value, sub_value, form_clean, notes, is_baseline)
select t.user_id, t.week, t.day, m.new_id, t.value, t.sub_value, t.form_clean, t.notes, t.is_baseline
from training_entries t
join mapping m on m.old_id = t.exercise_id
where t.user_id = (select id from auth.users where email = 'majoriaadam@gmail.com')
  and not exists (
    select 1 from training_entries existing
    where existing.user_id = t.user_id
      and existing.week = t.week
      and existing.day = t.day
      and existing.exercise_id = m.new_id
  );

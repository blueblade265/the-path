-- Run this once in the Supabase SQL editor. Inserting "Not yet achievable — block
-- assist" at the FRONT of front-lever's tier ladder (js/lib/progression-engine.js)
-- shifts every other stage's index by one (Tuck: 1 -> 2, Advanced Tuck: 2 -> 3, etc.).
-- Any front-lever row logged before this change has its old index baked in as `value`
-- — without this migration it would silently point to the wrong stage name (e.g. an
-- old "Tuck" baseline, value=1, would resolve to the new stage 1, "Not yet achievable
-- — eccentric entry", after the array shifts).
--
-- Shifts every existing front-lever row for every user (RLS doesn't apply to SQL
-- editor queries), not just tier-index-bearing rows selectively — all of them are tier
-- indices for this exercise, never a raw seconds/reps value.

update training_entries
set value = value + 1
where exercise_id = 'front-lever' and value is not null;

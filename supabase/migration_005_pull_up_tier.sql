-- Run this once in the Supabase SQL editor. pull-up was reclassified from flat REPS
-- to a staged TIER ladder (Negative / Full / High Pull / Muscle Up — see RULE_MAP in
-- js/lib/progression-engine.js). Existing rows have a raw rep count in `value`; TIER
-- rows need `value` = stage index and `sub_value` = performance at that stage.
--
-- Every pull-up entry logged before this change was a full pull-up (the only variant
-- the app supported), so the safe mapping is: the old rep count becomes sub_value
-- (performance), and value becomes 1 (the index of "Full" in the new tiers array).
-- RLS doesn't apply to SQL editor queries, so this covers every user's rows.

update training_entries
set sub_value = value,
    value = 1
where exercise_id = 'pull-up' and value is not null;

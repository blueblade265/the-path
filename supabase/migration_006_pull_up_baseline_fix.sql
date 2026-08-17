-- Already applied 2026-08-12 via a direct PATCH against the REST API (service role key),
-- not through the SQL editor — kept here per this project's convention of recording every
-- one-time data fix, same as migration_002 through _005.
--
-- majoriaadam@gmail.com's pull-up baseline row (week 0, is_baseline=true) had
-- value=1 ("Full" in RULE_MAP's pull-up tiers array — already correct, migration_005 set
-- that fine) but sub_value=1, not the actual Week 0 test result of 3 clean reps. Root
-- cause unconfirmed — likely an in-session write during the first live TIER-mode pull-up
-- log touched the baseline row's sub_value. Fixed by restoring sub_value=3.

update training_entries
set sub_value = 3
where exercise_id = 'pull-up'
  and is_baseline = true
  and user_id = (select id from auth.users where email = 'majoriaadam@gmail.com')
  and sub_value is distinct from 3;

// Week-0 baseline: write a whole batch of exercises in one call instead of one at a
// time. `entries` is [{ exerciseId, day, value, subValue, formClean, notes }, ...].

import { insertMany, setBaseline } from './entries-repo.js';

export async function saveBaseline(userId, entries) {
  const rows = entries.map(e => ({
    user_id: userId,
    week: 0,
    day: e.day,
    exercise_id: e.exerciseId,
    value: e.value,
    sub_value: e.subValue ?? null,
    form_clean: !!e.formClean,
    notes: e.notes ?? null
  }));
  const saved = await insertMany(rows);
  // Separate step (not is_baseline: true on the row itself) so setBaseline can safely
  // unset any OTHER week currently holding the flag for the same exercise first — e.g.
  // re-running Bulk Entry for week 0 after a retest had already moved the baseline
  // forward. Doing it inline would risk the one-baseline-per-exercise unique index.
  for (const e of entries) {
    await setBaseline(userId, e.exerciseId, 0);
  }
  return saved;
}

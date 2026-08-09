// Week-0 baseline: write a whole batch of exercises in one call instead of one at a
// time. `entries` is [{ exerciseId, day, value, subValue, formClean, notes }, ...].

import { insertMany } from './entries-repo.js';

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
  return insertMany(rows);
}

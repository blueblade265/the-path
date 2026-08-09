// Bridges Supabase <-> progression-engine.js, per the engine's own porting contract
// (see its header comment): query training_entries WHERE user_id + exercise_id +
// week < target, ORDER BY week ASC, map rows to computeRx's entry shape, call it.
// RLS already guarantees each user only ever sees their own rows, so this function
// needs no per-user branching to be correct for both accounts.

import { computeRx } from '../lib/progression-engine.js';
import { historyForExercise } from './entries-repo.js';

// Returns { text, why } | null (null = no baseline logged yet for this exercise).
export async function prescriptionFor(userId, exerciseId, targetWeek) {
  const rows = await historyForExercise(userId, exerciseId, targetWeek);
  const entries = rows.map(r => ({
    id: exerciseId,
    value: r.value,
    subValue: r.sub_value,
    formClean: r.form_clean,
    weekIndex: r.week
  }));
  return computeRx(exerciseId, entries);
}

// Prescriptions for a whole day's exercise list in one batch (Session tab).
export async function prescriptionsForDay(userId, exerciseIds, targetWeek) {
  const results = await Promise.all(
    exerciseIds.map(id => prescriptionFor(userId, id, targetWeek).then(rx => [id, rx]))
  );
  return Object.fromEntries(results);
}

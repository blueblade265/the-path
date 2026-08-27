// Baselines: each exercise's current reference point for computeRx (entries-repo.js's
// is_baseline flag), and the manually-triggered Retest flow that moves it forward.
//
// Retest, as specified: pressing the button on the Baselines screen schedules the very
// next program week (today's current week + 1) to run as a test week. Session renders
// that week in test mode instead of normal prescribed work (no computed Rx, default the
// stepper to the current baseline as a reference point). Logging a result there both
// saves the entry and replaces that exercise's baseline — completing the whole week
// resets every exercise's baseline without restarting the program or touching history.

import { supabase } from '../supabase-client.js';
import { allBaselines, getBaseline, logEntry, setBaseline } from './entries-repo.js';
import { exerciseTiers } from '../data/exercises.js';

export { allBaselines };

export async function getPendingRetestWeek(userId) {
  const { data, error } = await supabase
    .from('program_settings')
    .select('pending_retest_week')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.pending_retest_week ?? null;
}

export async function scheduleRetest(userId, week) {
  const { error } = await supabase
    .from('program_settings')
    .update({ pending_retest_week: week, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw error;
}

export async function cancelRetest(userId) {
  const { error } = await supabase
    .from('program_settings')
    .update({ pending_retest_week: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw error;
}

// The one thing different about logging a result during a retest week vs a normal
// week: it also moves that exercise's baseline to this entry.
export async function logRetestEntry(args) {
  await logEntry(args);
  await setBaseline(args.userId, args.exerciseId, args.week);
}

// Per-exercise, user-triggered stage advance (Baselines screen's "Advance to next
// stage") — moves just this one exercise's baseline up one stage, effective next week;
// every other exercise's baseline is untouched. Reuses the same insert-then-flip
// mechanism as logRetestEntry above rather than new plumbing. sub_value is left null so
// the next Rx computation lands in RULES.TIER's "no performance logged at this stage
// yet" branch — that's what resets the target to a conservative starting point at the
// new stage, not anything hardcoded here.
export async function advanceStage(userId, exerciseId, week, day) {
  const baseline = await getBaseline(userId, exerciseId);
  const tiers = exerciseTiers(exerciseId);
  const currentIdx = Math.round(baseline?.value ?? 0);
  const newIdx = Math.min(currentIdx + 1, tiers.length - 1);
  await logEntry({ userId, week, day, exerciseId, value: newIdx, subValue: null, formClean: true, notes: `Manually advanced to "${tiers[newIdx]}"` });
  await setBaseline(userId, exerciseId, week);
}

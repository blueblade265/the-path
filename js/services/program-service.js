// Per-user program configuration: which exercises (from the fixed EXERCISES/RULE_MAP
// library — exercise CONTENT stays code-defined, this is only about which ones run on
// which day) are scheduled on each day of the week, in what order, plus a per-user day
// title. A day with zero exercises IS a rest day — no separate flag (see
// supabase/migration_008_program_builder.sql) — so `rest` below is always derived from
// exerciseIds.length, never stored.

import { supabase } from '../supabase-client.js';

const DAYS = [0, 1, 2, 3, 4, 5, 6];

export async function getProgramDayPlan(userId) {
  const [{ data: days, error: daysErr }, { data: exercises, error: exErr }] = await Promise.all([
    supabase.from('program_days').select('day, title').eq('user_id', userId),
    supabase.from('program_exercises').select('day, exercise_id, position').eq('user_id', userId).order('position', { ascending: true })
  ]);
  if (daysErr) throw daysErr;
  if (exErr) throw exErr;

  const titleByDay = Object.fromEntries((days || []).map(d => [d.day, d.title]));
  const plan = {};
  for (const day of DAYS) {
    // A brand-new user with no rows yet (no onboarding seed exists for this feature) falls
    // back to a plain label and an empty (rest) day rather than crashing.
    const exerciseIds = (exercises || []).filter(e => e.day === day).map(e => e.exercise_id);
    plan[day] = {
      title: titleByDay[day] ?? `Day ${day}`,
      exerciseIds,
      rest: exerciseIds.length === 0
    };
  }
  return plan;
}

export async function setDayTitle(userId, day, title) {
  const { error } = await supabase
    .from('program_days')
    .upsert({ user_id: userId, day, title, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' });
  if (error) throw error;
}

// Atomic replace, not diffed add/remove — mirrors bulk-entry-service.js's "wipe and
// rewrite a whole day" precedent. position is just the array index, so reordering is
// just calling this again with the same ids in a new order.
export async function setDayExercises(userId, day, orderedExerciseIds) {
  const { error: delErr } = await supabase
    .from('program_exercises')
    .delete()
    .eq('user_id', userId)
    .eq('day', day);
  if (delErr) throw delErr;

  if (!orderedExerciseIds.length) return;

  const rows = orderedExerciseIds.map((exerciseId, position) => ({
    user_id: userId, day, exercise_id: exerciseId, position
  }));
  const { error: insErr } = await supabase.from('program_exercises').insert(rows);
  if (insErr) throw insErr;
}

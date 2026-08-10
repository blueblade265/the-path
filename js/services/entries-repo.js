// CRUD over training_entries. RLS scopes every query to the signed-in user already
// (see supabase/policies.sql) — no explicit .eq('user_id', ...) is required for
// correctness, but we still pass it through explicitly where useful for clarity/intent.

import { supabase } from '../supabase-client.js';

const TABLE = 'training_entries';

// Full, unfiltered history for one exercise, oldest first — used for the movement
// detail sheet's "every result" view, which is deliberately a complete historical
// record even across a baseline reset (retest).
export async function historyForExercise(userId, exerciseId, targetWeek) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('week, value, sub_value, form_clean')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .lt('week', targetWeek)
    .order('week', { ascending: true });
  if (error) throw error;
  return data;
}

// The single row currently marked is_baseline for this exercise, or null if the
// exercise has never had a baseline logged (fresh account, or since a restart cleared
// it — see calendar-service.js's restartProgram / clearAllBaselines below).
export async function getBaseline(userId, exerciseId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('week, value, sub_value, form_clean')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .eq('is_baseline', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Every current baseline for a user, one row per exercise — the Baselines screen.
export async function allBaselines(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('exercise_id, week, value, sub_value, form_clean, notes')
    .eq('user_id', userId)
    .eq('is_baseline', true);
  if (error) throw error;
  return data;
}

// History for computeRx: the current baseline row (whatever week it's actually on —
// week 0 initially, or a later week after a retest) through targetWeek. This is what
// makes a retest genuinely reset progression math without deleting anything — computeRx
// (progression-engine.js) always treats the lowest-weekIndex row it's given as the
// baseline, so simply not including anything before the real baseline row is enough;
// nothing in the engine itself needs to change.
export async function historyFromBaseline(userId, exerciseId, targetWeek) {
  const baseline = await getBaseline(userId, exerciseId);
  if (!baseline) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('week, value, sub_value, form_clean')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .gte('week', baseline.week)
    .lt('week', targetWeek)
    .order('week', { ascending: true });
  if (error) throw error;
  return data;
}

// All logged exercises for one program week+day (a Session card list).
export async function entriesForDay(userId, week, day) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('week', week)
    .eq('day', day);
  if (error) throw error;
  return data;
}

// Every entry for a user, oldest first — used by insights-service (streaks/consistency)
// and export-service (full dump).
export async function allEntries(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('week', { ascending: true })
    .order('day', { ascending: true });
  if (error) throw error;
  return data;
}

// Log/overwrite the last completed set for one exercise on one program day.
// { userId, week, day, exerciseId, value, subValue, formClean, notes }
export async function logEntry({ userId, week, day, exerciseId, value, subValue, formClean, notes }) {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        week,
        day,
        exercise_id: exerciseId,
        value,
        sub_value: subValue ?? null,
        form_clean: !!formClean,
        notes: notes ?? null
      },
      { onConflict: 'user_id,week,day,exercise_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Bulk-write week-0 baseline rows in one call (see bulk-entry-service.js).
export async function insertMany(rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'user_id,week,day,exercise_id' })
    .select();
  if (error) throw error;
  return data;
}

// Marks one exercise's entry for `week` as ITS current baseline, unsetting any other
// row that held the flag first (the partial unique index on is_baseline would reject
// two true rows for the same exercise otherwise). Used both by the initial Week 0
// bulk-entry save and by completing a retest week.
export async function setBaseline(userId, exerciseId, week) {
  const { error: clearErr } = await supabase
    .from(TABLE)
    .update({ is_baseline: false })
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .neq('week', week);
  if (clearErr) throw clearErr;
  const { error: setErr } = await supabase
    .from(TABLE)
    .update({ is_baseline: true })
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .eq('week', week);
  if (setErr) throw setErr;
}

// Restart-program clears every baseline (not the underlying rows — see
// calendar-service.js's restartProgram) so nothing carries forward as "the" baseline
// until a fresh one is established.
export async function clearAllBaselines(userId) {
  const { error } = await supabase
    .from(TABLE)
    .update({ is_baseline: false })
    .eq('user_id', userId)
    .eq('is_baseline', true);
  if (error) throw error;
}

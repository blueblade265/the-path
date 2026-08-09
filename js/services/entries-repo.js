// CRUD over training_entries. RLS scopes every query to the signed-in user already
// (see supabase/policies.sql) — no explicit .eq('user_id', ...) is required for
// correctness, but we still pass it through explicitly where useful for clarity/intent.

import { supabase } from '../supabase-client.js';

const TABLE = 'training_entries';

// History for one exercise, strictly before targetWeek, ordered ascending — exactly the
// shape rx-service.js needs to feed progression-engine.js's computeRx().
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

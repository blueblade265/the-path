// Derives real calendar dates from an abstract (week, day) pair, per program_settings
// + week_skips, WITHOUT storing a date per training_entries row. Program week numbers
// (and everything progression-engine.js cares about — weekIndex ordering) never change
// when a week is skipped; only the real-world date those exercises land on shifts.
//
// Model: week blocks are anchored to program_settings.start_date ITSELF — week 0's
// first day is exactly start_date (whatever weekday that is), not the Sunday of that
// calendar week. This is deliberate: start_date is literally "Week 0 Day 1," so nothing
// before it is ever part of the program. weekDayForDate() returns null for any date
// before start_date — callers MUST treat null as "before the program began" (not
// schedulable, not loggable, not "missed") rather than falling through to a negative
// week number. Each row in week_skips inserts exactly one extra calendar week of gap
// before the given program week starts. `day` (0=Sunday..6=Saturday, see day-plan.js)
// is a real day-of-week, derived from the date itself — never an offset from start_date.

import { supabase } from '../supabase-client.js';
import { clearAllBaselines } from './entries-repo.js';

export async function getProgramSettings(userId) {
  const { data, error } = await supabase
    .from('program_settings')
    .select('start_date')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { startDate: new Date(data.start_date + 'T00:00:00') } : null;
}

export async function getWeekSkips(userId) {
  const { data, error } = await supabase
    .from('week_skips')
    .select('after_week')
    .eq('user_id', userId)
    .order('after_week', { ascending: true });
  if (error) throw error;
  return data.map(r => r.after_week);
}

// One atomic-in-intent operation: set a new start date, clear every existing skip (a
// skip recorded against the old timeline would misalign every future date once the
// anchor moves), clear every exercise's baseline, and cancel any pending retest — a
// restart is a genuine "start over," so nothing should carry forward as a reference
// point until a fresh Week 0 baseline is logged. The underlying training_entries rows
// themselves are never touched — only is_baseline flags. Per the user's explicit
// "Restart program" requirement — this must never be exposed as separate steps a
// caller could partially apply.
export async function restartProgram(userId, newStartDate) {
  const iso = toISODate(newStartDate);
  const { error: delErr } = await supabase.from('week_skips').delete().eq('user_id', userId);
  if (delErr) throw delErr;
  await clearAllBaselines(userId);
  const { error: upErr } = await supabase
    .from('program_settings')
    .upsert(
      { user_id: userId, start_date: iso, pending_retest_week: null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (upErr) throw upErr;
}

// "Skip week" action (Calendar tab, surfaced on Sundays): insert a 1-calendar-week gap
// before the given program week starts.
export async function skipWeek(userId, afterWeek) {
  const { error } = await supabase
    .from('week_skips')
    .upsert({ user_id: userId, after_week: afterWeek }, { onConflict: 'user_id,after_week' });
  if (error) throw error;
}

function offsetForWeek(week, skips) {
  return skips.filter(w => w < week).length;
}

// date(week, day) = start_date + 7*(week + offset(week)) + (day's offset from
// start_date's own weekday within that 7-day block). week 0, day = start_date's weekday
// always resolves to exactly start_date.
export function dateForWeekDay(startDate, skips, week, day) {
  const startDow = startDate.getDay();
  const dayOffsetInBlock = (day - startDow + 7) % 7;
  return addDays(startDate, 7 * (week + offsetForWeek(week, skips)) + dayOffsetInBlock);
}

// Inverse of dateForWeekDay: given a real date, resolve the program week/day it belongs
// to, or null if the date is before start_date (there is no program week for it — the
// caller must not treat this as week -1, -2, etc.). Skips are sparse, so the iterative
// solve converges in at most (skips.length + 2) steps.
export function weekDayForDate(startDate, skips, date) {
  if (date < startDate) return null;
  const day = date.getDay();
  const daysSinceStart = Math.round((date - startDate) / 86400000);
  const totalBlocksElapsed = Math.floor(daysSinceStart / 7);

  let week = totalBlocksElapsed;
  for (let i = 0; i < skips.length + 2; i++) {
    const candidate = totalBlocksElapsed - offsetForWeek(week, skips);
    if (candidate === week) break;
    week = candidate;
  }
  return { week, day };
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

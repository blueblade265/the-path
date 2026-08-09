// Derives real calendar dates from an abstract (week, day) pair, per program_settings
// + week_skips, WITHOUT storing a date per training_entries row. Program week numbers
// (and everything progression-engine.js cares about — weekIndex ordering) never change
// when a week is skipped; only the real-world date those exercises land on shifts.
//
// Model: `week` blocks are calendar-week-aligned to program_settings.start_date's own
// weekday. Each row in week_skips inserts exactly one extra calendar week of gap before
// the given program week starts. `day` (0=Sunday..6=Saturday, see day-plan.js) is a real
// day-of-week, not an offset from start_date.

import { supabase } from '../supabase-client.js';

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

// One atomic-in-intent operation: set a new start date AND clear every existing skip,
// because a skip recorded against the old timeline would misalign every future date
// once the anchor moves. Per the user's explicit "Restart program" requirement — this
// must never be exposed as two separate steps a caller could partially apply.
export async function restartProgram(userId, newStartDate) {
  const iso = toISODate(newStartDate);
  const { error: delErr } = await supabase.from('week_skips').delete().eq('user_id', userId);
  if (delErr) throw delErr;
  const { error: upErr } = await supabase
    .from('program_settings')
    .upsert({ user_id: userId, start_date: iso, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
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

// date(week, day) = the Sunday of week `week`'s calendar block, plus `day`.
export function dateForWeekDay(startDate, skips, week, day) {
  const startDow = startDate.getDay();
  const blockStart = addDays(startDate, 7 * (week + offsetForWeek(week, skips)));
  const sundayOfBlock = addDays(blockStart, -startDow);
  return addDays(sundayOfBlock, day);
}

// Inverse of dateForWeekDay: given a real date, resolve the program week/day it belongs
// to. Skips are sparse, so this converges in at most (skips.length + 2) iterations.
export function weekDayForDate(startDate, skips, date) {
  const day = date.getDay();
  const startDow = startDate.getDay();
  const sundayOfStart = addDays(startDate, -startDow);
  const sundayOfDate = addDays(date, -day);
  const calendarWeeksElapsed = Math.round((sundayOfDate - sundayOfStart) / (7 * 86400000));

  let week = calendarWeeksElapsed;
  for (let i = 0; i < skips.length + 2; i++) {
    const candidate = calendarWeeksElapsed - offsetForWeek(week, skips);
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

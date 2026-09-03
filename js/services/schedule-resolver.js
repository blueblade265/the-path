// Pure resolution of the *effective* per-day program plan and reschedule state for a
// given program week. No Supabase imports on purpose — synchronous, side-effect free, so
// every screen resolves "what actually runs on day D of week W" the same way.
import { dateForWeekDay } from './calendar-service.js';

export const OPEN_DAY = Object.freeze({ title: 'Open', exerciseIds: [], rest: true, open: true });

export function slotAt(overrides, week, day) {
  const o = overrides.get(`${week}:${day}`);
  return o ? o.slot : day;
}
export function originOf(overrides, week, day) {
  const o = overrides.get(`${week}:${day}`);
  return o ? o.originDay : day;
}
export function planAt(dayPlan, overrides, week, day) {
  return slotAt(overrides, week, day) === null ? OPEN_DAY : dayPlan[originOf(overrides, week, day)];
}
export function idsAt(dayPlan, overrides, week, day) {
  return planAt(dayPlan, overrides, week, day).exerciseIds;
}
export function isMoved(overrides, week, day) {
  return slotAt(overrides, week, day) !== day || originOf(overrides, week, day) !== day;
}
export function weekDates(week) {
  return [0, 1, 2, 3, 4, 5, 6].map(day => ({ week, day }));
}
export function isDayDone(entries, ids, week, day) {
  return ids.length > 0 && ids.every(id => entries.some(e => e.week === week && e.day === day && e.exercise_id === id));
}
export function shiftable(dayPlan, overrides, entries, week, startDate, skips, today) {
  return weekDates(week)
    .filter(({ day }) => {
      const cmp = dateForWeekDay(startDate, skips, week, day);
      cmp.setHours(0, 0, 0, 0);
      if (cmp < today) return false;
      return !isDayDone(entries, idsAt(dayPlan, overrides, week, day), week, day);
    })
    .sort((a, b) => dateForWeekDay(startDate, skips, week, a.day) - dateForWeekDay(startDate, skips, week, b.day));
}
export function buildMovePayload(dayPlan, overrides, week, from, to) {
  const targetHasContent = idsAt(dayPlan, overrides, week, to).length > 0;
  if (targetHasContent) {
    return [
      { day: to, slot: slotAt(overrides, week, from), originDay: originOf(overrides, week, from), fromDay: from },
      { day: from, slot: slotAt(overrides, week, to), originDay: originOf(overrides, week, to), fromDay: to }
    ];
  }
  return [
    { day: to, slot: slotAt(overrides, week, from), originDay: originOf(overrides, week, from), fromDay: from },
    { day: from, slot: null, originDay: from, fromDay: null }
  ];
}
export function buildShiftPayload(dayPlan, overrides, entries, week, startDate, skips, today, dir) {
  const dates = shiftable(dayPlan, overrides, entries, week, startDate, skips, today);
  if (dates.length < 2) return null;
  const snapshot = dates.map(({ day }) => ({ day, slot: slotAt(overrides, week, day), origin: originOf(overrides, week, day) }));
  const n = dates.length;
  return dates.map(({ day }, i) => {
    const src = snapshot[((i - dir) % n + n) % n];
    return { day, slot: src.slot, originDay: src.slot == null ? day : src.origin, fromDay: src.day };
  });
}

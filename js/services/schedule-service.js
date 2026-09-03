import { supabase } from '../supabase-client.js';
const TABLE = 'schedule_overrides';

export async function getScheduleOverrides(userId) {
  const { data, error } = await supabase.from(TABLE).select('week, day, slot, origin_day').eq('user_id', userId);
  if (error) throw error;
  return data;
}
export function overridesToMap(rows) {
  const map = new Map();
  for (const r of rows) map.set(`${r.week}:${r.day}`, { slot: r.slot, originDay: r.origin_day });
  return map;
}
export async function applyReschedule(week, rows) {
  const { error } = await supabase.rpc('reschedule_apply', {
    p_week: week,
    p_rows: rows.map(r => ({ day: r.day, slot: r.slot, origin_day: r.originDay, from_day: r.fromDay ?? null }))
  });
  if (error) throw error;
}
export async function resetWeek(week) {
  const { error } = await supabase.rpc('reschedule_reset', { p_week: week });
  if (error) throw error;
}

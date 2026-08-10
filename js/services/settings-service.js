// Rest-timer preferences, per user. Lives on program_settings (already a per-user,
// RLS'd, one-row table) rather than a new table just for two numbers — see
// supabase/migration_002_rest_settings.sql for existing projects.

import { supabase } from '../supabase-client.js';

export async function getRestSettings(userId) {
  const { data, error } = await supabase
    .from('program_settings')
    .select('rest_seconds_load, rest_seconds_default')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return {
    load: data?.rest_seconds_load ?? 180,
    default: data?.rest_seconds_default ?? 90
  };
}

// The program_settings row always exists by the time this can be called (onboarding
// creates it before any tab renders), so a plain update is safe — no upsert needed.
export async function setRestSettings(userId, { load, default: defaultSeconds }) {
  const { error } = await supabase
    .from('program_settings')
    .update({
      rest_seconds_load: load,
      rest_seconds_default: defaultSeconds,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);
  if (error) throw error;
}

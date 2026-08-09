// Checks the allowed_users gate. RLS restricts every signed-in user to reading only
// their own row here (see supabase/policies.sql) — this never sees the full roster.

import { supabase } from '../supabase-client.js';

export async function isApproved(email) {
  if (!email) return false;
  const { data, error } = await supabase
    .from('allowed_users')
    .select('active')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return !!data && data.active === true;
}

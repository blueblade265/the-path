// Supabase client init + auth helpers. Requires js/config.js to have run first
// (index.html loads it via a plain <script> tag before this module).

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.__CONFIG__;
if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing js/config.js. For local dev: copy js/config.example.js to js/config.js ' +
    'and fill in your Supabase project URL/anon key. In production this is generated ' +
    'by the deploy workflow — see README.'
  );
}

export const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
}

export function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// Fires immediately with the current state, then again on every future change
// (sign-in, sign-out, token refresh). Callback receives the Session or null.
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

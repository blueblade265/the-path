// "Today's active session" — persisted to localStorage, this device only. NOT the same
// thing as training_entries in Supabase: that table only ever holds the LAST completed
// set per (user, week, day, exercise), by original design. This is the ONLY place "2 of
// 3 sets done this session" exists at all — everything (chip counts, the form-clean
// gate, notes, which timer phase is running and when it ends) is reconstructed from here
// on every render, so it survives a reload or switching to another in-app tab and back,
// not just staying in memory for one render pass.
//
// Known, accepted limitation: two tabs of the same account open at once on the same
// device is last-write-wins, no locking. Fine for a personal single-user log — the
// realistic collision (two tabs logging the same exercise at the same instant) is
// vanishingly unlikely, and nothing is lost from the database either way, since
// logEntry still fires independently from wherever it's called.

import { playChime } from '../lib/chime.js';

const MAX_SETS = 3;
const memoryFallback = new Map();
let warnedOnce = false;

function storageKey(userId, week, day) {
  return `the-path:active-session:${userId}:${week}:${day}`;
}

function safeRead(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    if (!warnedOnce) { warnedOnce = true; console.warn('localStorage unavailable — active session state will not survive a reload this visit.'); }
    return memoryFallback.get(key) ?? null;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    memoryFallback.set(key, value);
  }
}

export function loadSession(userId, week, day) {
  const raw = safeRead(storageKey(userId, week, day));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function save(userId, week, day, state) {
  safeWrite(storageKey(userId, week, day), JSON.stringify(state));
  return state;
}

// Idempotent — resumes an existing session rather than clobbering it. Safe to call from
// multiple entry points (Home's one-tap Start Session, Session tab's own direct-entry
// banner) without them needing to coordinate.
export function startSession(userId, week, day) {
  const existing = loadSession(userId, week, day);
  if (existing) return existing;
  return save(userId, week, day, { status: 'active', startedAt: Date.now(), completedAt: null, exercises: {} });
}

export function sessionStatusFor(userId, week, day) {
  return loadSession(userId, week, day)?.status ?? 'none';
}

// Seeds from the DB row (dbFallback — entriesForDay's `existing`) when the session has
// nothing yet for this exercise, so a freshly-started session with a pre-existing DB
// entry for today still shows correctly instead of blank.
export function getExerciseState(state, exerciseId, dbFallback) {
  const existing = state?.exercises?.[exerciseId];
  if (existing) return existing;
  // No session-state for this exercise yet — e.g. a freshly (re)started session, or
  // localStorage was lost mid-session while the DB row survived. Seed setsCompleted
  // from the DB row too, not just formClean/notes: the DB only ever holds the LAST
  // completed set, but "at least the one we know about" is real signal that shouldn't
  // be silently dropped back to an empty chip row.
  return {
    setsCompleted: dbFallback ? [{ value: dbFallback.value, subValue: dbFallback.sub_value ?? null }] : [],
    formClean: dbFallback?.form_clean ?? true,
    notes: dbFallback?.notes ?? '',
    phase: null
  };
}

export function updateExercise(userId, week, day, exerciseId, patch) {
  const state = loadSession(userId, week, day) || startSession(userId, week, day);
  const current = getExerciseState(state, exerciseId, null);
  state.exercises[exerciseId] = { ...current, ...patch };
  return save(userId, week, day, state);
}

// Records a completed set and clears whatever phase led to it, in one write.
export function addCompletedSet(userId, week, day, exerciseId, set) {
  const state = loadSession(userId, week, day) || startSession(userId, week, day);
  const current = getExerciseState(state, exerciseId, null);
  const setsCompleted = current.setsCompleted.length < MAX_SETS
    ? [...current.setsCompleted, set]
    : [...current.setsCompleted.slice(0, MAX_SETS - 1), set];
  state.exercises[exerciseId] = { ...current, setsCompleted, phase: null };
  return save(userId, week, day, state);
}

export function setPhase(userId, week, day, exerciseId, phase) {
  return updateExercise(userId, week, day, exerciseId, { phase });
}

export function clearPhase(userId, week, day, exerciseId) {
  return updateExercise(userId, week, day, exerciseId, { phase: null });
}

// Flips to completed. First re-pushes every exercise's last known set through
// logEntryFn — a reconciliation safety net in case any individual logEntry call
// silently failed mid-session (network blip, etc.). Failures here are logged and
// skipped rather than aborting the whole completion — the point is to finish closing
// out the day, not get stuck on one bad write.
export async function completeSession(userId, week, day, logEntryFn) {
  const state = loadSession(userId, week, day) || startSession(userId, week, day);
  for (const [exerciseId, ex] of Object.entries(state.exercises)) {
    if (!ex.setsCompleted.length) continue;
    const last = ex.setsCompleted[ex.setsCompleted.length - 1];
    try {
      await logEntryFn({ userId, week, day, exerciseId, value: last.value, subValue: last.subValue ?? null, formClean: ex.formClean, notes: ex.notes });
    } catch (err) {
      console.error(`Complete Session: failed to reconcile ${exerciseId}`, err);
    }
  }
  state.status = 'completed';
  state.completedAt = Date.now();
  for (const ex of Object.values(state.exercises)) ex.phase = null;
  return save(userId, week, day, state);
}

// Boot-time only: chimes once if some exercise's timer phase already elapsed while the
// app was fully closed/backgrounded. Does NOT attempt to advance the state machine
// itself — that's tab-session.js's job, whenever Session is actually opened and
// reconstructs live from this same stored state.
export function catchUpActiveSession(userId, week, day) {
  const state = loadSession(userId, week, day);
  if (!state || state.status !== 'active') return;
  const now = Date.now();
  for (const ex of Object.values(state.exercises)) {
    if (ex.phase && ex.phase.endAt <= now) {
      playChime();
      break; // one chime is enough to signal "something finished while you were away"
    }
  }
}

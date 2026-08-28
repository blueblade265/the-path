// Streak / tier-ladder-progress / consistency logic — NONE of this exists in
// progression-engine.js. The mockup's versions were hardcoded mock arrays, not real
// derivations; this is genuinely new code, not a port.
//
// Resolved scope decisions (undocumented in the mockup, decided here):
//  - Streak is whole-program-week, not per-exercise: a week counts as "clean" only if
//    every exercise logged that week had form_clean=true, matching the mockup's own
//    detail-sheet copy ("Week 6 — all five movements clean").
//
// No more "N clean weeks away" forecast — that predicted a stage auto-advance, which no
// longer happens (see progression-engine.js's RULES.TIER: stage is fixed at whatever the
// baseline says until a manual "Advance to next stage" action moves it). Predicting a
// timeline for a manual decision doesn't mean anything, so tierProgress below just
// reports the current stage directly from the is_baseline row — no streak simulation.

import { EXERCISES, exerciseType, exerciseTiers } from '../data/exercises.js';
import { allEntries } from './entries-repo.js';

// Consecutive most-recent clean weeks, walking backward from the latest logged week.
// A week only counts if it has at least one entry AND every entry that week is clean;
// the first week (going backward) that fails either condition ends the streak.
export function computeStreak(entries) {
  if (!entries.length) return 0;
  const byWeek = groupBy(entries, e => e.week);
  const weeks = [...byWeek.keys()].sort((a, b) => b - a);
  let streak = 0;
  for (const w of weeks) {
    const weekEntries = byWeek.get(w);
    const allClean = weekEntries.length > 0 && weekEntries.every(e => e.form_clean);
    if (!allClean) break;
    streak++;
  }
  return streak;
}

// Current stage read straight from the is_baseline row — stage only ever moves via the
// user's own manual "Advance to next stage" action (baseline-service.js's advanceStage),
// which itself moves the baseline, so there's nothing to simulate/derive here.
function tierProgress(exerciseId, historyRows) {
  const tiers = exerciseTiers(exerciseId);
  if (!tiers || !historyRows.length) return null;
  const baselineRow = historyRows.find(r => r.is_baseline);
  if (!baselineRow || baselineRow.value == null) return null;
  const idx = Math.min(Math.max(Math.round(baselineRow.value), 0), tiers.length - 1);
  const atTop = idx >= tiers.length - 1;
  return {
    exerciseId,
    tierIndex: idx,
    tierCount: tiers.length,
    tierNames: tiers,
    tierName: tiers[idx],
    nextTierName: atTop ? null : tiers[idx + 1]
  };
}

// Progress for every TIER exercise that has a baseline — the Insights tab's "every
// ladder" list.
export function allTierProgress(entries) {
  const byExercise = groupBy(entries, e => e.exercise_id);
  const results = [];
  for (const id of Object.keys(EXERCISES)) {
    if (exerciseType(id) !== 'TIER') continue;
    const rows = byExercise.get(id) || [];
    const progress = tierProgress(id, rows);
    if (progress) results.push(progress);
  }
  return results;
}

// scheduledSlots: [{week, day}] for non-rest program days already due (date <= today),
// computed by the caller via calendar-service + day-plan (insights-service stays pure
// w.r.t. calendar math). Returns heatmap cells plus a "most-missed weekday" note, in the
// spirit of the mockup's "four of them Thursdays" observation.
export function buildConsistency(entries, scheduledSlots) {
  const logged = new Set(entries.map(e => `${e.week}:${e.day}`));
  const cells = scheduledSlots.map(s => ({
    week: s.week,
    day: s.day,
    logged: logged.has(`${s.week}:${s.day}`)
  }));
  const missed = cells.filter(c => !c.logged);
  const missedByDow = groupBy(missed, c => c.day);
  let worstDow = null, worstCount = 0;
  for (const [dow, list] of missedByDow) {
    if (list.length > worstCount) { worstCount = list.length; worstDow = dow; }
  }
  return {
    loggedCount: cells.length - missed.length,
    scheduledCount: cells.length,
    cells,
    missedCount: missed.length,
    worstDayOfWeek: worstDow,
    worstDayCount: worstCount
  };
}

// Convenience: fetch + compute everything the Home/Insights tabs need in one call.
export async function loadInsights(userId, scheduledSlots) {
  const entries = await allEntries(userId);
  const streak = computeStreak(entries);
  const consistency = buildConsistency(entries, scheduledSlots);
  return { entries, streak, consistency };
}

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

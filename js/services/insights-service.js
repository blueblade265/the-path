// Streak / "chasing" / consistency / forecast logic — NONE of this exists in
// progression-engine.js. The mockup's versions of all four were hardcoded mock arrays,
// not real derivations; this is genuinely new code, not a port.
//
// Resolved scope decisions (undocumented in the mockup, decided here):
//  - Streak is whole-program-week, not per-exercise: a week counts as "clean" only if
//    every exercise logged that week had form_clean=true, matching the mockup's own
//    detail-sheet copy ("Week 6 — all five movements clean").
//  - Forecasts NEVER surface a calendar date, only "N clean weeks away" — this was an
//    explicit design principle stated in the mockup itself (a date would falsely assume
//    no future form breaks).

import { CONFIG } from '../lib/progression-engine.js';
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

// Replicates progression-engine.js's TIER advance logic (RULES.TIER) just enough to
// report current stage + clean-streak-at-stage, without duplicating the prescription
// text itself (that stays owned by computeRx via rx-service.js).
function tierProgress(exerciseId, historyRows) {
  const tiers = exerciseTiers(exerciseId);
  if (!tiers || !historyRows.length) return null;
  const sorted = [...historyRows].sort((a, b) => a.week - b.week);
  const baseline = sorted[0].value;
  if (baseline == null) return null;
  let idx = Math.min(Math.max(Math.round(baseline), 0), tiers.length - 1);
  let streak = 0;
  for (const row of sorted.slice(1)) {
    if (row.form_clean) {
      streak++;
      if (streak >= CONFIG.TIER_CLEAN_WEEKS_TO_ADVANCE && idx < tiers.length - 1) {
        idx++;
        streak = 0;
      }
    } else {
      streak = 0;
    }
  }
  const atTop = idx >= tiers.length - 1;
  return {
    exerciseId,
    tierIndex: idx,
    tierCount: tiers.length,
    tierNames: tiers,
    tierName: tiers[idx],
    nextTierName: atTop ? null : tiers[idx + 1],
    weeksToAdvance: atTop ? null : Math.max(0, CONFIG.TIER_CLEAN_WEEKS_TO_ADVANCE - streak)
  };
}

// Progress for every TIER exercise that has a baseline, regardless of whether it's
// still advancing (used by the Insights tab's "every ladder" list; findChasing below
// narrows this to the single closest one for the Home tab's "Chasing" card).
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

// The single TIER exercise closest to its next stage (smallest weeksToAdvance), or null
// if nothing is currently in progress (no baselines yet, or everything already maxed).
export function findChasing(entries) {
  const byExercise = groupBy(entries, e => e.exercise_id);
  const candidates = [];
  for (const id of Object.keys(EXERCISES)) {
    if (exerciseType(id) !== 'TIER') continue;
    const rows = byExercise.get(id) || [];
    const progress = tierProgress(id, rows);
    if (progress && progress.weeksToAdvance != null) candidates.push(progress);
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.weeksToAdvance - b.weeksToAdvance);
  return candidates[0];
}

// Never a calendar date, per the mockup's own stated design principle.
export function forecastText(weeksToAdvance) {
  if (weeksToAdvance == null) return null;
  if (weeksToAdvance <= 1) return 'One clean week away — if it is clean.';
  return `${weeksToAdvance} clean weeks away — every one clean.`;
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
  const chasing = findChasing(entries);
  const consistency = buildConsistency(entries, scheduledSlots);
  return { entries, streak, chasing, consistency };
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

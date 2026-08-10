// ══════════════════════════════════════════════════════════════════
// THE PATH — PROGRESSION ENGINE (standalone module)
//
// App copy of ../../../progression_engine_v1.js. The RULES/CONFIG algorithm below is
// untouched — only two RULE_MAP entries (squat-hold, side-lever) were reclassified from
// HOLD_TIME to TIER per a real content correction (search "TODO(user)"). If the upstream
// source file changes, re-apply that same two-entry diff rather than overwriting wholesale.
//
// Extracted verbatim from the tested artifact. This is the coaching brain:
// it reads a user's prior logged results and computes next week's targets.
// Storage-agnostic — it does not know or care whether entries come from
// window.storage, Supabase, or anywhere else. Feed it an array of entries;
// it returns a prescription. Swapping the data layer never touches this file.
//
// ── INTERFACE ─────────────────────────────────────────────────────
// computeRx(exerciseId, priorEntries) → { text, why } | null
//
//   exerciseId    string, e.g. 'front-lever'  (see RULE_MAP for the full set)
//   priorEntries  array of entry objects from ALL weeks BEFORE the target week,
//                 each shaped:
//                   {
//                     id:        string   (exercise id)
//                     value:     number   (primary result: seconds, reps, lbs, or tier index)
//                     subValue:  number   (tier exercises only: perf at that stage)
//                     formClean: boolean  (did form hold the whole set)
//                     weekIndex: number   (0 = Week 0 baseline, ascending)
//                   }
//
//   The FIRST entry for an exercise (lowest weekIndex) is treated as the
//   baseline. Every later entry with formClean:true advances progression.
//   A non-clean week does NOT advance (and, for tiers, resets the streak).
//
// Returns null when no baseline exists yet (→ UI should show "awaiting baseline").
//
// ── PORTING NOTES FOR SUPABASE BUILD ──────────────────────────────
// • Query training_entries WHERE user_id = <current user> AND week < <target>,
//   ORDER BY week ASC, map rows to the entry shape above, pass to computeRx.
// • RLS guarantees each user only sees their own rows, so the same call
//   yields per-user prescriptions with no per-user code.
// • This module has ZERO dependencies. Import as-is.
// ══════════════════════════════════════════════════════════════════

const CONFIG = {
  WORKING_FRACTION_HOLD: 0.60,   // working hold = 60% of tested max (can't train 3 sets at max)
  WORKING_FRACTION_REPS: 0.60,   // working reps = 60% of tested max
  HOLD_WEEKLY_GAIN: 0.10,        // +10%/wk — conservative: connective tissue is the rate limiter
  HOLD_ROUND_SEC: 5,
  HOLD_CEILING_SEC: 60,          // past this, add difficulty (tier) not duration
  REPS_CLEAN_WEEKS_TO_ADD: 2,    // double progression: 2 clean weeks before +1 rep
  LOAD_WORKING_PCT: 0.80,        // working sets at 80% of tested top set
  LOAD_ROUND_LB: 5,
  LOAD_STEP_LOWER: 10,           // squat/deadlift weekly step
  LOAD_STEP_UPPER: 5,            // bench/press weekly step
  DEFAULT_SETS: 3,
  TIER_CLEAN_WEEKS_TO_ADVANCE: 2
};

const RULES = {
  HOLD_TIME(baseline, history){
    if(baseline == null) return null;
    let working = baseline * CONFIG.WORKING_FRACTION_HOLD;
    const cleanWeeks = history.filter(h => h.formClean).length;
    working = working * Math.pow(1 + CONFIG.HOLD_WEEKLY_GAIN, cleanWeeks);
    let t = Math.round(working / CONFIG.HOLD_ROUND_SEC) * CONFIG.HOLD_ROUND_SEC;
    t = Math.max(t, CONFIG.HOLD_ROUND_SEC);
    if(t >= CONFIG.HOLD_CEILING_SEC){
      return { text: `${CONFIG.DEFAULT_SETS} × ${CONFIG.HOLD_CEILING_SEC}s`,
               why: `Hit the ${CONFIG.HOLD_CEILING_SEC}s ceiling — progress by making the position harder, not longer. Flag this at next check-in.` };
    }
    return { text: `${CONFIG.DEFAULT_SETS} × ${t}s`,
             why: cleanWeeks === 0
               ? `60% of your tested max (${baseline}s). Working sets, not max efforts.`
               : `${cleanWeeks} clean week${cleanWeeks>1?'s':''} logged → +10% compounding from your ${baseline}s baseline.` };
  },

  REPS(baseline, history){
    if(baseline == null) return null;
    if(baseline === 0){
      return { text:'Regression work — assisted / eccentric only',
               why:'Baseline was 0 clean reps. Build with band assistance or slow negatives before rep targets apply.' };
    }
    let target = Math.max(1, Math.floor(baseline * CONFIG.WORKING_FRACTION_REPS));
    const cleanWeeks = history.filter(h => h.formClean).length;
    target += Math.floor(cleanWeeks / CONFIG.REPS_CLEAN_WEEKS_TO_ADD);
    return { text: `${CONFIG.DEFAULT_SETS} × ${target}`,
             why: cleanWeeks === 0
               ? `60% of your ${baseline}-rep tested max. Every rep at your standard — a clean 2 beats a sloppy 10.`
               : `${cleanWeeks} clean week${cleanWeeks>1?'s':''} → +1 rep per 2 clean weeks (double progression).` };
  },

  LOAD(baseline, history, params){
    if(baseline == null) return null;
    const step = params && params.upper ? CONFIG.LOAD_STEP_UPPER : CONFIG.LOAD_STEP_LOWER;
    const cleanWeeks = history.filter(h => h.formClean).length;
    let load = baseline * CONFIG.LOAD_WORKING_PCT + (cleanWeeks * step);
    load = Math.round(load / CONFIG.LOAD_ROUND_LB) * CONFIG.LOAD_ROUND_LB;
    return { text: `${CONFIG.DEFAULT_SETS} × 3 @ ${load} lb`,
             why: cleanWeeks === 0
               ? `80% of your ${baseline} lb tested top set. Raw — no belt, no straps.`
               : `${cleanWeeks} clean week${cleanWeeks>1?'s':''} → +${step} lb/wk from an 80% start.` };
  },

  TIER(baselineTierIndex, history, params, baselineSub){
    if(baselineTierIndex == null) return null;
    const tiers = params.tiers;
    const isHold = (params.subUnit || 'sec') === 'sec';
    let idx = baselineTierIndex;
    let streak = 0;
    let advanced = false;
    let weeksAtCurrent = 0;
    history.forEach(h => {
      if(h.formClean){
        streak++; weeksAtCurrent++;
        if(streak >= CONFIG.TIER_CLEAN_WEEKS_TO_ADVANCE && idx < tiers.length - 1){
          idx++; streak = 0; weeksAtCurrent = 0; advanced = true;
        }
      } else { streak = 0; }
    });

    // Performance target at the current stage. Advancing a stage resets the
    // target to a conservative starting point — the harder position is the
    // new stimulus, so demanding the old duration/reps on it would be a jump
    // in two variables at once.
    let target;
    if(advanced){
      target = isHold ? 10 : 3;
    } else if(baselineSub != null && baselineSub > 0){
      const base = baselineSub * (isHold ? CONFIG.WORKING_FRACTION_HOLD : CONFIG.WORKING_FRACTION_REPS);
      if(isHold){
        const grown = base * Math.pow(1 + CONFIG.HOLD_WEEKLY_GAIN, weeksAtCurrent);
        target = Math.max(5, Math.round(grown / CONFIG.HOLD_ROUND_SEC) * CONFIG.HOLD_ROUND_SEC);
      } else {
        target = Math.max(1, Math.floor(base) + Math.floor(weeksAtCurrent / CONFIG.REPS_CLEAN_WEEKS_TO_ADD));
      }
    } else {
      target = isHold ? 10 : 3;
    }

    const unitTxt = isHold ? `${target}s` : `${target}`;
    const nextTier = tiers[Math.min(idx+1, tiers.length-1)];
    return {
      text: `${tiers[idx]} — ${CONFIG.DEFAULT_SETS} × ${unitTxt}`,
      why: advanced
        ? `Advanced from "${tiers[baselineTierIndex]}" on clean-form weeks — target reset because the position itself got harder.`
        : (baselineSub != null && baselineSub > 0
            ? `From your Week 0 ${baselineSub}${isHold?'s':' reps'} at this stage. ${CONFIG.TIER_CLEAN_WEEKS_TO_ADVANCE} consecutive clean weeks advances you to "${nextTier}".`
            : `No performance logged at this stage yet — starting conservative. ${CONFIG.TIER_CLEAN_WEEKS_TO_ADVANCE} clean weeks advances you to "${nextTier}".`)
    };
  },

  SCREEN(){
    return { text:'Re-screen — record ranges & asymmetry', why:'Mobility screen, not a load target. Compare against your Week 0 notes.' };
  }
};

// exercise id → rule type, input unit, and any params
const RULE_MAP = {
  'back-squat':   { type:'LOAD', unit:'lb', params:{upper:false} },
  'deadlift':     { type:'LOAD', unit:'lb', params:{upper:false} },
  'bench-press':  { type:'LOAD', unit:'lb', params:{upper:true} },
  'hollow-hold':        { type:'HOLD_TIME', unit:'sec' },
  'pushup-bottom-hold': { type:'HOLD_TIME', unit:'sec' },
  'ring-support-hold':  { type:'HOLD_TIME', unit:'sec' },
  'pike-handstand-hold':{ type:'HOLD_TIME', unit:'sec' },
  'scapular-pullup':    { type:'REPS', unit:'reps' },
  'dead-hang':    { type:'HOLD_TIME', unit:'sec' },
  'active-hang':  { type:'HOLD_TIME', unit:'sec' },
  'front-lever':  { type:'TIER', unit:'tier', params:{ subUnit:'sec', tiers:['Not yet achievable — eccentric entry','Tuck','Advanced Tuck','One-Leg','Straddle','Full'] } },
  'ring-row':     { type:'REPS', unit:'reps' },
  'pull-up':      { type:'REPS', unit:'reps' },
  // TODO(user): replace placeholder tier names with the real Horse Stance ladder.
  'squat-hold':   { type:'TIER', unit:'tier', params:{ subUnit:'sec', tiers:['Wall Assisted','Free Standing','Weighted'] } },
  'pistol-squat': { type:'TIER', unit:'tier', params:{ subUnit:'reps', tiers:['Box-Assisted (high)','Box-Assisted (low)','Band-Assisted','Full'] } },
  'single-leg-balance': { type:'HOLD_TIME', unit:'sec' },
  'nordic-curl':  { type:'TIER', unit:'tier', params:{ subUnit:'reps', tiers:['Ball Rollout','Ground Push','Banded','Full'] } },
  'calf-raise-hold':{ type:'HOLD_TIME', unit:'sec' },
  'l-sit':        { type:'TIER', unit:'tier', params:{ subUnit:'sec', tiers:['Tuck L-Sit','One-Leg Extended','Full L-Sit'] } },
  'dragon-flag':  { type:'TIER', unit:'tier', params:{ subUnit:'reps', tiers:['Tuck','Advanced Tuck','Single-Leg','Straddle','Full'] } },
  // TODO(user): "Side Plank" is the confirmed first stage; replace the remaining
  // placeholders with the real Side Lever ladder.
  'side-lever':   { type:'TIER', unit:'tier', params:{ subUnit:'sec', tiers:['Side Plank','Side Plank-Feet Elevated','Tucked','Advanced Tuck','Single-Leg','Straddle','Full'] } },
  'toes-to-bar':  { type:'TIER', unit:'tier', params:{ subUnit:'reps', tiers:['Tucked','Single Leg','Half Up','Full'] } },
  'hollow-hold-retest': { type:'HOLD_TIME', unit:'sec' },
  'screen-shoulder-flexion':{ type:'SCREEN', unit:'note' },
  'screen-shoulder-rotation':{ type:'SCREEN', unit:'note' },
  'screen-ohs':{ type:'SCREEN', unit:'note' },
  'screen-couch-stretch':{ type:'SCREEN', unit:'note' },
  'screen-aslr':{ type:'SCREEN', unit:'note' },
  'screen-thoracic-rotation':{ type:'SCREEN', unit:'note' }
};

// Parse legacy free-text Week 0 entries ("34s", "155lb x2", "2 min") into a number.
function parseLegacy(str){
  if(!str) return null;
  const s = String(str).toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if(!m) return null;
  let n = parseFloat(m[1]);
  if(/\bmin\b|\bminute/.test(s) && n < 20) n = n * 60;
  return n;
}

// Compute a prescription for one exercise from this account's own stored history.
function computeRx(exerciseId, allEntries){
  const rule = RULE_MAP[exerciseId];
  if(!rule) return null;
  const hist = allEntries.filter(e => e.id === exerciseId).sort((a,b) => a.weekIndex - b.weekIndex);
  if(hist.length === 0) return null;
  const baselineEntry = hist[0];
  let baseline = baselineEntry.value != null ? baselineEntry.value : parseLegacy(baselineEntry.result);
  const later = hist.slice(1);
  if(rule.type === 'SCREEN') return RULES.SCREEN();
  if(rule.type === 'TIER'){
    const idx = baseline != null ? Math.min(Math.max(Math.round(baseline),0), rule.params.tiers.length-1) : 0;
    return RULES.TIER(idx, later, rule.params, baselineEntry.subValue);
  }
  if(baseline == null) return null;
  if(rule.type === 'HOLD_TIME') return RULES.HOLD_TIME(baseline, later);
  if(rule.type === 'REPS') return RULES.REPS(baseline, later);
  if(rule.type === 'LOAD') return RULES.LOAD(baseline, later, rule.params);
  return null;
}

// Node/module export (harmless in browser if wrapped by bundler; remove for raw <script> use)
if (typeof module !== 'undefined' && module.exports) { module.exports = { CONFIG, RULES, RULE_MAP, parseLegacy, computeRx }; }

// ES module export — added for this app's browser usage (import { computeRx } from ...).
// The CommonJS block above is untouched so the file still works unmodified in a Node
// REPL for the parity check described in the plan's verification section.
export { CONFIG, RULES, RULE_MAP, parseLegacy, computeRx };

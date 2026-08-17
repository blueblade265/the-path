// The Path — canonical exercise catalog.
//
// RULE_MAP (progression-engine.js) is the source of truth for `type`/`tiers` — every key
// here MUST match a RULE_MAP key exactly, or computeRx() silently returns null for it.
// Everything else here (name, coaching copy, cues, abort condition, stepper unit/step) is
// UI/display metadata reconciled from the design mockup (The Path v3.dc.html) against the
// real RULE_MAP, per the plan's reconciliation table.
//   - screen-couch-stretch / screen-thoracic-rotation have no mockup source at all —
//     their copy is freshly authored, not ported.

import { RULE_MAP } from '../lib/progression-engine.js';

export const EXERCISES = {
  'back-squat': {
    name: 'Back Squat', unit: 'pounds', step: 5, suffix: ' lb',
    coach: 'Three triples. Stop when the bar slows.',
    cues: ['Brace before you unrack, not after.', 'Same depth every rep — film it if you are unsure.'],
    abort: 'Heels lift, knees cave, or depth shortens.'
  },
  'deadlift': {
    name: 'Deadlift', unit: 'pounds', step: 5, suffix: ' lb',
    coach: 'Three reps. Stop the set when the back rounds.',
    cues: ['Bar against the shins, lats set before the pull.', 'Every rep starts from a dead stop.'],
    abort: 'Lower back rounds, or the pull hitches.'
  },
  'bench-press': {
    name: 'Bench Press', unit: 'pounds', step: 5, suffix: ' lb',
    coach: 'Three reps. Raw — no belt, no wraps.',
    cues: ['Feet planted, shoulder blades pinned.', 'Same bar path every rep, controlled down.'],
    abort: 'Bar path drifts or the descent goes uncontrolled.'
  },
  'hollow-hold': {
    name: 'Hollow Body Hold', unit: 'seconds held', step: 5, suffix: 's',
    coach: 'Stop when the low back lifts.',
    cues: ['Low back pressed flat, arms overhead.', 'Legs hover about three inches.'],
    abort: 'The low back peels off the floor.'
  },
  'pushup-bottom-hold': {
    name: 'Push-Up Bottom Hold', unit: 'seconds held', step: 5, suffix: 's',
    coach: 'Hold at the bottom. Stop when the hips sag.',
    cues: ['Chest just above the floor, elbows near 45°.', 'Body is one straight line, glutes on.'],
    abort: 'Hips sag, or the shoulders shrug up.'
  },
  'ring-support-hold': {
    name: 'Ring Support Hold', unit: 'seconds held', step: 5, suffix: 's',
    coach: 'Hold at the top. Stop when the elbows bend.',
    cues: ['Arms straight, shoulders pushed down.', 'Rings turned slightly out.'],
    abort: 'Elbows bend or the rings drift.'
  },
  // TIER — Pike / Wall Pike / Stabilized / Free.
  'pike-handstand-hold': {
    name: 'Handstand', unit: 'seconds held', step: 5, suffix: 's',
    coach: 'At your current stage. Stop when the position breaks down.',
    cues: ['Head neutral, core braced, push the floor away.', 'Pike stages: walk the feet up to a comfortable vertical.'],
    abort: 'Hips pike open early in the ladder, or you lose balance/bail out at Stabilized and Free.'
  },
  'scapular-pullup': {
    name: 'Scapular Pull-Up', unit: 'clean reps', step: 1, suffix: '',
    coach: 'No elbow bend at all.',
    cues: ['Dead hang, depress and retract the scaps only.', 'Lower under control, do not drop.'],
    abort: 'Any elbow bend, or momentum takes over.'
  },
  'dead-hang': {
    name: 'Dead Hang (rings)', unit: 'seconds held', step: 5, suffix: 's',
    coach: 'Stop when the shoulders shrug.',
    cues: ['Arms straight, shoulders passive.', 'Feet clear the floor without reaching.'],
    abort: 'Grip slips, or shoulders ride up to your ears.'
  },
  'active-hang': {
    name: 'Active Hang (rings)', unit: 'seconds held', step: 5, suffix: 's',
    coach: 'Shoulders stay packed the whole time.',
    cues: ['Pull the shoulders down and back, then hold.', 'Chest proud the whole time.'],
    abort: 'It turns back into a passive hang.'
  },
  'front-lever': {
    name: 'Front Lever', unit: 'seconds held', step: 1, suffix: 's',
    coach: 'Stop when the hips drop.',
    cues: ['Knees to chest, lean back until the torso is level.', 'Cannot pull in from the bottom? Enter from the top and lower.'],
    abort: 'Hips drop, back rounds, or you needed momentum.'
  },
  'ring-row': {
    name: 'Ring Row', unit: 'clean reps', step: 1, suffix: '',
    coach: 'Chest to rings, every one.',
    cues: ["Ring height sets the difficulty — keep last week's angle.", 'Elbows track back along the ribs.'],
    abort: 'Hips sag, or elbows flare wide.'
  },
  // TIER — Negative / Full / High Pull / Muscle Up.
  'pull-up': {
    name: 'Pull-Up (rings)', unit: 'clean reps', step: 1, suffix: '',
    coach: 'At your current stage. From a full hang. No swing.',
    cues: ['Scaps down first, then elbows to your back pockets.', 'Full extension at the bottom of every rep — or full control on the way down at Negative.'],
    abort: 'Any swing, any kip, any partial rep.'
  },
  // TIER — see progression-engine.js TODO(user) for the real Horse Stance ladder.
  'squat-hold': {
    name: 'Horse Stance', unit: 'seconds held', step: 5, suffix: 's',
    coach: 'Hold at your current stage. Stop when the chest drops.',
    cues: ['Feet twice shoulder width, toes slightly out.', 'Hips sunk, chest tall, spine upright.'],
    abort: 'Chest drops forward, or the hips rise.'
  },
  'pistol-squat': {
    name: 'Pistol Squat', unit: 'clean reps per side', step: 1, suffix: '',
    coach: 'Stop when the knee caves.',
    cues: ['Box-assisted until the full range is clean.', 'Arms out for balance only.'],
    abort: 'Knee caves, heel lifts, or balance goes.'
  },
  'single-leg-balance': {
    name: 'Single-Leg Balance', unit: 'seconds, eyes closed', step: 5, suffix: 's',
    coach: 'Eyes open to failure first, then eyes closed — log the eyes-closed number.',
    cues: ['Eyes open to failure first, then eyes closed.', 'Soft knee, quiet foot.'],
    abort: 'The lifted foot touches down.'
  },
  // Split from single-leg-balance (see progression-engine.js) so each leg progresses
  // independently. Both ids inherited the combined exercise's full logged history via
  // migration_007 — see that file for why. The old combined id above stays, unchanged,
  // purely for historical display; it was removed from day-plan.js's DAY_IDS so nothing
  // new ever logs against it again.
  'single-leg-balance-left': {
    name: 'Single-Leg Balance — Left', unit: 'seconds, eyes closed', step: 5, suffix: 's',
    coach: 'Left leg. Eyes open to failure first, then eyes closed — log the eyes-closed number.',
    cues: ['Eyes open to failure first, then eyes closed.', 'Soft knee, quiet foot.'],
    abort: 'The lifted foot touches down.'
  },
  'single-leg-balance-right': {
    name: 'Single-Leg Balance — Right', unit: 'seconds, eyes closed', step: 5, suffix: 's',
    coach: 'Right leg. Eyes open to failure first, then eyes closed — log the eyes-closed number.',
    cues: ['Eyes open to failure first, then eyes closed.', 'Soft knee, quiet foot.'],
    abort: 'The lifted foot touches down.'
  },
  // TIER — Ball Rollout / Ground Push / Banded / Full.
  'nordic-curl': {
    name: 'Nordic Curl', unit: 'clean reps', step: 1, suffix: '',
    coach: 'At your current stage. Stop when the hips break.',
    cues: ['Straight line from knees to head.', 'Lower under control — the eccentric is the work at every stage.'],
    abort: 'Hips break at the waist, or hamstrings cramp.'
  },
  'calf-raise-hold': {
    name: 'Calf Raise Hold', unit: 'seconds per side', step: 5, suffix: 's',
    coach: 'Hold at the top, each side.',
    cues: ['Full height, weight over the big toe.', 'Do not bounce out of the top.'],
    abort: 'The heel drops from the top.'
  },
  'l-sit': {
    name: 'L-Sit', unit: 'seconds held', step: 1, suffix: 's',
    coach: 'Stop when the hips sag.',
    cues: ['Straight-arm support, shoulders pushed down.', 'Legs locked, toes pointed.'],
    abort: 'Hips sag, or the shoulders shrug.'
  },
  'dragon-flag': {
    name: 'Dragon Flag', unit: 'seconds held', step: 1, suffix: 's',
    coach: 'Lower slowly into position, then hold. Stop when the back arches.',
    cues: ['Grip behind the head, body in one line.', 'The negative is just the entry into the hold — control it, then stay.'],
    abort: 'Low back arches off the bench, or hips drop first.'
  },
  // TIER — "Side Plank" confirmed as stage 1; see progression-engine.js TODO(user) for the rest.
  'side-lever': {
    name: 'Side Lever', unit: 'seconds per side', step: 5, suffix: 's',
    coach: 'Hold at your current stage. Stop when the hips drop.',
    cues: ['Straight line shoulder to feet, hips lifted.', 'Do not let the body rotate toward the floor.'],
    abort: 'Hips drop, or the body rotates down.'
  },
  // Split from side-lever, same rationale as single-leg-balance above — see migration_007.
  // `unit` drops "per side" (that phrasing was for the old combined tracking); each new id
  // now tracks one side only, so it reads like l-sit/front-lever's "seconds held".
  'side-lever-left': {
    name: 'Side Lever — Left', unit: 'seconds held', step: 5, suffix: 's',
    coach: 'Left side. Hold at your current stage. Stop when the hips drop.',
    cues: ['Straight line shoulder to feet, hips lifted.', 'Do not let the body rotate toward the floor.'],
    abort: 'Hips drop, or the body rotates down.'
  },
  'side-lever-right': {
    name: 'Side Lever — Right', unit: 'seconds held', step: 5, suffix: 's',
    coach: 'Right side. Hold at your current stage. Stop when the hips drop.',
    cues: ['Straight line shoulder to feet, hips lifted.', 'Do not let the body rotate toward the floor.'],
    abort: 'Hips drop, or the body rotates down.'
  },
  // TIER — Tucked / Single Leg / Half Up / Full.
  'toes-to-bar': {
    name: 'Toes-to-Bar', unit: 'clean reps', step: 1, suffix: '',
    coach: 'At your current stage. Strict — any swing ends the set.',
    cues: ['Dead hang, drive from the hips, control both ways.', 'Full stage only: no knee bend — the hips do the work.'],
    abort: 'Any swing, or momentum substituting for hip flexion.'
  },
  'hollow-hold-retest': {
    name: 'Hollow Hold Retest', unit: 'seconds held', step: 5, suffix: 's',
    coach: "Same test as earlier in the week, at the end of a full week's fatigue.",
    cues: ['Fresh versus fatigued is the whole point.', 'Do not warm up for it.'],
    abort: 'Same as earlier in the week — the low back lifts.'
  },
  'screen-shoulder-flexion': {
    name: 'Shoulder Flexion', unit: 'fist-widths of gap', step: 1, suffix: '',
    coach: 'Log the gap, both sides. This is a measurement, not a target.',
    cues: ['Heels, glutes, upper back and head on the wall.', 'Arms overhead without the low back arching off.'],
    abort: 'You have to arch to get there — that is the answer.'
  },
  'screen-shoulder-rotation': {
    name: 'Shoulder Rotation', unit: 'degrees short', step: 5, suffix: '°',
    coach: 'Log how far short of neutral, each side.',
    cues: ['Goalpost position, rotate the forearm up and down.', 'Ribs down — the low back likes to cheat this.'],
    abort: 'Pain rather than tightness. Stop and note it.'
  },
  'screen-ohs': {
    name: 'Overhead Squat', unit: 'inches of heel lift', step: 1, suffix: '"',
    coach: 'Log the heel lift. Film front and side.',
    cues: ['PVC overhead, squat as low as you can stay upright.', 'Bar stays behind the crown of your head.'],
    abort: 'Heels leave the floor — that is your depth today.'
  },
  // No mockup source — authored fresh for this reconciliation.
  'screen-couch-stretch': {
    name: 'Couch Stretch', unit: 'note', step: 1, suffix: '',
    coach: 'Log how upright you can hold the position, each side.',
    cues: ['Rear knee at the wall, front foot flat ahead of you.', 'Squeeze the glute on the working side to open the hip.'],
    abort: 'The low back arches to fake the range — that is not real hip extension.'
  },
  'screen-aslr': {
    name: 'Straight Leg Raise', unit: 'degrees short', step: 5, suffix: '°',
    coach: 'Log how far short of vertical, each side.',
    cues: ['One leg flat, lift the other without bending the knee.', 'The down leg stays glued to the floor.'],
    abort: 'The low back peels off the floor.'
  },
  // No mockup source — authored fresh for this reconciliation.
  'screen-thoracic-rotation': {
    name: 'Thoracic Rotation', unit: 'degrees short', step: 5, suffix: '°',
    coach: 'Log the rotation, each side.',
    cues: ['Hips stacked and still — the rotation comes from the ribcage, not the hips.', 'A light hand on the head guides it, it does not pull the turn.'],
    abort: 'The hips rotate to steal range from the low back.'
  }
};

// Fail fast in dev if the catalog and RULE_MAP ever drift apart.
const catalogIds = Object.keys(EXERCISES);
const ruleMapIds = Object.keys(RULE_MAP);
const missingFromCatalog = ruleMapIds.filter(id => !EXERCISES[id]);
const missingFromRuleMap = catalogIds.filter(id => !RULE_MAP[id]);
if (missingFromCatalog.length || missingFromRuleMap.length) {
  console.error('exercises.js / RULE_MAP drift:', { missingFromCatalog, missingFromRuleMap });
}

export function exerciseType(id) {
  return RULE_MAP[id]?.type ?? null;
}

export function exerciseTiers(id) {
  return RULE_MAP[id]?.params?.tiers ?? null;
}

// The single place that turns a training_entries row's raw value/sub_value into
// human-readable text — every UI spot that shows a logged result (Calendar's day
// preview, Session's read-only past-day card, the movement-history detail sheet,
// Baselines) must go through this, not format `${entry.value}${suffix}` inline.
// For TIER exercises, `value` is a STAGE INDEX, not a rep/time/lb number — showing it
// raw (the bug this was written to fix) reads as "0" or "1" instead of "Full" or
// "Tuck". Because this derives the stage name from exerciseTiers() (RULE_MAP) at call
// time rather than baking in a label, it automatically stays correct whenever a
// progression is added or an exercise is reclassified — no call site needs updating.
export function formatEntryValue(exerciseId, entry) {
  if (!entry || entry.value == null) return null;
  const spec = EXERCISES[exerciseId];
  const tiers = exerciseTiers(exerciseId);
  if (tiers) {
    const idx = Math.min(Math.max(Math.round(entry.value), 0), tiers.length - 1);
    const stageName = tiers[idx];
    return entry.sub_value != null ? `${stageName} · ${entry.sub_value}${spec.suffix || ''}` : stageName;
  }
  return `${entry.value}${spec.suffix || ''}`;
}

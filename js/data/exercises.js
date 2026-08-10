// The Path — canonical exercise catalog.
//
// RULE_MAP (progression-engine.js) is the source of truth for `type`/`tiers` — every key
// here MUST match a RULE_MAP key exactly, or computeRx() silently returns null for it.
// Everything else here (name, coaching copy, cues, abort condition, stepper unit/step) is
// UI/display metadata reconciled from the design mockup (The Path v3.dc.html) against the
// real RULE_MAP, per the plan's reconciliation table. Two categories needed correction
// during that reconciliation, flagged inline below:
//   - pull-up is REPS in RULE_MAP (flat rep progression) though the mockup mocked it up
//     as a staged ladder — RULE_MAP wins, it's rendered flat here like ring-row.
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
  'pike-handstand-hold': {
    name: 'Wall Pike Hold', unit: 'seconds held', step: 5, suffix: 's',
    coach: 'Stop when the neck starts working.',
    cues: ['Walk the feet up to a comfortable vertical.', 'Head neutral, core braced.'],
    abort: 'Hips pike open, or the neck loads.'
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
  // RULE_MAP classifies pull-up as REPS (flat), not the staged ladder the mockup mocked
  // up — rendered flat, same pattern as ring-row above.
  'pull-up': {
    name: 'Pull-Up (rings)', unit: 'clean reps', step: 1, suffix: '',
    coach: 'From a full hang. No swing.',
    cues: ['Scaps down first, then elbows to your back pockets.', 'Full extension at the bottom of every rep.'],
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
    name: 'Dragon Flag', unit: 'clean reps', step: 1, suffix: '',
    coach: 'Slow negatives. Stop when the back arches.',
    cues: ['Grip behind the head, body in one line.', 'Lower slowly — the eccentric is the work.'],
    abort: 'Low back arches off the bench, or hips drop first.'
  },
  // TIER — "Side Plank" confirmed as stage 1; see progression-engine.js TODO(user) for the rest.
  'side-lever': {
    name: 'Side Lever', unit: 'seconds per side', step: 5, suffix: 's',
    coach: 'Hold at your current stage. Stop when the hips drop.',
    cues: ['Straight line shoulder to feet, hips lifted.', 'Do not let the body rotate toward the floor.'],
    abort: 'Hips drop, or the body rotates down.'
  },
  'toes-to-bar': {
    name: 'Toes-to-Bar', unit: 'clean reps', step: 1, suffix: '',
    coach: 'Strict. Any swing ends the set.',
    cues: ['Dead hang, legs to the bar, control both ways.', 'No knees — the hips do the work.'],
    abort: 'Any swing, or knees substituting for hip flexion.'
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

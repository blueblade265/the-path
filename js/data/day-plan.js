// No longer imported by any UI file as of the per-user Program Builder (js/services/
// program-service.js) — each user's live schedule now lives in the program_days /
// program_exercises tables, seeded once from this exact file's contents (see
// supabase/migration_008_program_builder.sql's header comment). Kept here, unchanged,
// as the literal record of that seed and as a ready-made default template for a future
// "reset to default" / new-user-starting-point convenience — not currently wired to
// anything.
//
// The Path — day-of-week -> exercise list.
// Keys: 0=Sunday (rest) .. 6=Saturday, matching training_entries.day in schema.sql.
// Reconciled from the mockup's 6-day split with renamed ids (see exercises.js) and the
// mobility day expanded from 4 to 6 screens (the two missing RULE_MAP screens added in).

export const DAY_IDS = {
  0: [],
  1: ['back-squat', 'deadlift', 'bench-press'],
  2: ['hollow-hold', 'pushup-bottom-hold', 'ring-support-hold', 'pike-handstand-hold', 'skin-the-cat'],
  3: ['dead-hang', 'active-hang', 'front-lever', 'ring-row', 'pull-up'],
  4: ['squat-hold', 'pistol-squat', 'single-leg-balance-left', 'single-leg-balance-right', 'nordic-curl', 'calf-raise-hold'],
  5: ['l-sit', 'dragon-flag', 'side-lever-left', 'side-lever-right', 'toes-to-bar', 'hollow-hold-retest'],
  6: ['screen-shoulder-flexion', 'screen-shoulder-rotation', 'screen-ohs', 'screen-couch-stretch', 'screen-aslr', 'screen-thoracic-rotation']
};

export const DAY_META = {
  0: { title: 'Rest', meta: 'Nothing scheduled', rest: true },
  1: { title: 'Heavy', meta: 'Squat · Deadlift · Bench' },
  2: { title: 'Push + Stabilizers', meta: '5 movements' },
  3: { title: 'Pull + Grip', meta: '5 movements · rings' },
  4: { title: 'Legs + Hip', meta: '6 movements' },
  5: { title: 'Core + Integration', meta: '6 movements' },
  6: { title: 'Mobility Screen', meta: '6 screens · asymmetry' }
};

export function exerciseIdsForDay(dayOfWeek) {
  return DAY_IDS[dayOfWeek] || [];
}

export function dayMeta(dayOfWeek) {
  return DAY_META[dayOfWeek] || DAY_META[0];
}

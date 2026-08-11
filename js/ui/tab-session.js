import { el, clear } from './dom.js';
import { exerciseIdsForDay, dayMeta } from '../data/day-plan.js';
import { EXERCISES, exerciseType, exerciseTiers, formatEntryValue } from '../data/exercises.js';
import { entriesForDay, logEntry, historyForExercise, getBaseline } from '../services/entries-repo.js';
import { prescriptionsForDay } from '../services/rx-service.js';
import { dateForWeekDay } from '../services/calendar-service.js';
import { logRetestEntry } from '../services/baseline-service.js';
import { stepper } from './components/stepper.js';
import { setChips } from './components/set-chips.js';
import { restTimer, playChime } from './components/rest-timer.js';
import { phaseTimer } from './components/phase-timer.js';
import { banner } from './components/banner.js';
import { openDetail } from './detail-sheet.js';

// LOAD (barbell) work gets the longer rest; everything else (holds, reps, tiers) gets
// the shorter default. Both numbers are user-editable in More -> Rules (settings-service.js).
function restSecondsFor(id, ctx) {
  return exerciseType(id) === 'LOAD' ? ctx.restSettings.load : ctx.restSettings.default;
}

export async function renderSession(container, ctx, target) {
  clear(container);
  const wrap = el('div', { style: 'display:flex;flex-direction:column;flex:1;min-height:0' });
  container.appendChild(wrap);

  const week = target?.week ?? ctx.todayWeekDay.week;
  const day = target?.day ?? ctx.todayWeekDay.day;
  const isToday = week === ctx.todayWeekDay.week && day === ctx.todayWeekDay.day;
  const cellDate = dateForWeekDay(ctx.startDate, ctx.skips, week, day);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cmpDate = new Date(cellDate); cmpDate.setHours(0, 0, 0, 0);
  const ds = isToday ? 'today' : (cmpDate < today ? 'past' : 'future');
  // Set via the Baselines screen's "Retest" button — this exact program week runs in
  // test mode instead of prescribed work sets. Left in place after the week passes, so
  // it stays historically accurate if you browse back to it later.
  const isRetestWeek = ctx.pendingRetestWeek != null && week === ctx.pendingRetestWeek;

  const meta = dayMeta(day);
  const ids = exerciseIdsForDay(day);
  const dayEntries = await entriesForDay(ctx.userId, week, day);
  const missed = ds === 'past' && !meta.rest && dayEntries.length === 0;
  let unlocked = false;

  const header = el('div', { style: 'flex:none;padding:4px 20px 12px;border-bottom:1px solid var(--card-border)' });
  const list = el('div', { class: 'screen', style: 'flex:1' });
  wrap.appendChild(header);
  wrap.appendChild(list);

  function drawHeader() {
    clear(header);
    const kickerText = `${meta.title} · ${ds === 'today' ? 'Today' : (missed ? 'Backfill' : (ds === 'past' ? 'Logged' : 'Upcoming'))}`;
    header.appendChild(el('div', {}, [
      el('div', { style: `font:500 9.5px/1 var(--font-mono);letter-spacing:.15em;text-transform:uppercase;color:${ds === 'today' ? 'var(--amber)' : (missed ? 'var(--clay-hi)' : 'var(--text-muted)')};margin-bottom:7px`, text: kickerText }),
      el('div', { style: 'font:600 23px/1.05 var(--font-display);text-transform:uppercase;color:var(--text-primary)', text: meta.title })
    ]));
    if (isRetestWeek && !meta.rest) {
      header.appendChild(banner({ variant: 'retest', text: 'Retest week. Results logged here replace your baselines — the engine starts fresh from what you hit.' }));
    }
    if (ds !== 'today') {
      const variant = missed ? 'missed' : (ds === 'past' ? 'readonly' : 'provisional');
      const text = missed
        ? 'You missed this day — log it now and the engine catches up.'
        : (ds === 'past'
          ? (unlocked ? 'Editing a past result. It re-runs the engine for later weeks.' : 'Read-only. Targets shown are what you were given that day.')
          : 'Provisional. These move as you log between now and then.');
      const showEdit = ds === 'past' && !missed && !unlocked;
      header.appendChild(banner({
        variant, text,
        actionLabel: showEdit ? 'Edit' : null,
        onAction: showEdit ? () => { unlocked = true; drawHeader(); drawList(); } : null
      }));
    }
  }

  async function drawList() {
    clear(list);
    if (meta.rest) {
      list.appendChild(el('div', { class: 'card', text: 'Nothing scheduled.' }));
      return;
    }
    const canLog = ds === 'today' || missed || (ds === 'past' && unlocked);
    // Computed even for future days: "what would be prescribed based on everything
    // logged so far" — exactly what "provisional" means in the mockup's own design.
    const rx = await prescriptionsForDay(ctx.userId, ids, week);

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const existing = dayEntries.find(e => e.exercise_id === id);
      const isLastExercise = i === ids.length - 1;
      list.appendChild(await renderCard(id, i, ids.length, { week, day, ds, canLog, missed, isRetestWeek, isLastExercise, rx: rx[id], existing }, ctx, drawList));
    }
  }

  drawHeader();
  await drawList();
}

async function renderCard(id, index, total, state, ctx, redraw) {
  const spec = EXERCISES[id];
  const type = exerciseType(id);
  const isScreen = type === 'SCREEN';
  const existing = state.existing;
  const logged = !!existing;
  // Screens are measurements, not progression targets — RULE_MAP has no baseline
  // concept for them (computeRx's SCREEN branch ignores history entirely), so a retest
  // week doesn't change how they're logged.
  const inRetestMode = state.isRetestWeek && !isScreen;

  const card = el('div', { class: 'exercise-card' });
  card.appendChild(el('div', { class: 'exercise-card__head' }, [
    el('div', { class: 'exercise-card__num', text: `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` }),
    el('span', { class: `status-chip${logged ? ' status-chip--done' : (state.missed ? ' status-chip--missed' : '')}`, text: logged ? 'Logged' : (state.missed ? 'Missed' : (state.ds === 'future' ? 'Planned' : 'To do')) })
  ]));
  card.appendChild(el('div', { class: 'exercise-card__name-row', onClick: () => openMovementDetail(id, ctx) }, [
    el('div', { class: 'exercise-card__name', text: spec.name }),
    el('div', { style: 'font:400 16px/1 var(--font-body);color:var(--amber)', text: '›' })
  ]));

  if (isScreen) {
    card.appendChild(el('div', { class: 'rx-block' }, [
      el('div', { class: 'rx-block__label', text: 'What to record' }),
      el('div', { style: 'font:400 14px/1.5 var(--font-body);color:#D8D4C2', text: spec.coach }),
      el('div', { style: 'font:400 11px/1.5 var(--font-mono);color:var(--text-muted);margin-top:9px', text: 'No target. This is a measurement, not a set.' })
    ]));
  } else if (inRetestMode) {
    card.appendChild(el('div', { class: 'rx-block rx-block--provisional' }, [
      el('div', { class: 'rx-block__label', text: 'Retest' }),
      el('div', { style: 'font:400 14px/1.5 var(--font-body);color:#D8D4C2', text: 'Test fresh — starting near your current number is fine, but log what you actually hit today.' })
    ]));
  } else if (state.rx) {
    const provisional = state.ds === 'future';
    card.appendChild(el('div', { class: `rx-block${provisional ? ' rx-block--provisional' : ''}` }, [
      el('div', { class: 'rx-block__label', text: provisional ? 'Provisional target' : 'Target' }),
      el('div', { class: 'rx-block__value', text: state.rx.text }),
      el('div', { class: 'rx-block__why', text: state.rx.why })
    ]));
  } else {
    card.appendChild(el('div', { class: 'rx-block' }, [
      el('div', { class: 'rx-block__label', text: 'No baseline yet' }),
      el('div', { style: 'font:400 13.5px/1.4 var(--font-body);color:var(--text-secondary)', text: 'Log this as Week 0 (via Bulk Entry in More) to start the engine.' })
    ]));
  }

  for (const cue of spec.cues) {
    card.appendChild(el('div', { class: 'cue' }, [el('div', { class: 'cue__dot' }), el('div', { class: 'cue__text', text: cue })]));
  }
  card.appendChild(el('div', { class: 'abort-block' }, [
    el('div', { class: 'abort-block__label', text: 'Stop when' }),
    el('div', { class: 'abort-block__text', text: spec.abort })
  ]));

  if (!state.canLog) {
    card.appendChild(el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px;border-radius:10px;background:var(--card-bg-alt);border:1px dashed var(--card-border)' }, [
      el('div', { style: 'font:400 12px/1.45 var(--font-mono);color:var(--text-muted)', text: logged ? `Logged: ${formatEntryValue(id, existing) ?? '—'}` : 'Opens on the day.' })
    ]));
    return card;
  }

  const holdSeconds = type === 'HOLD_TIME' ? parsePrescribedSeconds(state.rx?.text) : null;

  if (isScreen) {
    card.appendChild(buildScreenLogger(id, spec, state, existing, ctx, redraw));
  } else if (inRetestMode) {
    card.appendChild(await buildRetestLogger(id, spec, state, existing, ctx));
  } else if (type === 'TIER') {
    card.appendChild(await buildTierLogger(id, spec, state, existing, ctx, redraw));
  } else if (state.ds === 'today' && holdSeconds != null) {
    // Live, a real target exists to count down to — no manual stepper, the timers do
    // the logging themselves.
    card.appendChild(buildHoldTimeFlow(id, spec, state, existing, ctx, holdSeconds));
  } else {
    card.appendChild(buildNumericLogger(id, spec, state, existing, ctx, redraw));
  }

  return card;
}

// Shared "form held throughout" toggle, used by every logger variant.
function buildFormGate(initial, subText, onToggle) {
  const sub = subText || { on: 'Next week advances from this.', off: 'Off means next week repeats this target.' };
  const gate = el('div', { class: `form-gate${initial ? ' form-gate--on' : ''}` }, [
    el('div', { class: 'form-gate__box', text: initial ? '✓' : '' }),
    el('div', {}, [
      el('div', { class: 'form-gate__title', text: 'Form held throughout' }),
      el('div', { class: 'form-gate__sub', text: initial ? sub.on : sub.off })
    ])
  ]);
  let state = initial;
  gate.addEventListener('click', () => {
    state = !state;
    gate.className = `form-gate${state ? ' form-gate--on' : ''}`;
    gate.querySelector('.form-gate__box').textContent = state ? '✓' : '';
    gate.querySelector('.form-gate__sub').textContent = state ? sub.on : sub.off;
    onToggle(state);
  });
  return gate;
}

function buildNumericLogger(id, spec, state, existing, ctx, redraw) {
  const box = el('div');
  const isLive = state.ds === 'today';
  let cleanState = existing ? existing.form_clean : true;
  let draftValue = existing ? existing.value : spec.step;

  const gate = buildFormGate(cleanState, null, v => { cleanState = v; });
  const notes = el('textarea', { class: 'notes-field', placeholder: 'Notes (optional)' });
  notes.value = existing?.notes || '';
  const step = stepper({
    value: draftValue, unitLabel: spec.unit, step: spec.step, min: 0,
    onChange: v => { draftValue = v; }
  });

  if (!isLive) {
    // Editing/backfilling a past day: one persisted value (schema stores the last
    // completed set only, not per-set history), so this is a plain edit-and-save form —
    // no set-by-set chips (nothing to pick between), no rest timer (nothing to rest
    // from — that's only meaningful mid-workout via Start Session on today).
    const cta = el('button', { class: 'btn btn--primary', text: 'Save' });
    cta.addEventListener('click', async () => {
      await logEntry({ userId: ctx.userId, week: state.week, day: state.day, exerciseId: id, value: draftValue, subValue: null, formClean: cleanState, notes: notes.value });
      cta.textContent = 'Saved ✓';
    });
    box.appendChild(step);
    box.appendChild(gate);
    box.appendChild(notes);
    box.appendChild(cta);
    return box;
  }

  const sessionSets = existing ? [existing.value] : [];
  const chipsHost = el('div');
  const redrawChips = () => { clear(chipsHost); chipsHost.appendChild(setChips(sessionSets)); };
  redrawChips();

  const cta = el('button', { class: 'btn btn--primary', text: logged(existing) ? 'Logged ✓' : `Log set ${sessionSets.length + 1}` });
  cta.addEventListener('click', async () => {
    await logEntry({ userId: ctx.userId, week: state.week, day: state.day, exerciseId: id, value: draftValue, subValue: null, formClean: cleanState, notes: notes.value });
    if (sessionSets.length < 3) sessionSets.push(draftValue); else sessionSets[2] = draftValue;
    redrawChips();
    cta.textContent = 'Logged ✓';
    // No rest to take after the very last set of the very last exercise — the workout's over.
    const isFinalSetOfWorkout = state.isLastExercise && sessionSets.length >= 3;
    if (!isFinalSetOfWorkout) {
      const { node } = restTimer(ctx.userId, restSecondsFor(id, ctx), () => node.remove());
      box.appendChild(node);
    }
  });

  box.appendChild(step);
  box.appendChild(chipsHost);
  box.appendChild(gate);
  box.appendChild(notes);
  box.appendChild(cta);
  return box;
}

// RULES.HOLD_TIME (progression-engine.js) returns text like "3 × 70s" — never a bare
// number, so the target has to be parsed out rather than exposed as its own field.
// Deliberately not changing the engine's return shape for this — RULES/CONFIG stay
// untouched, per the whole project's "reuse the tested engine verbatim" rule.
function parsePrescribedSeconds(rxText) {
  const m = /×\s*(\d+)s/.exec(rxText || '');
  return m ? Number(m[1]) : null;
}

// Live, timed holds: Start set N -> 5s "get ready" -> chime -> hold countdown for the
// prescribed seconds -> chime -> rest timer -> chime, then back to Start set N+1. No
// manual number entry — a completed hold IS the prescribed target by definition of the
// timer completing, so each one logs itself; "Form held throughout" is the only manual
// judgment left, exactly as specified.
function buildHoldTimeFlow(id, spec, state, existing, ctx, prescribedSeconds) {
  const box = el('div');
  let cleanState = existing ? existing.form_clean : true;
  const gate = buildFormGate(cleanState, null, v => { cleanState = v; });
  const notes = el('textarea', { class: 'notes-field', placeholder: 'Notes (optional)' });
  notes.value = existing?.notes || '';

  const sessionSets = existing ? [existing.value] : [];
  const chipsHost = el('div');
  const redrawChips = () => { clear(chipsHost); chipsHost.appendChild(setChips(sessionSets)); };
  redrawChips();

  const phaseHost = el('div');
  const ctaHost = el('div');

  function cancelLink(onCancel) {
    return el('div', { style: 'text-align:center;font:600 10px/1 var(--font-mono);letter-spacing:.09em;text-transform:uppercase;color:var(--text-muted);cursor:pointer;margin-bottom:11px', text: 'Cancel', onClick: onCancel });
  }

  function drawIdle() {
    clear(phaseHost);
    clear(ctaHost);
    const done = sessionSets.length >= 3;
    const cta = el('button', { class: 'btn btn--primary', text: done ? 'Logged ✓' : `Start set ${Math.min(sessionSets.length + 1, 3)}` });
    if (done) cta.setAttribute('disabled', '');
    else cta.addEventListener('click', startCountdown);
    ctaHost.appendChild(cta);
  }

  function startCountdown() {
    clear(ctaHost);
    clear(phaseHost);
    const { node, stop } = phaseTimer({ label: 'Get ready', seconds: 5, accent: 'var(--amber)', onDone: () => { playChime(); startHold(); } });
    phaseHost.appendChild(node);
    phaseHost.appendChild(cancelLink(() => { stop(); drawIdle(); }));
  }

  function startHold() {
    clear(phaseHost);
    const { node, stop } = phaseTimer({ label: 'Hold', seconds: prescribedSeconds, accent: 'var(--moss)', onDone: onHoldComplete });
    phaseHost.appendChild(node);
    phaseHost.appendChild(cancelLink(() => { stop(); drawIdle(); }));
  }

  async function onHoldComplete() {
    playChime();
    await logEntry({ userId: ctx.userId, week: state.week, day: state.day, exerciseId: id, value: prescribedSeconds, subValue: null, formClean: cleanState, notes: notes.value });
    if (sessionSets.length < 3) sessionSets.push(prescribedSeconds); else sessionSets[2] = prescribedSeconds;
    redrawChips();
    clear(phaseHost);
    // No rest to take after the very last set of the very last exercise — the workout's over.
    const isFinalSetOfWorkout = state.isLastExercise && sessionSets.length >= 3;
    if (isFinalSetOfWorkout) {
      drawIdle();
    } else {
      const { node } = restTimer(ctx.userId, restSecondsFor(id, ctx), () => { clear(phaseHost); drawIdle(); });
      phaseHost.appendChild(node);
    }
  }

  drawIdle();

  box.appendChild(phaseHost);
  box.appendChild(chipsHost);
  box.appendChild(gate);
  box.appendChild(notes);
  box.appendChild(ctaHost);
  return box;
}

async function buildTierLogger(id, spec, state, existing, ctx, redraw) {
  const box = el('div');
  const tiers = exerciseTiers(id) || [];
  const isBaseline = state.week === 0;
  const isLive = state.ds === 'today';
  // Live logging shows the stage as a read-only, engine-computed label — the whole
  // point is you don't get to just declare a different stage than the algorithm put
  // you at. Editing/backfilling a past entry is different: it's a correction to the
  // historical record (which the engine doesn't even read the stage/value from for
  // non-baseline weeks — only form_clean matters there), so it stays editable.
  const stageEditable = isBaseline || !isLive;

  let tierIdx = existing ? Math.round(existing.value ?? 0) : 0;
  let subValue = existing ? existing.sub_value : 0;
  let cleanState = existing ? existing.form_clean : true;

  if (!isBaseline && !existing) {
    // The CURRENT baseline, not literally week 0 — after a completed retest, the
    // baseline may be a later week, and the current stage must reflect that, not the
    // pre-retest starting point.
    const baseline = await getBaseline(ctx.userId, id);
    tierIdx = baseline?.value != null ? Math.min(Math.max(Math.round(baseline.value), 0), tiers.length - 1) : 0;
  }

  const stageLabel = el('div', { style: 'font:500 13px/1.2 var(--font-display);letter-spacing:.04em;text-transform:uppercase;color:var(--moss-hi);margin-bottom:11px', text: tiers[tierIdx] || '' });
  box.appendChild(stageLabel);

  if (stageEditable) {
    box.appendChild(el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint);margin-bottom:8px', text: isBaseline ? 'Starting stage' : 'Stage' }));
    const stageSelect = el('select', {
      class: 'notes-field', style: 'margin-bottom:11px',
      onChange: e => { tierIdx = Number(e.target.value); stageLabel.textContent = tiers[tierIdx]; }
    }, tiers.map((t, i) => el('option', { value: String(i), selected: i === tierIdx ? true : undefined, text: t })));
    box.appendChild(stageSelect);
  }

  box.appendChild(el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint);margin:11px 0 8px', text: 'Performance at this stage' }));
  box.appendChild(stepper({ value: subValue || 0, unitLabel: spec.unit, step: spec.step, min: 0, onChange: v => { subValue = v; } }));

  const gate = buildFormGate(cleanState, null, v => { cleanState = v; });
  gate.style.marginTop = '13px';

  const notes = el('textarea', { class: 'notes-field', placeholder: 'Notes (optional)' });
  notes.value = existing?.notes || '';

  const cta = el('button', { class: 'btn btn--primary', text: isLive ? (logged(existing) ? 'Logged ✓' : 'Log this week') : 'Save' });
  cta.addEventListener('click', async () => {
    await logEntry({ userId: ctx.userId, week: state.week, day: state.day, exerciseId: id, value: tierIdx, subValue, formClean: cleanState, notes: notes.value });
    if (isLive) {
      cta.textContent = 'Logged ✓';
      // No rest to take after the very last exercise of the workout.
      if (!state.isLastExercise) {
        const { node } = restTimer(ctx.userId, restSecondsFor(id, ctx), () => node.remove());
        box.appendChild(node);
      }
    } else {
      cta.textContent = 'Saved ✓';
    }
  });

  box.appendChild(gate);
  box.appendChild(notes);
  box.appendChild(cta);
  return box;
}

// Test-week logger: one number (or one stage + performance), not three progressive
// sets — "similar to week 0," per the user's own framing, but the starting point is
// gauged to the current baseline/prescription instead of starting blank. Saving both
// logs the entry and replaces that exercise's baseline (logRetestEntry).
async function buildRetestLogger(id, spec, state, existing, ctx) {
  const box = el('div');
  const type = exerciseType(id);
  const tiers = exerciseTiers(id);
  const baseline = existing ? null : await getBaseline(ctx.userId, id);
  let cleanState = existing ? existing.form_clean : true;

  let tierIdx = 0, subValue = 0, value = 0;

  if (type === 'TIER') {
    tierIdx = existing ? Math.round(existing.value ?? 0) : (baseline ? Math.round(baseline.value ?? 0) : 0);
    subValue = existing ? existing.sub_value : (baseline ? baseline.sub_value : 0);
    const stageLabel = el('div', { style: 'font:500 13px/1.2 var(--font-display);letter-spacing:.04em;text-transform:uppercase;color:var(--moss-hi);margin-bottom:11px', text: (tiers || [])[tierIdx] || '' });
    box.appendChild(stageLabel);
    box.appendChild(el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint);margin-bottom:8px', text: 'Stage' }));
    box.appendChild(el('select', {
      class: 'notes-field', style: 'margin-bottom:11px',
      onChange: e => { tierIdx = Number(e.target.value); stageLabel.textContent = tiers[tierIdx]; }
    }, (tiers || []).map((t, i) => el('option', { value: String(i), selected: i === tierIdx ? true : undefined, text: t }))));
    box.appendChild(el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint);margin-bottom:8px', text: `Performance (${spec.unit})` }));
    box.appendChild(stepper({ value: subValue || 0, unitLabel: spec.unit, step: spec.step, min: 0, onChange: v => { subValue = v; } }));
  } else {
    value = existing ? existing.value : (baseline ? baseline.value : spec.step);
    box.appendChild(stepper({ value, unitLabel: spec.unit, step: spec.step, min: 0, onChange: v => { value = v; } }));
  }

  const gate = buildFormGate(cleanState, { on: 'This becomes your new baseline.', off: 'This still becomes your new baseline — clean just tracks form.' }, v => { cleanState = v; });

  const notes = el('textarea', { class: 'notes-field', placeholder: 'Notes (optional)' });
  notes.value = existing?.notes || '';

  const cta = el('button', { class: 'btn btn--primary', text: logged(existing) ? 'Retested ✓' : 'Log retest' });
  cta.addEventListener('click', async () => {
    await logRetestEntry({
      userId: ctx.userId, week: state.week, day: state.day, exerciseId: id,
      value: type === 'TIER' ? tierIdx : value,
      subValue: type === 'TIER' ? subValue : null,
      formClean: cleanState, notes: notes.value
    });
    cta.textContent = 'Retested ✓';
  });

  box.appendChild(gate);
  box.appendChild(notes);
  box.appendChild(cta);
  return box;
}

function buildScreenLogger(id, spec, state, existing, ctx, redraw) {
  const box = el('div');
  let side = existing?.notes?.match(/Side: (\w+)/)?.[1] || null;
  let value = existing ? existing.value : 0;

  box.appendChild(el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint);margin-bottom:9px', text: 'Which side is limited?' }));
  const picker = el('div', { class: 'side-picker' }, ['Left', 'Even', 'Right'].map(label =>
    el('div', { class: `side-picker__opt${side === label ? ' side-picker__opt--picked' : ''}`, text: label, onClick: (e) => {
      side = label;
      picker.querySelectorAll('.side-picker__opt').forEach(n => n.classList.remove('side-picker__opt--picked'));
      e.currentTarget.classList.add('side-picker__opt--picked');
    }})
  ));
  box.appendChild(picker);
  box.appendChild(stepper({ value, unitLabel: spec.unit, step: spec.step, min: 0, onChange: v => { value = v; } }));

  const notes = el('textarea', { class: 'notes-field', placeholder: 'Notes (optional)' });
  notes.value = (existing?.notes || '').replace(/Side: \w+;?\s*/, '');

  const cta = el('button', { class: 'btn btn--primary', text: existing ? 'Recorded ✓' : 'Save this screen' });
  cta.addEventListener('click', async () => {
    const combinedNotes = [side ? `Side: ${side}` : null, notes.value].filter(Boolean).join('; ');
    await logEntry({ userId: ctx.userId, week: state.week, day: state.day, exerciseId: id, value, subValue: null, formClean: true, notes: combinedNotes });
    cta.textContent = 'Recorded ✓';
  });

  box.appendChild(notes);
  box.appendChild(cta);
  return box;
}

function logged(existing) { return !!existing; }

async function openMovementDetail(id, ctx) {
  const spec = EXERCISES[id];
  const hist = await historyForExercise(ctx.userId, id, 9999);
  const tiers = exerciseTiers(id);
  const baseline = await getBaseline(ctx.userId, id);
  const tierIdx = tiers && baseline ? Math.min(Math.max(Math.round(baseline.value ?? 0), 0), tiers.length - 1) : null;

  openDetail({
    kicker: 'Movement history', title: spec.name,
    ladder: tiers ? tiers.map((t, i) => ({ name: t, reached: i < tierIdx, current: i === tierIdx, meta: i < tierIdx ? 'cleared' : (i === tierIdx ? 'here' : '') })) : null,
    bars: hist.map((h, i) => ({ label: `W${h.week}`, value: h.value ?? 0, clean: h.form_clean })),
    sections: [{
      title: 'Every result',
      rows: hist.slice().reverse().map(h => ({ name: `Week ${h.week}${baseline && h.week === baseline.week ? ' — current baseline' : ''}`, value: `${formatEntryValue(id, h) ?? '—'}${h.form_clean ? ' ✓' : ' held'}`, color: h.form_clean ? 'var(--moss-hi)' : 'var(--clay-hi)' }))
    }]
  });
}

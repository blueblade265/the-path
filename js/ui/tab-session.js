import { el, clear } from './dom.js';
import { exerciseIdsForDay, dayMeta } from '../data/day-plan.js';
import { EXERCISES, exerciseType, exerciseTiers } from '../data/exercises.js';
import { entriesForDay, logEntry, historyForExercise } from '../services/entries-repo.js';
import { prescriptionsForDay } from '../services/rx-service.js';
import { dateForWeekDay } from '../services/calendar-service.js';
import { stepper } from './components/stepper.js';
import { setChips } from './components/set-chips.js';
import { restTimer } from './components/rest-timer.js';
import { banner } from './components/banner.js';
import { openDetail } from './detail-sheet.js';

const CONFIG_REST_SECONDS = 90;

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

  const meta = dayMeta(day);
  const ids = exerciseIdsForDay(day);
  const dayEntries = await entriesForDay(ctx.userId, week, day);
  const missed = ds === 'past' && !meta.rest && dayEntries.length === 0;
  let unlocked = false;

  const header = el('div', { style: 'flex:none;padding:4px 20px 12px;border-bottom:1px solid var(--card-border)' });
  const list = el('div', { class: 'screen screen--tight', style: 'flex:1' });
  wrap.appendChild(header);
  wrap.appendChild(list);

  function drawHeader() {
    clear(header);
    const kickerText = `${meta.title} · ${ds === 'today' ? 'Today' : (missed ? 'Backfill' : (ds === 'past' ? 'Logged' : 'Upcoming'))}`;
    header.appendChild(el('div', {}, [
      el('div', { style: `font:500 9.5px/1 var(--font-mono);letter-spacing:.15em;text-transform:uppercase;color:${ds === 'today' ? 'var(--amber)' : (missed ? 'var(--clay-hi)' : 'var(--text-muted)')};margin-bottom:7px`, text: kickerText }),
      el('div', { style: 'font:600 23px/1.05 var(--font-display);text-transform:uppercase;color:var(--text-primary)', text: meta.title })
    ]));
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
      list.appendChild(await renderCard(id, i, ids.length, { week, day, ds, canLog, missed, rx: rx[id], existing }, ctx, drawList));
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
      el('div', { style: 'font:400 12px/1.45 var(--font-mono);color:var(--text-muted)', text: logged ? `Logged: ${formatExisting(existing, spec)}` : 'Opens on the day.' })
    ]));
    return card;
  }

  if (isScreen) {
    card.appendChild(buildScreenLogger(id, spec, state, existing, ctx, redraw));
  } else if (type === 'TIER') {
    card.appendChild(await buildTierLogger(id, spec, state, existing, ctx, redraw));
  } else {
    card.appendChild(buildNumericLogger(id, spec, state, existing, ctx, redraw));
  }

  return card;
}

function formatExisting(existing, spec) {
  if (existing.value == null) return '—';
  return `${existing.value}${spec.suffix || ''}`;
}

function buildNumericLogger(id, spec, state, existing, ctx, redraw) {
  const box = el('div');
  const sessionSets = existing ? [existing.value] : [];
  let cleanState = existing ? existing.form_clean : true;
  let draftValue = existing ? existing.value : spec.step;

  const chipsHost = el('div');
  const gate = el('div', { class: `form-gate${cleanState ? ' form-gate--on' : ''}`, onClick: () => {
    cleanState = !cleanState;
    gate.className = `form-gate${cleanState ? ' form-gate--on' : ''}`;
    gate.querySelector('.form-gate__box').textContent = cleanState ? '✓' : '';
    gate.querySelector('.form-gate__sub').textContent = cleanState ? 'Next week advances from this.' : 'Off means next week repeats this target.';
  }}, [
    el('div', { class: 'form-gate__box', text: cleanState ? '✓' : '' }),
    el('div', {}, [
      el('div', { class: 'form-gate__title', text: 'Form held throughout' }),
      el('div', { class: 'form-gate__sub', text: cleanState ? 'Next week advances from this.' : 'Off means next week repeats this target.' })
    ])
  ]);

  const notes = el('textarea', { class: 'notes-field', placeholder: 'Notes (optional)' });
  notes.value = existing?.notes || '';

  const step = stepper({
    value: draftValue, unitLabel: spec.unit, step: spec.step, min: 0,
    onChange: v => { draftValue = v; }
  });

  const redrawChips = () => { clear(chipsHost); chipsHost.appendChild(setChips(sessionSets)); };
  redrawChips();

  const cta = el('button', { class: 'btn btn--primary', text: logged(existing) ? 'Logged ✓' : `Log set ${sessionSets.length + 1}` });
  cta.addEventListener('click', async () => {
    await logEntry({ userId: ctx.userId, week: state.week, day: state.day, exerciseId: id, value: draftValue, subValue: null, formClean: cleanState, notes: notes.value });
    if (sessionSets.length < 3) sessionSets.push(draftValue); else sessionSets[2] = draftValue;
    redrawChips();
    cta.textContent = 'Logged ✓';
    const { node, stop } = restTimer(CONFIG_REST_SECONDS, () => node.remove());
    box.appendChild(node);
  });

  box.appendChild(step);
  box.appendChild(chipsHost);
  box.appendChild(gate);
  box.appendChild(notes);
  box.appendChild(cta);
  return box;
}

async function buildTierLogger(id, spec, state, existing, ctx, redraw) {
  const box = el('div');
  const tiers = exerciseTiers(id) || [];
  const isBaseline = state.week === 0;

  let tierIdx = existing ? Math.round(existing.value ?? 0) : 0;
  let subValue = existing ? existing.sub_value : 0;
  let cleanState = existing ? existing.form_clean : true;

  if (!isBaseline) {
    const hist = await historyForExercise(ctx.userId, id, state.week);
    if (hist.length) {
      const baseline = hist[0].value;
      tierIdx = baseline != null ? Math.min(Math.max(Math.round(baseline), 0), tiers.length - 1) : 0;
    }
  }

  box.appendChild(el('div', { style: 'font:500 13px/1.2 var(--font-display);letter-spacing:.04em;text-transform:uppercase;color:var(--moss-hi);margin-bottom:11px', text: tiers[tierIdx] || '' }));

  if (isBaseline) {
    box.appendChild(el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint);margin-bottom:8px', text: 'Starting stage' }));
    box.appendChild(stepper({ value: tierIdx, unitLabel: 'stage index', step: 1, min: 0, onChange: v => { tierIdx = Math.min(v, tiers.length - 1); } }));
  }

  box.appendChild(el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint);margin:11px 0 8px', text: 'Performance at this stage' }));
  box.appendChild(stepper({ value: subValue || 0, unitLabel: spec.unit, step: spec.step, min: 0, onChange: v => { subValue = v; } }));

  const gate = el('div', { class: `form-gate${cleanState ? ' form-gate--on' : ''}`, style: 'margin-top:13px', onClick: () => {
    cleanState = !cleanState;
    gate.className = `form-gate${cleanState ? ' form-gate--on' : ''}`;
  }}, [
    el('div', { class: 'form-gate__box', text: cleanState ? '✓' : '' }),
    el('div', {}, [el('div', { class: 'form-gate__title', text: 'Form held throughout' })])
  ]);

  const notes = el('textarea', { class: 'notes-field', placeholder: 'Notes (optional)' });
  notes.value = existing?.notes || '';

  const cta = el('button', { class: 'btn btn--primary', text: logged(existing) ? 'Logged ✓' : 'Log this week' });
  cta.addEventListener('click', async () => {
    await logEntry({ userId: ctx.userId, week: state.week, day: state.day, exerciseId: id, value: tierIdx, subValue, formClean: cleanState, notes: notes.value });
    cta.textContent = 'Logged ✓';
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
  const tierIdx = tiers && hist.length ? Math.min(Math.max(Math.round(hist[0].value ?? 0), 0), tiers.length - 1) : null;

  openDetail({
    kicker: 'Movement history', title: spec.name,
    ladder: tiers ? tiers.map((t, i) => ({ name: t, reached: i < tierIdx, current: i === tierIdx, meta: i < tierIdx ? 'cleared' : (i === tierIdx ? 'here' : '') })) : null,
    bars: hist.map((h, i) => ({ label: `W${h.week}`, value: h.value ?? 0, clean: h.form_clean })),
    sections: [{
      title: 'Every result',
      rows: hist.slice().reverse().map(h => ({ name: `Week ${h.week}`, value: `${h.value ?? ''}${spec.suffix || ''}${h.form_clean ? ' ✓' : ' held'}`, color: h.form_clean ? 'var(--moss-hi)' : 'var(--clay-hi)' }))
    }]
  });
}

import { el, clear } from './dom.js';
import { EXERCISES, exerciseType, exerciseTiers, formatEntryValue } from '../data/exercises.js';
import { saveBaseline } from '../services/bulk-entry-service.js';
import { exportAsText, downloadText } from '../services/export-service.js';
import { restartProgram, dateForWeekDay } from '../services/calendar-service.js';
import { setRestSettings } from '../services/settings-service.js';
import { setDayTitle, setDayExercises } from '../services/program-service.js';
import { allBaselines, scheduleRetest, cancelRetest, advanceStage } from '../services/baseline-service.js';
import { signOut } from '../supabase-client.js';

function sortedDayKeys(dayPlan) {
  return Object.keys(dayPlan).map(Number).sort((a, b) => a - b);
}

// Program Builder's add-exercise picker groups (js/data/exercises.js's `category` field)
// in this fixed order — an exercise with no category (shouldn't happen, but cheaper than
// crashing on a future addition that forgets one) falls into "Other" at the end.
const CATEGORY_LABELS = { push: 'Push', pull: 'Pull', legs: 'Legs', core: 'Core', mobility: 'Mobility' };
const CATEGORY_ORDER = [...Object.keys(CATEGORY_LABELS), 'other'];

export async function renderMore(container, ctx) {
  clear(container);
  const screen = el('div', { class: 'screen' });
  container.appendChild(screen);
  drawRoot(screen, ctx);
}

function drawRoot(screen, ctx) {
  clear(screen);
  screen.appendChild(el('div', { class: 'kicker', text: 'Account · data · rules' }));
  screen.appendChild(el('div', { class: 'page-title', text: 'More' }));

  screen.appendChild(group('Data', [
    row('Bulk entry', 'Enter your Week 0 baseline, one day at a time', '→', () => drawBulkEntry(screen, ctx)),
    row('Baselines', 'Your current reference point per exercise', ctx.pendingRetestWeek != null ? 'Retest scheduled' : '→', () => drawBaselines(screen, ctx)),
    row('Program builder', 'Edit which exercises run on each day', '→', () => drawProgramBuilder(screen, ctx)),
    row('Export my log', 'Plain text, yours to keep', '→', async () => {
      const text = await exportAsText(ctx.userId);
      downloadText('the-path-export.txt', text);
    }),
    row('Restart program', 'Change your Week 0 / Day 1 date', '→', () => drawRestart(screen, ctx))
  ]));

  screen.appendChild(group('Rules', [
    row('Rest timers', 'Auto-starts after each logged set', `${ctx.restSettings.load}s / ${ctx.restSettings.default}s`, () => drawRestTimers(screen, ctx)),
    row('Sets per movement', 'Program default', '3'),
    row('Units', 'Applies to loaded lifts', 'lb')
  ]));

  screen.appendChild(group('Account', [
    row('Signed in as', ctx.email, ''),
    row('Sign out', 'This device only', '→', async () => { await signOut(); location.reload(); })
  ]));
}

function group(title, rows) {
  return el('div', {}, [
    el('div', { class: 'section-label', text: title }),
    el('div', { class: 'list-group' }, rows)
  ]);
}

function row(label, sub, value, onClick) {
  return el('button', { class: 'list-row', onClick: onClick || (() => {}) }, [
    el('div', {}, [
      el('div', { class: 'list-row__label', text: label }),
      el('div', { class: 'list-row__sub', text: sub })
    ]),
    el('div', { class: 'list-row__value', text: value })
  ]);
}

function backBtn(onClick) {
  return el('button', { class: 'btn btn--outline', style: 'margin-bottom:16px', text: '‹ Back to More', onClick });
}

function drawBulkEntry(screen, ctx) {
  clear(screen);
  screen.appendChild(backBtn(() => drawRoot(screen, ctx)));
  screen.appendChild(el('div', { class: 'page-title', text: 'Week 0 Baseline' }));
  screen.appendChild(el('div', { style: 'font:400 12.5px/1.5 var(--font-body);color:var(--text-secondary);margin-bottom:16px', text: 'Pick a day, enter your tested max for each movement, save. Repeat for every training day.' }));

  const dayPicker = el('select', { class: 'notes-field', style: 'margin-bottom:16px' },
    sortedDayKeys(ctx.dayPlan).map(d => el('option', { value: String(d), text: ctx.dayPlan[d].title }))
  );
  screen.appendChild(dayPicker);

  const formHost = el('div');
  screen.appendChild(formHost);

  function drawForm() {
    clear(formHost);
    const day = Number(dayPicker.value);
    const ids = ctx.dayPlan[day].exerciseIds;
    const inputs = {};

    for (const id of ids) {
      const spec = EXERCISES[id];
      const isTier = exerciseType(id) === 'TIER';
      const tiers = exerciseTiers(id);
      const valueInput = isTier
        ? el('select', { class: 'notes-field', style: 'margin-bottom:8px' }, tiers.map((t, i) => el('option', { value: String(i), text: t })))
        : el('input', { type: 'number', class: 'notes-field', style: 'margin-bottom:8px', placeholder: `Value (${spec.unit})` });
      const subInput = isTier ? el('input', { type: 'number', class: 'notes-field', style: 'margin-bottom:8px', placeholder: `Performance at that stage (${spec.unit})` }) : null;
      const cleanBox = el('input', { type: 'checkbox', checked: true });
      const notesInput = el('input', { type: 'text', class: 'notes-field', placeholder: 'Notes (optional)' });

      inputs[id] = { valueInput, subInput, cleanBox, notesInput };

      formHost.appendChild(el('div', { class: 'card' }, [
        el('div', { style: 'font:600 15px/1.2 var(--font-display);text-transform:uppercase;color:var(--text-primary);margin-bottom:9px', text: spec.name }),
        isTier ? el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint);margin-bottom:6px', text: 'Starting stage' }) : null,
        valueInput,
        subInput,
        el('label', { style: 'display:flex;align-items:center;gap:8px;font:400 12px/1 var(--font-body);color:var(--text-secondary);margin-bottom:8px' }, [cleanBox, 'Clean']),
        notesInput
      ]));
    }

    formHost.appendChild(el('button', {
      class: 'btn btn--primary', text: 'Save this day’s baseline',
      onClick: async () => {
        const entries = ids.map(id => ({
          exerciseId: id, day,
          value: inputs[id].valueInput.value === '' ? null : Number(inputs[id].valueInput.value),
          subValue: inputs[id].subInput ? (inputs[id].subInput.value === '' ? null : Number(inputs[id].subInput.value)) : null,
          formClean: inputs[id].cleanBox.checked,
          notes: inputs[id].notesInput.value || null
        }));
        await saveBaseline(ctx.userId, entries);
        alert(`Saved baseline for ${ctx.dayPlan[day].title}.`);
      }
    }));
  }

  dayPicker.addEventListener('change', drawForm);
  drawForm();
}

async function drawBaselines(screen, ctx) {
  clear(screen);
  screen.appendChild(backBtn(() => drawRoot(screen, ctx)));
  screen.appendChild(el('div', { class: 'page-title', text: 'Baselines' }));
  screen.appendChild(el('div', { style: 'font:400 12.5px/1.5 var(--font-body);color:var(--text-secondary);margin-bottom:16px', text: 'What the engine is currently computing every prescription from, per exercise.' }));

  if (ctx.pendingRetestWeek != null) {
    const retestDate = dateForWeekDay(ctx.startDate, ctx.skips, ctx.pendingRetestWeek, ctx.startDate.getDay());
    screen.appendChild(el('div', { class: 'card', style: 'border-color:var(--moss)' }, [
      el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--moss-hi);margin-bottom:8px', text: 'Retest scheduled' }),
      el('div', { style: 'font:400 13px/1.5 var(--font-body);color:var(--text-body)', text: `Week ${ctx.pendingRetestWeek}, starting ${retestDate.toLocaleDateString()}. Every exercise scheduled that week logs as a retest — results replace your current baselines.` }),
      el('button', {
        class: 'btn btn--outline', style: 'margin-top:13px',
        text: 'Cancel scheduled retest',
        onClick: async () => {
          await cancelRetest(ctx.userId);
          await ctx.reloadPendingRetestWeek();
          drawBaselines(screen, ctx);
        }
      })
    ]));
  } else {
    screen.appendChild(el('div', { class: 'card' }, [
      el('div', { style: 'font:400 13px/1.5 var(--font-body);color:var(--text-secondary);margin-bottom:13px', text: 'Retesting schedules next week as a test week — the Session tab prompts a fresh test for each exercise instead of prescribed work sets, gauged to your current numbers. Completing it replaces your baselines. Nothing else about your program restarts.' }),
      el('button', {
        class: 'btn btn--primary',
        text: 'Retest next week',
        onClick: async () => {
          const nextWeek = ctx.todayWeekDay.week + 1;
          const nextDate = dateForWeekDay(ctx.startDate, ctx.skips, nextWeek, ctx.startDate.getDay());
          if (!confirm(`Schedule Week ${nextWeek} (starting ${nextDate.toLocaleDateString()}) as a retest week?`)) return;
          await scheduleRetest(ctx.userId, nextWeek);
          await ctx.reloadPendingRetestWeek();
          drawBaselines(screen, ctx);
        }
      })
    ]));
  }

  const baselines = await allBaselines(ctx.userId);
  const byExercise = Object.fromEntries(baselines.map(b => [b.exercise_id, b]));

  for (const day of sortedDayKeys(ctx.dayPlan)) {
    if (ctx.dayPlan[day].exerciseIds.length === 0) continue; // rest day — nothing to show a baseline for
    screen.appendChild(el('div', { class: 'section-label', text: ctx.dayPlan[day].title }));
    screen.appendChild(el('div', { class: 'list-group' }, ctx.dayPlan[day].exerciseIds
      .filter(id => exerciseType(id) !== 'SCREEN')
      .map(id => {
        const spec = EXERCISES[id];
        const b = byExercise[id];
        if (!b) return row(spec.name, 'Not yet tested', '—');
        const isTier = exerciseType(id) === 'TIER';
        const tiers = isTier ? exerciseTiers(id) : null;
        const currentIdx = isTier ? Math.min(Math.max(Math.round(b.value ?? 0), 0), tiers.length - 1) : null;
        const canAdvance = isTier && currentIdx < tiers.length - 1;
        const onClick = canAdvance ? async () => {
          const nextWeek = ctx.todayWeekDay.week + 1;
          const nextStage = tiers[currentIdx + 1];
          if (!confirm(`Advance ${spec.name} from "${tiers[currentIdx]}" to "${nextStage}"? Working reps/time reset to a fresh starting point for the new stage, effective next week. Only ${spec.name} is affected — every other exercise keeps progressing at its own current stage.`)) return;
          await advanceStage(ctx.userId, id, nextWeek, day);
          drawBaselines(screen, ctx);
        } : undefined;
        return row(spec.name, `Week ${b.week}`, formatEntryValue(id, b) ?? '—', onClick);
      })
    ));
  }
}

function drawProgramBuilder(screen, ctx) {
  clear(screen);
  screen.appendChild(backBtn(() => drawRoot(screen, ctx)));
  screen.appendChild(el('div', { class: 'page-title', text: 'Program Builder' }));
  screen.appendChild(el('div', { style: 'font:400 12.5px/1.5 var(--font-body);color:var(--text-secondary);margin-bottom:16px', text: 'Pick a day, rename it, add or remove exercises, reorder with the arrows. A day with no exercises is a rest day.' }));

  const dayPicker = el('select', { class: 'notes-field', style: 'margin-bottom:16px' },
    sortedDayKeys(ctx.dayPlan).map(d => el('option', { value: String(d), text: ctx.dayPlan[d].title }))
  );
  screen.appendChild(dayPicker);

  const formHost = el('div');
  screen.appendChild(formHost);

  function drawForm() {
    clear(formHost);
    const day = Number(dayPicker.value);
    const plan = ctx.dayPlan[day];
    const draftIds = [...plan.exerciseIds]; // local working copy — nothing writes to Supabase until Save

    formHost.appendChild(el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint);margin-bottom:6px', text: 'Day title' }));
    const titleInput = el('input', { type: 'text', class: 'notes-field', style: 'margin-bottom:16px', value: plan.title });
    formHost.appendChild(titleInput);

    const countLabel = el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint);margin-bottom:6px' });
    formHost.appendChild(countLabel);
    const listHost = el('div', { class: 'list-group', style: 'margin-bottom:16px' });
    formHost.appendChild(listHost);

    function updateCount() {
      countLabel.textContent = draftIds.length === 0 ? 'Exercises (rest day)' : `Exercises (${draftIds.length} movement${draftIds.length === 1 ? '' : 's'})`;
    }

    function drawExerciseList() {
      updateCount();
      clear(listHost);
      draftIds.forEach((id, i) => {
        const spec = EXERCISES[id];
        listHost.appendChild(el('div', { class: 'list-row' }, [
          el('div', {}, [el('div', { class: 'list-row__label', text: spec.name })]),
          el('div', { style: 'display:flex;gap:6px;flex:none' }, [
            el('button', {
              class: 'btn btn--outline', style: 'padding:4px 10px', text: '↑', disabled: i === 0 ? true : undefined,
              onClick: () => { [draftIds[i - 1], draftIds[i]] = [draftIds[i], draftIds[i - 1]]; drawExerciseList(); }
            }),
            el('button', {
              class: 'btn btn--outline', style: 'padding:4px 10px', text: '↓', disabled: i === draftIds.length - 1 ? true : undefined,
              onClick: () => { [draftIds[i + 1], draftIds[i]] = [draftIds[i], draftIds[i + 1]]; drawExerciseList(); }
            }),
            el('button', {
              class: 'btn btn--outline', style: 'padding:4px 10px', text: '✕',
              onClick: () => { draftIds.splice(i, 1); drawExerciseList(); refreshAddPicker(); }
            })
          ])
        ]));
      });
    }

    formHost.appendChild(el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint);margin:16px 0 6px', text: 'Add exercise' }));
    const searchInput = el('input', { type: 'text', class: 'notes-field', style: 'margin-bottom:8px', placeholder: 'Search the library…' });
    formHost.appendChild(searchInput);
    const addPicker = el('select', { class: 'notes-field', style: 'margin-bottom:8px' });
    formHost.appendChild(addPicker);

    function refreshAddPicker() {
      clear(addPicker);
      addPicker.appendChild(el('option', { value: '', text: '— choose an exercise —' }));
      const term = searchInput.value.trim().toLowerCase();
      const available = Object.keys(EXERCISES)
        .filter(id => !EXERCISES[id].deprecated && !draftIds.includes(id))
        .filter(id => !term || EXERCISES[id].name.toLowerCase().includes(term));
      for (const cat of CATEGORY_ORDER) {
        const ids = available
          .filter(id => (EXERCISES[id].category || 'other') === cat)
          .sort((a, b) => EXERCISES[a].name.localeCompare(EXERCISES[b].name));
        if (!ids.length) continue;
        addPicker.appendChild(el('optgroup', { label: CATEGORY_LABELS[cat] || 'Other' },
          ids.map(id => el('option', { value: id, text: EXERCISES[id].name }))
        ));
      }
    }
    searchInput.addEventListener('input', refreshAddPicker);

    formHost.appendChild(el('button', {
      class: 'btn btn--outline', style: 'margin-bottom:16px', text: 'Add to this day',
      onClick: () => {
        if (!addPicker.value) return;
        draftIds.push(addPicker.value);
        drawExerciseList();
        refreshAddPicker();
      }
    }));

    formHost.appendChild(el('button', {
      class: 'btn btn--primary', text: 'Save this day',
      onClick: async () => {
        await setDayTitle(ctx.userId, day, titleInput.value.trim() || plan.title);
        await setDayExercises(ctx.userId, day, draftIds);
        await ctx.reloadDayPlan();
        drawProgramBuilder(screen, ctx);
      }
    }));

    drawExerciseList();
    refreshAddPicker();
  }

  dayPicker.addEventListener('change', drawForm);
  drawForm();
}

function drawRestTimers(screen, ctx) {
  clear(screen);
  screen.appendChild(backBtn(() => drawRoot(screen, ctx)));
  screen.appendChild(el('div', { class: 'page-title', text: 'Rest Timers' }));
  screen.appendChild(el('div', { style: 'font:400 12.5px/1.5 var(--font-body);color:var(--text-secondary);margin-bottom:16px', text: 'How long the rest timer runs after you log a set, by exercise type. Starts automatically every time.' }));

  screen.appendChild(el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint);margin-bottom:6px', text: 'Barbell lifts (squat, deadlift, bench)' }));
  const loadInput = el('input', { type: 'number', class: 'notes-field', style: 'margin-bottom:16px', value: String(ctx.restSettings.load), min: '0', step: '15' });
  screen.appendChild(loadInput);

  screen.appendChild(el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint);margin-bottom:6px', text: 'Everything else (holds, reps, staged movements)' }));
  const defaultInput = el('input', { type: 'number', class: 'notes-field', style: 'margin-bottom:16px', value: String(ctx.restSettings.default), min: '0', step: '15' });
  screen.appendChild(defaultInput);

  screen.appendChild(el('button', {
    class: 'btn btn--primary', text: 'Save',
    onClick: async () => {
      const load = Math.max(0, Number(loadInput.value) || 0);
      const defaultSeconds = Math.max(0, Number(defaultInput.value) || 0);
      await setRestSettings(ctx.userId, { load, default: defaultSeconds });
      await ctx.reloadRestSettings();
      drawRoot(screen, ctx);
    }
  }));
}

function drawRestart(screen, ctx) {
  clear(screen);
  screen.appendChild(backBtn(() => drawRoot(screen, ctx)));
  screen.appendChild(el('div', { class: 'page-title', text: 'Restart Program' }));
  screen.appendChild(el('div', { style: 'font:400 12.5px/1.5 var(--font-body);color:var(--text-secondary);margin-bottom:16px', text: 'Sets a new Week 0 / Day 1 date and clears every vacation week you’ve recorded, so future dates aren’t misaligned against the old timeline. Your logged history is not deleted.' }));

  const dateInput = el('input', { type: 'date', class: 'notes-field', style: 'margin-bottom:16px' });
  if (ctx.startDate) dateInput.value = ctx.startDate.toISOString().slice(0, 10);
  screen.appendChild(dateInput);

  screen.appendChild(el('button', {
    class: 'btn btn--primary', text: 'Restart program',
    onClick: async () => {
      if (!dateInput.value) return;
      if (!confirm('This clears all recorded vacation weeks and re-anchors your calendar to the new date. Continue?')) return;
      await restartProgram(ctx.userId, new Date(dateInput.value + 'T00:00:00'));
      await ctx.reloadCalendar();
      alert('Program restarted.');
      ctx.navigate('home');
    }
  }));
}

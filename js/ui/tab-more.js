import { el, clear } from './dom.js';
import { exerciseIdsForDay, dayMeta } from '../data/day-plan.js';
import { EXERCISES, exerciseType, exerciseTiers } from '../data/exercises.js';
import { saveBaseline } from '../services/bulk-entry-service.js';
import { exportAsText, downloadText } from '../services/export-service.js';
import { restartProgram } from '../services/calendar-service.js';
import { signOut } from '../supabase-client.js';

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
    row('Export my log', 'Plain text, yours to keep', '→', async () => {
      const text = await exportAsText(ctx.userId);
      downloadText('the-path-export.txt', text);
    }),
    row('Restart program', 'Change your Week 0 / Day 1 date', '→', () => drawRestart(screen, ctx))
  ]));

  screen.appendChild(group('Rules', [
    row('Rest timer', 'Auto-starts after each logged set', '90s'),
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
    [1, 2, 3, 4, 5, 6].map(d => el('option', { value: String(d), text: dayMeta(d).title }))
  );
  screen.appendChild(dayPicker);

  const formHost = el('div');
  screen.appendChild(formHost);

  function drawForm() {
    clear(formHost);
    const day = Number(dayPicker.value);
    const ids = exerciseIdsForDay(day);
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
        alert(`Saved baseline for ${dayMeta(day).title}.`);
      }
    }));
  }

  dayPicker.addEventListener('change', drawForm);
  drawForm();
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

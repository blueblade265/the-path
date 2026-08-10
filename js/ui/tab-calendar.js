import { el, clear } from './dom.js';
import { exerciseIdsForDay, dayMeta } from '../data/day-plan.js';
import { EXERCISES, formatEntryValue } from '../data/exercises.js';
import { allEntries } from '../services/entries-repo.js';
import { dateForWeekDay, weekDayForDate, skipWeek } from '../services/calendar-service.js';

const DOW_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export async function renderCalendar(container, ctx, target) {
  clear(container);
  const screen = el('div', { class: 'screen' });
  container.appendChild(screen);

  const entries = await allEntries(ctx.userId);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // If today is before the program's start date (a future start date), there's no
  // "today" within the program to default to — land on start_date itself instead.
  let selectedDate = target ? dateForWeekDay(ctx.startDate, ctx.skips, target.week, target.day) : (today < ctx.startDate ? ctx.startDate : today);
  let weekOffset = Math.round((startOfWeek(selectedDate) - startOfWeek(today)) / (7 * 86400000));
  let monthOpen = false;

  function draw() {
    clear(screen);
    const viewSunday = addDays(startOfWeek(today), weekOffset * 7);

    screen.appendChild(el('div', { style: 'display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:16px' }, [
      el('div', {}, [
        el('div', { class: 'kicker', text: `Week of ${viewSunday.getMonth() + 1}/${viewSunday.getDate()}` }),
        el('div', { class: 'page-title', style: 'margin-bottom:0', text: MONTH_NAMES[selectedDate.getMonth()] })
      ]),
      el('div', { style: 'font:500 10px/1 var(--font-mono);letter-spacing:.09em;text-transform:uppercase;color:var(--amber);cursor:pointer;padding:6px 2px', text: monthOpen ? 'Hide month' : 'Whole month', onClick: () => { monthOpen = !monthOpen; draw(); } })
    ]));

    screen.appendChild(el('div', { style: 'display:flex;align-items:stretch;gap:8px;margin-bottom:12px' }, [
      arrowBtn('‹', () => { weekOffset--; draw(); }),
      el('div', { class: 'week-strip' }, Array.from({ length: 7 }, (_, i) => {
        const d = addDays(viewSunday, i);
        return dayTile(d, ctx, entries, selectedDate, (picked) => { selectedDate = picked; draw(); });
      })),
      arrowBtn('›', () => { weekOffset++; draw(); })
    ]));

    if (monthOpen) {
      screen.appendChild(monthGrid(selectedDate, ctx, entries, (picked) => { selectedDate = picked; weekOffset = Math.round((startOfWeek(picked) - startOfWeek(today)) / (7 * 86400000)); draw(); }));
    }

    screen.appendChild(selectedDayCard(selectedDate, ctx, entries, today));
  }

  draw();
}

function arrowBtn(label, onClick) {
  return el('div', { style: 'flex:none;width:32px;border-radius:10px;border:1px solid var(--card-border);display:flex;align-items:center;justify-content:center;font:400 15px/1 var(--font-body);color:var(--text-secondary);cursor:pointer', text: label, onClick });
}

function dayTile(date, ctx, entries, selectedDate, onPick) {
  const wd = weekDayForDate(ctx.startDate, ctx.skips, date);

  if (!wd) {
    // Before the program started — dimmed, not selectable.
    return el('div', { class: 'day-tile', style: 'opacity:.35' }, [
      el('div', { class: 'day-tile__dow', text: DOW_LETTERS[date.getDay()] }),
      el('div', { class: 'day-tile__num', text: String(date.getDate()) }),
      el('div', { class: 'day-tile__dot' })
    ]);
  }

  const { week, day } = wd;
  const meta = dayMeta(day);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cmp = new Date(date); cmp.setHours(0, 0, 0, 0);
  const logged = entries.some(e => e.week === week && e.day === day);
  const isPast = cmp < today;
  const isSelected = cmp.getTime() === new Date(selectedDate).setHours(0, 0, 0, 0);
  const dotColor = meta.rest ? 'var(--card-border-alt)' : (logged ? 'var(--moss)' : (isPast ? 'var(--clay)' : 'var(--card-border-strong)'));

  return el('div', {
    class: `day-tile${isSelected ? ' day-tile--selected' : ''}`,
    onClick: () => onPick(date)
  }, [
    el('div', { class: 'day-tile__dow', text: DOW_LETTERS[date.getDay()] }),
    el('div', { class: 'day-tile__num', text: String(date.getDate()) }),
    el('div', { class: 'day-tile__dot', style: `background:${dotColor}` })
  ]);
}

function monthGrid(selectedDate, ctx, entries, onPick) {
  const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const gridStart = addDays(first, -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = addDays(gridStart, i);
    const inMonth = d.getMonth() === selectedDate.getMonth();
    if (!inMonth) return el('div', { class: 'month-cell' });
    const wd = weekDayForDate(ctx.startDate, ctx.skips, d);
    if (!wd) {
      // Before the program started — shown but dimmed, not selectable.
      return el('div', { class: 'month-cell', style: 'opacity:.3' }, [
        el('div', { style: 'font:500 12px/1 var(--font-display);color:var(--text-body)', text: String(d.getDate()) }),
        el('div', { style: 'width:4px;height:4px' })
      ]);
    }
    const { week, day } = wd;
    const meta = dayMeta(day);
    const logged = entries.some(e => e.week === week && e.day === day);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cmp = new Date(d); cmp.setHours(0, 0, 0, 0);
    const isSelected = cmp.getTime() === new Date(selectedDate).setHours(0, 0, 0, 0);
    const dotColor = meta.rest ? 'transparent' : (logged ? 'var(--moss)' : (cmp < today ? 'var(--clay)' : 'var(--card-border-alt)'));
    return el('div', { class: `month-cell${isSelected ? ' month-cell--selected' : ''}`, onClick: () => onPick(d) }, [
      el('div', { style: `font:500 12px/1 var(--font-display);color:${isSelected ? 'var(--text-primary)' : 'var(--text-body)'}`, text: String(d.getDate()) }),
      el('div', { style: `width:4px;height:4px;border-radius:50%;background:${dotColor}` })
    ]);
  });
  return el('div', { class: 'card', style: 'animation:fadeIn .2s' }, [
    el('div', { class: 'month-grid', style: 'margin-bottom:9px' }, DOW_LETTERS.map(l => el('div', { style: 'text-align:center;font:600 9px/1 var(--font-mono);color:var(--text-ghost)', text: l }))),
    el('div', { class: 'month-grid' }, cells)
  ]);
}

function selectedDayCard(date, ctx, entries, today) {
  const wd = weekDayForDate(ctx.startDate, ctx.skips, date);
  if (!wd) {
    return el('div', { class: 'card' }, [
      el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px', text: 'Before your program' }),
      el('div', { style: 'font:600 24px/1.05 var(--font-display);text-transform:uppercase;color:var(--text-primary)', text: 'Not started yet' }),
      el('div', { style: 'font:400 12px/1.4 var(--font-body);color:var(--text-secondary);margin-top:5px', text: `Your program starts ${ctx.startDate.toLocaleDateString()}. Nothing was scheduled before that.` })
    ]);
  }
  const { week, day } = wd;
  const meta = dayMeta(day);
  const cmp = new Date(date); cmp.setHours(0, 0, 0, 0);
  const isToday = cmp.getTime() === today.getTime();
  const isPast = cmp < today;
  const ids = exerciseIdsForDay(day);
  const dayEntries = entries.filter(e => e.week === week && e.day === day);
  const missed = isPast && !meta.rest && dayEntries.length === 0;

  const kicker = isToday ? 'Today' : (missed ? 'Missed — nothing logged' : (isPast ? 'Logged' : 'Scheduled'));
  const rows = meta.rest ? [{ name: 'Rest day', value: '—' }] : ids.map(id => {
    const e = dayEntries.find(x => x.exercise_id === id);
    const name = EXERCISES[id].name;
    if (!e) return { name, value: isPast ? 'not logged' : 'to do' };
    return { name, value: `${formatEntryValue(id, e)}${e.form_clean ? ' ✓' : ''}` };
  });

  const card = el('div', { class: 'card' }, [
    el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px', text: kicker }),
    el('div', { style: 'font:600 24px/1.05 var(--font-display);text-transform:uppercase;color:var(--text-primary)', text: meta.title }),
    el('div', { style: 'font:400 12px/1.4 var(--font-body);color:var(--text-secondary);margin:5px 0 14px', text: meta.meta }),
    ...rows.map(r => el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--card-border-alt)' }, [
      el('div', { style: 'font:400 13px/1.3 var(--font-body);color:var(--text-body)', text: r.name }),
      el('div', { style: 'flex:none;font:400 11.5px/1 var(--font-mono);color:var(--text-secondary)', text: r.value })
    ]))
  ]);

  if (!meta.rest) {
    card.appendChild(el('button', {
      class: 'btn btn--primary', style: 'margin-top:15px',
      text: missed ? 'Backfill this day' : (isToday ? 'Open today' : (isPast ? 'Open · read-only' : 'Preview the day')),
      onClick: () => ctx.navigate('session', { week, day })
    }));
  }

  if (date.getDay() === 0 && !isPast) {
    card.appendChild(el('button', {
      class: 'btn btn--outline', style: 'margin-top:9px',
      text: `Skip week ${week + 1} (vacation)`,
      onClick: async () => {
        await skipWeek(ctx.userId, week + 1);
        alert(`Week ${week + 1} will now land one calendar week later than planned.`);
      }
    }));
  }

  return card;
}

function startOfWeek(date) { return addDays(date, -date.getDay()); }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); d.setHours(0, 0, 0, 0); return d; }

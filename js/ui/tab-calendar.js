import { el, clear } from './dom.js';
import { EXERCISES, formatEntryValue } from '../data/exercises.js';
import { allEntries } from '../services/entries-repo.js';
import { dateForWeekDay, weekDayForDate, skipWeek } from '../services/calendar-service.js';
import { getScheduleOverrides, overridesToMap, applyReschedule, resetWeek } from '../services/schedule-service.js';
import { planAt, idsAt, isMoved, originOf, slotAt, isDayDone, shiftable, buildMovePayload, buildShiftPayload } from '../services/schedule-resolver.js';

const DOW_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export async function renderCalendar(container, ctx, target) {
  clear(container);
  const screen = el('div', { class: 'screen' });
  container.appendChild(screen);
  // Sibling of `screen`, not a child — draw() clears/rebuilds `screen` on every state
  // change, and an open reschedule sheet must survive that (e.g. a background re-render
  // triggered by tab focus regain must not silently dismiss an open sheet mid-move).
  const sheetHost = el('div');
  container.appendChild(sheetHost);

  let entries = await allEntries(ctx.userId);
  let overrides = overridesToMap(await getScheduleOverrides(ctx.userId));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // If today is before the program's start date (a future start date), there's no
  // "today" within the program to default to — land on start_date itself instead.
  let selectedDate = target ? dateForWeekDay(ctx.startDate, ctx.skips, target.week, target.day) : (today < ctx.startDate ? ctx.startDate : today);
  let weekOffset = Math.round((startOfWeek(selectedDate) - startOfWeek(today)) / (7 * 86400000));
  let monthOpen = false;

  async function reload() {
    entries = await allEntries(ctx.userId);
    overrides = overridesToMap(await getScheduleOverrides(ctx.userId));
  }

  function closeSheet() { clear(sheetHost); }

  function openMoveSheet(week, day) {
    clear(sheetHost);
    sheetHost.appendChild(buildRescheduleSheet(ctx, entries, overrides, week, day, today,
      async (newDate) => {
        await reload();
        if (newDate) selectedDate = newDate;
        closeSheet();
        draw();
      },
      closeSheet
    ));
  }

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
        return dayTile(d, ctx, entries, overrides, selectedDate, (picked) => { selectedDate = picked; draw(); });
      })),
      arrowBtn('›', () => { weekOffset++; draw(); })
    ]));

    if (monthOpen) {
      screen.appendChild(monthGrid(selectedDate, ctx, entries, overrides, (picked) => { selectedDate = picked; weekOffset = Math.round((startOfWeek(picked) - startOfWeek(today)) / (7 * 86400000)); draw(); }));
    }

    screen.appendChild(selectedDayCard(selectedDate, ctx, entries, overrides, today, openMoveSheet));
  }

  draw();
}

function arrowBtn(label, onClick) {
  return el('div', { style: 'flex:none;width:32px;border-radius:10px;border:1px solid var(--card-border);display:flex;align-items:center;justify-content:center;font:400 15px/1 var(--font-body);color:var(--text-secondary);cursor:pointer', text: label, onClick });
}

function dayTile(date, ctx, entries, overrides, selectedDate, onPick) {
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
  const meta = planAt(ctx.dayPlan, overrides, week, day);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cmp = new Date(date); cmp.setHours(0, 0, 0, 0);
  const logged = entries.some(e => e.week === week && e.day === day);
  const isPast = cmp < today;
  const isSelected = cmp.getTime() === new Date(selectedDate).setHours(0, 0, 0, 0);
  const dotColor = meta.rest ? 'var(--card-border-alt)' : (logged ? 'var(--moss)' : (isPast ? 'var(--clay)' : 'var(--card-border-strong)'));
  const ring = isMoved(overrides, week, day) ? '0 0 0 2.5px rgba(209,154,46,.4)' : 'transparent';

  return el('div', {
    class: `day-tile${isSelected ? ' day-tile--selected' : ''}`,
    onClick: () => onPick(date)
  }, [
    el('div', { class: 'day-tile__dow', text: DOW_LETTERS[date.getDay()] }),
    el('div', { class: 'day-tile__num', text: String(date.getDate()) }),
    el('div', { class: 'day-tile__dot', style: `background:${dotColor};box-shadow:${ring}` })
  ]);
}

function monthGrid(selectedDate, ctx, entries, overrides, onPick) {
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
    const meta = planAt(ctx.dayPlan, overrides, week, day);
    const logged = entries.some(e => e.week === week && e.day === day);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cmp = new Date(d); cmp.setHours(0, 0, 0, 0);
    const isSelected = cmp.getTime() === new Date(selectedDate).setHours(0, 0, 0, 0);
    const dotColor = meta.rest ? 'transparent' : (logged ? 'var(--moss)' : (cmp < today ? 'var(--clay)' : 'var(--card-border-alt)'));
    const ring = isMoved(overrides, week, day) ? '0 0 0 2px rgba(209,154,46,.4)' : 'transparent';
    return el('div', { class: `month-cell${isSelected ? ' month-cell--selected' : ''}`, onClick: () => onPick(d) }, [
      el('div', { style: `font:500 12px/1 var(--font-display);color:${isSelected ? 'var(--text-primary)' : 'var(--text-body)'}`, text: String(d.getDate()) }),
      el('div', { style: `width:4px;height:4px;border-radius:50%;background:${dotColor};box-shadow:${ring}` })
    ]);
  });
  return el('div', { class: 'card', style: 'animation:fadeIn .2s' }, [
    el('div', { class: 'month-grid', style: 'margin-bottom:9px' }, DOW_LETTERS.map(l => el('div', { style: 'text-align:center;font:600 9px/1 var(--font-mono);color:var(--text-ghost)', text: l }))),
    el('div', { class: 'month-grid' }, cells)
  ]);
}

function selectedDayCard(date, ctx, entries, overrides, today, onMove) {
  const wd = weekDayForDate(ctx.startDate, ctx.skips, date);
  if (!wd) {
    return el('div', { class: 'card' }, [
      el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px', text: 'Before your program' }),
      el('div', { style: 'font:600 24px/1.05 var(--font-display);text-transform:uppercase;color:var(--text-primary)', text: 'Not started yet' }),
      el('div', { style: 'font:400 12px/1.4 var(--font-body);color:var(--text-secondary);margin-top:5px', text: `Your program starts ${ctx.startDate.toLocaleDateString()}. Nothing was scheduled before that.` })
    ]);
  }
  const { week, day } = wd;
  const meta = planAt(ctx.dayPlan, overrides, week, day);
  const cmp = new Date(date); cmp.setHours(0, 0, 0, 0);
  const isToday = cmp.getTime() === today.getTime();
  const isPast = cmp < today;
  const ids = meta.exerciseIds;
  const dayEntries = entries.filter(e => e.week === week && e.day === day);
  const missed = isPast && !meta.rest && dayEntries.length === 0;
  const done = isDayDone(entries, ids, week, day);
  const moved = isMoved(overrides, week, day);

  const kicker = isToday ? 'Today' : (missed ? 'Missed — nothing logged' : (isPast ? 'Logged' : 'Scheduled'));
  const rows = meta.rest ? [{ name: meta.open ? 'Nothing here' : 'Rest day', value: '—' }] : ids.map(id => {
    const e = dayEntries.find(x => x.exercise_id === id);
    const name = EXERCISES[id].name;
    if (!e) return { name, value: isPast ? 'not logged' : 'to do' };
    return { name, value: `${formatEntryValue(id, e)}${e.form_clean ? ' ✓' : ''}` };
  });

  const card = el('div', { class: 'card' }, [
    el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px', text: kicker }),
    el('div', { style: 'font:600 24px/1.05 var(--font-display);text-transform:uppercase;color:var(--text-primary)', text: meta.title }),
    el('div', { style: 'font:400 12px/1.4 var(--font-body);color:var(--text-secondary);margin:5px 0 14px', text: meta.rest ? 'Nothing scheduled' : `${ids.length} movement${ids.length === 1 ? '' : 's'}` }),
    moved ? movedBadge(ctx, overrides, week, day) : null,
    ...rows.map(r => el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--card-border-alt)' }, [
      el('div', { style: 'font:400 13px/1.3 var(--font-body);color:var(--text-body)', text: r.name }),
      el('div', { style: 'flex:none;font:400 11.5px/1 var(--font-mono);color:var(--text-secondary)', text: r.value })
    ]))
  ]);

  const canMove = !meta.rest && !isPast && !done;

  if (!meta.rest || canMove) {
    const primaryBtn = !meta.rest ? el('button', {
      class: 'btn btn--primary', style: 'flex:1',
      text: missed ? 'Backfill this day' : (isToday ? 'Open today' : (isPast ? 'Open · read-only' : 'Preview the day')),
      onClick: () => ctx.navigate('session', { week, day })
    }) : null;
    const moveBtn = canMove ? el('button', { class: 'btn-move', text: 'Move', onClick: () => onMove(week, day) }) : null;
    if (primaryBtn || moveBtn) {
      card.appendChild(el('div', { style: 'display:flex;gap:8px;margin-top:15px' }, [primaryBtn, moveBtn]));
    }
  }

  if (!meta.rest && !canMove && !isPast) {
    card.appendChild(el('div', { style: 'font:400 10.5px/1.5 var(--font-mono);color:var(--text-faint);margin-top:10px;text-align:center', text: 'Finished — this day stays where you did it.' }));
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

function movedBadge(ctx, overrides, week, day) {
  const origin = originOf(overrides, week, day);
  const slot = slotAt(overrides, week, day);
  let text;
  if (origin !== day) {
    const originDate = dateForWeekDay(ctx.startDate, ctx.skips, week, origin);
    text = `Moved here from ${DOW_NAMES[origin]} ${originDate.getDate()}`;
  } else if (slot === null) {
    text = 'This day was cleared';
  } else {
    text = 'Rescheduled inside this week';
  }
  return el('div', { class: 'moved-badge' }, [
    el('div', { class: 'moved-badge__marker' }),
    el('div', { class: 'moved-badge__text', text })
  ]);
}

function buildRescheduleSheet(ctx, entries, overrides, week, day, today, onApplied, onClose) {
  const meta = planAt(ctx.dayPlan, overrides, week, day);
  const date = dateForWeekDay(ctx.startDate, ctx.skips, week, day);

  async function applyMove(otherDay, targetDate) {
    const rows = buildMovePayload(ctx.dayPlan, overrides, week, day, otherDay);
    await applyReschedule(week, rows);
    onApplied(targetDate);
  }

  async function applyShift(dir) {
    const rows = buildShiftPayload(ctx.dayPlan, overrides, entries, week, ctx.startDate, ctx.skips, today, dir);
    if (!rows) return;
    await applyReschedule(week, rows);
    onApplied(null);
  }

  async function applyReset() {
    await resetWeek(week);
    onApplied(null);
  }

  const otherDays = [1, 2, 3, 4, 5, 6, 0].filter(d => d !== day);
  const moveRows = otherDays.map(otherDay => moveTargetRow(ctx, overrides, entries, week, otherDay, today, applyMove));

  const shiftDates = shiftable(ctx.dayPlan, overrides, entries, week, ctx.startDate, ctx.skips, today);
  const shiftDisabled = shiftDates.length < 2;
  const spanCopy = shiftDisabled ? '' : (() => {
    const first = shiftDates[0], last = shiftDates[shiftDates.length - 1];
    const firstDate = dateForWeekDay(ctx.startDate, ctx.skips, week, first.day);
    const lastDate = dateForWeekDay(ctx.startDate, ctx.skips, week, last.day);
    return `${DOW_NAMES[first.day]} ${firstDate.getDate()} → ${DOW_NAMES[last.day]} ${lastDate.getDate()}`;
  })();
  const disabledSub = 'Not available — no unfinished days left in this week.';

  const hasOverridesThisWeek = [0, 1, 2, 3, 4, 5, 6].some(d => overrides.has(`${week}:${d}`));

  const body = [
    el('div', { class: 'section-label', text: 'Move this session to' }),
    el('div', { style: 'margin-bottom:26px' }, moveRows),
    el('div', { class: 'section-label', text: 'Or shift the whole week' }),
    el('div', { style: 'margin-bottom:26px' }, [
      shiftRow('Push the week back a day', shiftDisabled ? disabledSub : `${spanCopy} slide one day later. Finished and past days stay where they are.`, shiftDisabled, () => applyShift(1)),
      shiftRow('Pull the week forward a day', shiftDisabled ? disabledSub : `${spanCopy} slide one day earlier. Finished and past days stay where they are.`, shiftDisabled, () => applyShift(-1))
    ])
  ];

  if (hasOverridesThisWeek) {
    body.push(el('div', {
      class: 'reschedule-row', style: 'background:transparent;border-color:var(--card-border-strong);margin-bottom:22px',
      onClick: applyReset
    }, [
      el('div', {}, [
        el('div', { style: 'font:500 14px/1 var(--font-display);letter-spacing:.02em;text-transform:uppercase;color:var(--clay-hi)', text: 'Put this week back' }),
        el('div', { style: 'font:400 11.5px/1.35 var(--font-body);color:var(--text-muted);margin-top:5px', text: 'Restores the program order for this week only.' })
      ])
    ]));
  }

  body.push(el('div', {
    class: 'reschedule-footnote',
    text: 'Moves stay inside this week. Next week and every week after it keep the program order. A part-logged day can still move — the sets you have already logged travel with it. A finished day stays where you did it.'
  }));

  return el('div', { class: 'sheet' }, [
    el('div', { class: 'sheet__header' }, [
      el('div', {}, [
        el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--amber);margin-bottom:8px', text: 'Reschedule' }),
        el('div', { style: 'font:600 24px/1.05 var(--font-display);text-transform:uppercase;color:var(--text-primary)', text: `${DOW_NAMES[day]} ${date.getDate()} · ${meta.title}` })
      ]),
      el('button', { class: 'sheet__close', text: '✕', onClick: onClose })
    ]),
    el('div', { class: 'sheet__body' }, body)
  ]);
}

function moveTargetRow(ctx, overrides, entries, week, otherDay, today, onApply) {
  const date = dateForWeekDay(ctx.startDate, ctx.skips, week, otherDay);
  const cmp = new Date(date); cmp.setHours(0, 0, 0, 0);
  const isPast = cmp < today;
  const ids = idsAt(ctx.dayPlan, overrides, week, otherDay);
  const done = isDayDone(entries, ids, week, otherDay);
  const label = `${DOW_NAMES[otherDay]} ${date.getDate()}`;

  let sub, tag, tagColor, borderColor, labelColor, tappable;
  if (isPast) {
    sub = 'Already gone by'; tag = 'past';
    tagColor = 'var(--text-faint)'; borderColor = 'var(--card-border-alt)'; labelColor = 'var(--text-faint)'; tappable = false;
  } else if (done) {
    sub = 'Finished — stays put'; tag = 'done';
    tagColor = 'var(--text-faint)'; borderColor = 'var(--card-border-alt)'; labelColor = 'var(--text-faint)'; tappable = false;
  } else if (ids.length === 0) {
    sub = slotAt(overrides, week, otherDay) === null ? 'Open — nothing here' : 'Rest day';
    tag = 'move here'; tagColor = 'var(--moss-hi)'; borderColor = 'var(--card-border-strong)'; labelColor = 'var(--text-primary)'; tappable = true;
  } else {
    sub = planAt(ctx.dayPlan, overrides, week, otherDay).title;
    tag = 'swap'; tagColor = 'var(--amber)'; borderColor = 'var(--card-border)'; labelColor = 'var(--text-primary)'; tappable = true;
  }

  return el('div', {
    class: `reschedule-row${tappable ? '' : ' reschedule-row--locked'}`,
    style: `border-color:${borderColor}`,
    onClick: tappable ? () => onApply(otherDay, date) : null
  }, [
    el('div', { style: 'min-width:0' }, [
      el('div', { style: `font:500 14px/1 var(--font-display);letter-spacing:.02em;text-transform:uppercase;color:${labelColor}`, text: label }),
      el('div', { style: 'font:400 11.5px/1.35 var(--font-body);color:var(--text-muted);margin-top:4px', text: sub })
    ]),
    el('div', { style: `flex:none;font:600 9.5px/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:${tagColor}`, text: tag })
  ]);
}

function shiftRow(label, sub, disabled, onClick) {
  return el('div', {
    class: `reschedule-row${disabled ? ' reschedule-row--locked' : ''}`,
    style: disabled ? 'border-color:var(--card-border-alt)' : '',
    onClick: disabled ? null : onClick
  }, [
    el('div', {}, [
      el('div', { style: `font:500 14px/1 var(--font-display);letter-spacing:.02em;text-transform:uppercase;color:${disabled ? 'var(--text-faint)' : 'var(--text-primary)'}`, text: label }),
      el('div', { style: 'font:400 11.5px/1.45 var(--font-body);color:var(--text-muted);margin-top:5px;text-wrap:pretty', text: sub })
    ])
  ]);
}

function startOfWeek(date) { return addDays(date, -date.getDay()); }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); d.setHours(0, 0, 0, 0); return d; }

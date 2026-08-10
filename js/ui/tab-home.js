import { el, clear } from './dom.js';
import { exerciseIdsForDay, dayMeta } from '../data/day-plan.js';
import { loadInsights, forecastText } from '../services/insights-service.js';
import { weekDayForDate } from '../services/calendar-service.js';
import { openDetail } from './detail-sheet.js';

const DOW_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export async function renderHome(container, ctx) {
  clear(container);
  const screen = el('div', { class: 'screen' });
  container.appendChild(screen);

  const today = new Date();
  const todayDow = today.getDay();
  const sunday = addDays(today, -todayDow);
  const scheduledSlots = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(sunday, i);
    if (d > today) continue;
    const wd = weekDayForDate(ctx.startDate, ctx.skips, d);
    if (!wd) continue; // before the program started — not a scheduled day
    if (!dayMeta(wd.day).rest) scheduledSlots.push(wd);
  }

  const { entries, streak, chasing, consistency } = await loadInsights(ctx.userId, scheduledSlots);

  const streakTicks = el('div', { style: 'display:flex;gap:5px;margin-top:15px' },
    Array.from({ length: 12 }, (_, i) => {
      const filled = i >= 12 - streak;
      return el('div', { style: `flex:1;height:7px;border-radius:4px;background:${filled ? 'var(--moss)' : 'var(--card-border-alt)'}` });
    })
  );

  const streakCard = el('div', { class: 'card card--clickable', onClick: () => openStreakDetail(entries, streak) }, [
    el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px' }, [
      el('div', {}, [
        el('div', { style: 'font:600 52px/.9 var(--font-display);color:var(--moss-hi)', text: String(streak) }),
        el('div', { style: 'font:500 10px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-muted);margin-top:8px', text: 'Clean weeks in a row' })
      ]),
      el('div', { style: 'font:400 16px/1 var(--font-body);color:var(--amber)', text: '›' })
    ]),
    streakTicks
  ]);
  screen.appendChild(streakCard);

  if (chasing) {
    const chaseCard = el('div', { class: 'card card--clickable', onClick: () => openDetail(chasingDetailSpec(chasing)) }, [
      el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px' }, [
        el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--amber)', text: 'Chasing' }),
        el('div', { style: 'font:400 16px/1 var(--font-body);color:var(--amber)', text: '›' })
      ]),
      el('div', { style: 'display:flex;align-items:baseline;gap:9px;flex-wrap:wrap' }, [
        el('div', { style: 'font:500 19px/1.1 var(--font-display);text-transform:uppercase;color:var(--text-faint)', text: chasing.tierName }),
        el('div', { style: 'font:400 15px/1 var(--font-body);color:var(--text-faint)', text: '→' }),
        el('div', { style: 'font:600 19px/1.1 var(--font-display);text-transform:uppercase;color:var(--text-primary)', text: chasing.nextTierName })
      ]),
      el('div', { style: 'font:400 11px/1.5 var(--font-mono);color:var(--text-muted);margin-top:9px', text: forecastText(chasing.weeksToAdvance) })
    ]);
    screen.appendChild(chaseCard);
  }

  const weekGrid = el('div', { style: 'display:flex;gap:6px' }, Array.from({ length: 7 }, (_, i) => {
    const d = addDays(sunday, i);
    const wd = weekDayForDate(ctx.startDate, ctx.skips, d);
    const isToday = d.toDateString() === today.toDateString();

    if (!wd) {
      // Before the program started — not clickable, no dot, just a dimmed placeholder.
      return el('div', { style: 'flex:1;border-radius:10px;padding:11px 0 10px;text-align:center;background:var(--card-bg-alt);border:1px solid var(--card-border);opacity:.4' }, [
        el('div', { style: 'font:600 11px/1 var(--font-display);letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint)', text: DOW_LETTERS[i] }),
        el('div', { style: 'font:400 13px/1 var(--font-body);margin-top:8px;color:var(--card-border-strong)', text: '·' })
      ]);
    }

    const { week, day } = wd;
    const meta = dayMeta(day);
    const logged = entries.some(e => e.week === week && e.day === day);
    const isFuture = d > today;
    const mark = meta.rest ? '—' : (logged ? '✓' : (isFuture ? '·' : '•'));
    return el('div', {
      style: `flex:1;border-radius:10px;padding:11px 0 10px;text-align:center;cursor:pointer;background:${isToday ? 'rgba(209,154,46,.16)' : 'var(--card-bg-alt)'};border:1px solid ${isToday ? 'var(--amber)' : 'var(--card-border)'}`,
      onClick: () => ctx.navigate('calendar', { week, day })
    }, [
      el('div', { style: `font:600 11px/1 var(--font-display);letter-spacing:.06em;text-transform:uppercase;color:${isToday ? 'var(--amber)' : 'var(--text-faint)'}`, text: DOW_LETTERS[i] }),
      el('div', { style: `font:400 13px/1 var(--font-body);margin-top:8px;color:${logged ? 'var(--moss-hi)' : 'var(--card-border-strong)'}`, text: mark })
    ]);
  }));
  screen.appendChild(el('div', { class: 'card' }, [
    el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px' }, [
      el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint)', text: 'This week' }),
      el('div', { style: 'font:500 10px/1 var(--font-mono);letter-spacing:.09em;text-transform:uppercase;color:var(--amber);cursor:pointer', onClick: () => ctx.navigate('calendar'), text: 'Calendar ›' })
    ]),
    weekGrid
  ]));

  const todayIds = exerciseIdsForDay(todayDow);
  const doneN = todayIds.filter(id => entries.some(e => e.week === ctx.todayWeekDay.week && e.day === ctx.todayWeekDay.day && e.exercise_id === id)).length;
  const ctaText = doneN === 0 ? 'Start session' : (doneN >= todayIds.length ? 'Review session' : `Continue — ${todayIds.length - doneN} left`);
  const meta = dayMeta(todayDow);

  screen.appendChild(el('div', { class: 'card card--accent' }, [
    el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px' }, [
      el('div', { style: 'min-width:0' }, [
        el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--moss-hi);margin-bottom:8px', text: 'Today' }),
        el('div', { style: 'font:600 25px/1.05 var(--font-display);text-transform:uppercase;color:var(--text-primary)', text: meta.title }),
        el('div', { style: 'font:400 12px/1.4 var(--font-body);color:var(--text-secondary);margin-top:5px', text: `${todayIds.length} movement${todayIds.length === 1 ? '' : 's'}` })
      ])
    ]),
    el('button', { class: 'btn btn--primary', text: ctaText, onClick: () => ctx.navigate('session') })
  ]));
}

function openStreakDetail(entries, streak) {
  const byWeek = new Map();
  for (const e of entries) {
    if (!byWeek.has(e.week)) byWeek.set(e.week, []);
    byWeek.get(e.week).push(e);
  }
  const weeks = [...byWeek.keys()].sort((a, b) => b - a).slice(0, 8);
  openDetail({
    kicker: 'Clean-week streak', title: `${streak} week${streak === 1 ? '' : 's'} unbroken`,
    hero: { label: 'Current run', value: `${streak} week${streak === 1 ? '' : 's'}` },
    sections: [{
      title: 'Recent weeks',
      rows: weeks.map(w => {
        const clean = byWeek.get(w).every(e => e.form_clean);
        return { name: `Week ${w}`, value: clean ? '✓' : 'broke', color: clean ? 'var(--moss-hi)' : 'var(--clay-hi)' };
      })
    }]
  });
}

function chasingDetailSpec(chasing) {
  return {
    kicker: 'Next advance', title: `${chasing.tierName} → ${chasing.nextTierName}`,
    hero: { label: 'Requirement', value: forecastText(chasing.weeksToAdvance) }
  };
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

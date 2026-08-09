import { el, clear } from './dom.js';
import { EXERCISES } from '../data/exercises.js';
import { dayMeta } from '../data/day-plan.js';
import { weekDayForDate } from '../services/calendar-service.js';
import { loadInsights, allTierProgress, forecastText } from '../services/insights-service.js';
import { openDetail } from './detail-sheet.js';

export async function renderInsights(container, ctx) {
  clear(container);
  const screen = el('div', { class: 'screen' });
  container.appendChild(screen);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const scheduledSlots = [];
  for (let i = 0, d = new Date(today); scheduledSlots.length < 36 && d >= ctx.startDate; i++) {
    const { week, day } = weekDayForDate(ctx.startDate, ctx.skips, d);
    if (!dayMeta(day).rest) scheduledSlots.push({ week, day });
    d = addDays(d, -1);
  }

  const { entries, consistency } = await loadInsights(ctx.userId, scheduledSlots);
  const ladders = allTierProgress(entries);

  screen.appendChild(el('div', { class: 'kicker', text: `${scheduledSlots.length <= 36 ? scheduledSlots.length : 36} scheduled days of your own data` }));
  screen.appendChild(el('div', { class: 'page-title', text: 'Insights' }));

  screen.appendChild(el('div', { class: 'section-label', text: 'Consistency' }));
  const worstNote = consistency.worstDayOfWeek != null && consistency.worstDayCount > 1
    ? `${consistency.missedCount} missed day${consistency.missedCount === 1 ? '' : 's'}, ${consistency.worstDayCount} of them ${DOW_NAMES[consistency.worstDayOfWeek]}s.`
    : `${consistency.missedCount} missed day${consistency.missedCount === 1 ? '' : 's'}.`;
  screen.appendChild(el('div', { class: 'card' }, [
    el('div', { style: 'display:flex;align-items:flex-end;gap:14px;margin-bottom:15px' }, [
      el('div', { style: 'font:600 42px/.9 var(--font-display);color:var(--text-primary)' }, [
        consistency.loggedCount + '', el('span', { style: 'font-size:22px;color:var(--text-faint)', text: `/${consistency.scheduledCount}` })
      ]),
      el('div', { style: 'font:400 11.5px/1.45 var(--font-mono);color:var(--text-muted);padding-bottom:5px', text: 'days logged vs. scheduled' })
    ]),
    el('div', { class: 'heatmap' }, consistency.cells.map(c => el('div', { class: `heatmap__cell${c.logged ? ' heatmap__cell--logged' : ' heatmap__cell--missed'}` }))),
    el('div', { style: 'font:400 11px/1.5 var(--font-mono);color:var(--text-muted);margin-top:14px;padding-top:13px;border-top:1px solid var(--card-border)', text: worstNote })
  ]));

  screen.appendChild(el('div', { class: 'section-label', text: 'Every ladder' }));
  if (!ladders.length) {
    screen.appendChild(el('div', { class: 'card', text: 'No staged movements logged yet.' }));
  }
  for (const L of ladders) {
    const spec = EXERCISES[L.exerciseId];
    screen.appendChild(el('div', { class: 'card card--clickable', onClick: () => openDetail(ladderDetailSpec(L, spec)) }, [
      el('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:13px' }, [
        el('div', { style: 'font:500 16px/1.1 var(--font-display);text-transform:uppercase;color:var(--text-primary)', text: spec.name }),
        el('div', { style: 'font:400 10.5px/1 var(--font-mono);color:var(--text-muted)', text: `${L.tierIndex + 1} of ${L.tierCount}` })
      ]),
      el('div', { class: 'ladder-bar' }, L.tierNames.map((_, i) =>
        el('div', { class: `ladder-bar__seg${i < L.tierIndex ? ' ladder-bar__seg--done' : (i === L.tierIndex ? ' ladder-bar__seg--current' : '')}` })
      )),
      el('div', { style: 'display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:9px' }, [
        el('div', { style: 'font:500 14px/1.15 var(--font-display);text-transform:uppercase;color:var(--moss-hi)', text: L.tierName }),
        L.nextTierName ? el('div', { style: 'font:400 12px/1 var(--font-body);color:var(--text-faint)', text: '→' }) : null,
        L.nextTierName ? el('div', { style: 'font:500 14px/1.15 var(--font-display);text-transform:uppercase;color:var(--text-muted)', text: L.nextTierName }) : null
      ]),
      el('div', { style: 'font:400 11px/1.5 var(--font-mono);color:var(--text-muted)', text: L.nextTierName ? forecastText(L.weeksToAdvance) : 'Top of the ladder.' })
    ]));
  }

  screen.appendChild(el('div', { style: 'border:1px dashed var(--card-border-strong);border-radius:11px;padding:13px 14px;margin-top:6px' }, [
    el('div', { style: 'font:400 11px/1.6 var(--font-mono);color:var(--text-dim)', text: 'Forecasts assume every week from here is clean. They are a ceiling, not a schedule.' })
  ]));
}

function ladderDetailSpec(L, spec) {
  return {
    kicker: 'Next advance', title: L.nextTierName ? `${L.tierName} → ${L.nextTierName}` : `${L.tierName} — top of the ladder`,
    hero: L.nextTierName ? { label: 'Requirement', value: forecastText(L.weeksToAdvance) } : null,
    ladder: L.tierNames.map((name, i) => ({
      name, reached: i < L.tierIndex, current: i === L.tierIndex,
      meta: i < L.tierIndex ? 'cleared' : (i === L.tierIndex ? 'here' : '')
    }))
  };
}

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }

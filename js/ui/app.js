import { el, clear } from './dom.js';
import { signInWithGoogle, signOut, onAuthStateChange } from '../supabase-client.js';
import { isApproved } from '../services/access-service.js';
import { getProgramSettings, getWeekSkips, restartProgram, weekDayForDate } from '../services/calendar-service.js';
import { getRestSettings } from '../services/settings-service.js';
import { getPendingRetestWeek } from '../services/baseline-service.js';
import { catchUpRestTimer } from './components/rest-timer.js';
import { mountDetailSheet } from './detail-sheet.js';
import { renderHome } from './tab-home.js';
import { renderSession } from './tab-session.js';
import { renderCalendar } from './tab-calendar.js';
import { renderInsights } from './tab-insights.js';
import { renderMore } from './tab-more.js';

const TABS = [
  { key: 'home', label: 'Home', render: renderHome },
  { key: 'session', label: 'Session', render: renderSession },
  { key: 'calendar', label: 'Calendar', render: renderCalendar },
  { key: 'insights', label: 'Insights', render: renderInsights },
  { key: 'more', label: 'More', render: renderMore }
];

const root = document.getElementById('app');
let currentTab = 'home';
let navArgs = null;

// Supabase's onAuthStateChange commonly fires more than once in quick succession on
// load (an INITIAL_SESSION event, then a SIGNED_IN/TOKEN_REFRESHED shortly after as a
// persisted session gets rehydrated) — handleSession/renderApp are async with several
// awaits before their first DOM write, so two overlapping calls could each pass their
// own clear(root) and then both append a full content+tab-bar into root (two flex:1
// panes splitting the shell, each independently scrolling — exactly the duplicated
// Home content bug this was found from). renderGen makes every call check, right
// before it mutates the DOM, whether a newer call has since started; if so it bails
// instead of writing stale/duplicate output.
let renderGen = 0;

onAuthStateChange(session => {
  const gen = ++renderGen;
  handleSession(session, gen).catch(err => { if (gen === renderGen) showFatalError(err); });
});

async function handleSession(session, gen) {
  if (!session) {
    if (gen !== renderGen) return;
    clear(root);
    renderSignInGate();
    return;
  }
  const email = session.user.email;
  const userId = session.user.id;

  const approved = await isApproved(email);
  if (gen !== renderGen) return;
  if (!approved) {
    clear(root);
    renderNotAuthorizedGate(email);
    return;
  }

  const settings = await getProgramSettings(userId);
  if (gen !== renderGen) return;
  if (!settings) {
    clear(root);
    renderOnboardingGate(userId, email);
    return;
  }

  await renderApp(userId, email, settings.startDate, gen);
}

function renderSignInGate() {
  root.appendChild(el('div', { class: 'gate' }, [
    el('div', { style: 'font:600 30px/1.1 var(--font-display);text-transform:uppercase;color:var(--text-primary)', text: 'The Path' }),
    el('div', { style: 'font:400 13px/1.5 var(--font-body);color:var(--text-secondary)', text: 'Sign in to see your own progression.' }),
    el('button', { class: 'btn btn--primary', style: 'max-width:240px', text: 'Sign in with Google', onClick: () => signInWithGoogle() })
  ]));
}

function renderNotAuthorizedGate(email) {
  root.appendChild(el('div', { class: 'gate' }, [
    el('div', { style: 'font:600 24px/1.2 var(--font-display);text-transform:uppercase;color:var(--text-primary)', text: 'Not authorized yet' }),
    el('div', { style: 'font:400 13px/1.5 var(--font-body);color:var(--text-secondary)', text: `${email} isn't on the approved list for this app yet. Ask whoever runs it to add you.` }),
    el('button', { class: 'btn btn--outline', style: 'max-width:200px', text: 'Sign out', onClick: () => signOut() })
  ]));
}

function renderOnboardingGate(userId, email) {
  const dateInput = el('input', { type: 'date', class: 'notes-field', style: 'max-width:220px' });
  root.appendChild(el('div', { class: 'gate' }, [
    el('div', { style: 'font:600 24px/1.2 var(--font-display);text-transform:uppercase;color:var(--text-primary)', text: 'Set your start date' }),
    el('div', { style: 'font:400 13px/1.5 var(--font-body);color:var(--text-secondary)', text: 'This is your Week 0 / Day 1 date. It anchors the Calendar tab — you can change it later from More → Restart program.' }),
    dateInput,
    el('button', {
      class: 'btn btn--primary', style: 'max-width:200px', text: 'Start program',
      onClick: async () => {
        if (!dateInput.value) return;
        await restartProgram(userId, new Date(dateInput.value + 'T00:00:00'));
        await renderApp(userId, email, new Date(dateInput.value + 'T00:00:00'), ++renderGen);
      }
    })
  ]));
}

async function renderApp(userId, email, startDate, gen) {
  const skips = await getWeekSkips(userId);
  const restSettings = await getRestSettings(userId);
  const pendingRetestWeek = await getPendingRetestWeek(userId);
  if (gen !== renderGen) return; // a newer auth/render event superseded this one
  const today = new Date(); today.setHours(0, 0, 0, 0);
  // null when the program hasn't started yet (a future start date) — fall back to
  // "week 0, start date's weekday" so tabs that default to ctx.todayWeekDay have
  // something sane to render rather than crashing; there's nothing to log yet either way.
  const todayWeekDay = weekDayForDate(startDate, skips, today) || { week: 0, day: startDate.getDay() };

  // Catches a rest timer that was already counting down (and possibly already
  // finished) before the app was closed/reloaded, e.g. the phone was locked through
  // the whole rest period — chimes immediately if it had already elapsed.
  catchUpRestTimer(userId);

  clear(root);

  const ctx = {
    userId, email, startDate, skips, todayWeekDay, restSettings, pendingRetestWeek,
    navigate: (tabKey, args) => { currentTab = tabKey; navArgs = args || null; drawTab(); },
    reloadCalendar: async () => {
      const s = await getProgramSettings(userId);
      ctx.startDate = s.startDate;
      ctx.skips = await getWeekSkips(userId);
      ctx.todayWeekDay = weekDayForDate(ctx.startDate, ctx.skips, today) || { week: 0, day: ctx.startDate.getDay() };
      // Restarting the program cancels any pending retest — keep ctx in sync.
      ctx.pendingRetestWeek = await getPendingRetestWeek(userId);
    },
    reloadRestSettings: async () => {
      ctx.restSettings = await getRestSettings(userId);
    },
    reloadPendingRetestWeek: async () => {
      ctx.pendingRetestWeek = await getPendingRetestWeek(userId);
    }
  };

  const content = el('div', { style: 'flex:1;min-height:0;display:flex;flex-direction:column;position:relative' });
  const tabBar = el('div', { class: 'tab-bar' }, TABS.map(t => tabBarItem(t)));
  root.appendChild(content);
  root.appendChild(tabBar);
  mountDetailSheet(root);

  function tabBarItem(t) {
    return el('button', { class: 'tab-bar__item', 'aria-current': t.key === currentTab, onClick: () => { currentTab = t.key; navArgs = null; drawTab(); redrawTabBar(); } }, [
      el('div', { class: 'tab-bar__dot' }),
      el('div', { class: 'tab-bar__label', text: t.label })
    ]);
  }

  function redrawTabBar() {
    clear(tabBar);
    TABS.forEach(t => tabBar.appendChild(tabBarItem(t)));
  }

  async function drawTab() {
    redrawTabBar();
    const tab = TABS.find(t => t.key === currentTab);
    try {
      await tab.render(content, ctx, navArgs);
    } catch (err) {
      console.error(err);
      clear(content);
      content.appendChild(el('div', { class: 'gate', text: 'Something went wrong loading this tab. Check the console.' }));
    }
  }

  await drawTab();
}

function showFatalError(err) {
  console.error(err);
  clear(root);
  root.appendChild(el('div', { class: 'gate' }, [
    el('div', { style: 'font:600 20px/1.2 var(--font-display);color:var(--text-primary)', text: 'Something went wrong' }),
    el('div', { style: 'font:400 12px/1.5 var(--font-mono);color:var(--text-muted)', text: String(err.message || err) })
  ]));
}

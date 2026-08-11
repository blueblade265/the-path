import { el } from '../dom.js';
import { playChime } from '../../lib/chime.js';

// Honest limitation: a plain web page cannot keep running — or make sound — while the
// phone's screen is fully off/locked. That's an OS-level restriction; overriding it
// needs a native app or server-scheduled push notifications, neither of which this
// static site has. What this DOES guarantee: the countdown is timestamp-based (not a
// naive decrement), so browser throttling of a backgrounded/dimmed tab never causes
// drift — the instant the page's JS runs again (screen comes back on, tab regains
// focus, or the app is reopened after being fully killed), it recomputes from the real
// end time and fires the chime/vibrate immediately if rest was already up.
//
// Pure component: knows nothing about session-state.js, userId, or exercise IDs (it
// used to persist its own single localStorage key per user, which meant two concurrent
// rest timers would clobber each other — the caller now owns persistence per exercise
// via resumeEndAt/onPersist, same pattern as phase-timer.js, which also fixes that).

// Starts a rest timer and returns { node, stop }. onDone fires exactly once, either
// from the interval reaching 0 or from a visibility-regain finding it already elapsed.
export function restTimer({ seconds, resumeEndAt, onPersist, onDone }) {
  const endAt = resumeEndAt ?? Date.now() + seconds * 1000;
  if (resumeEndAt == null) onPersist?.(endAt);

  const remainingNow = () => Math.max(0, Math.round((endAt - Date.now()) / 1000));
  const format = (remaining) => `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  const label = el('div', { style: 'font:600 24px/1 var(--font-display);color:var(--text-primary)', text: format(remainingNow()) });

  let done = false;
  let timer = null;

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', tick);
  };

  const complete = () => {
    if (done) return;
    done = true;
    stop();
    playChime();
    onDone?.();
  };

  function tick() {
    if (done) return;
    const remaining = remainingNow();
    label.textContent = format(remaining);
    if (remaining <= 0) complete();
  }

  timer = setInterval(tick, 1000);
  document.addEventListener('visibilitychange', tick);
  // Deferred one microtask — see phase-timer.js's identical comment: resuming an
  // already-elapsed rest (came back after it had fully finished) would otherwise fire
  // onDone before this function has returned {node, stop}, before the caller has
  // appended `node` anywhere.
  queueMicrotask(tick);

  const node = el('div', { class: 'banner', style: 'background:rgba(209,154,46,.13);border:1px solid rgba(209,154,46,.45);justify-content:space-between' }, [
    el('div', { style: 'font:500 10px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--amber)', text: 'Rest' }),
    label,
    el('button', {
      class: 'banner__action', style: 'color:var(--text-secondary)', text: 'Skip',
      onClick: () => { if (done) return; done = true; stop(); onDone?.(); }
    })
  ]);

  return { node, stop };
}

import { el } from '../dom.js';
import { acquireWakeLock, releaseWakeLock } from '../../lib/wake-lock.js';

// A short, actively-supervised phase's countdown (a 5s "get in position" cue, or a live
// hold) — timestamp-based, same fix as rest-timer.js and for the same reason: a plain
// setInterval decrement stalls when the tab is backgrounded/throttled (this is the exact
// bug that left a hold countdown stuck at "1" after the phone locked mid-hold and never
// advanced to rest). Computing remaining time from a real endAt timestamp on every tick
// AND on visibilitychange means it self-heals to the correct value — or fires
// completion immediately — the instant the phone wakes or the tab regains focus, rather
// than being stuck wherever the last tick left off.
//
// Pure component: knows nothing about session-state.js, userId, or exercise IDs. The
// caller owns persistence via resumeEndAt (pass a stored endAt to resume an in-flight
// phase) and onPersist (called once with the real endAt when a phase starts fresh) —
// this is what lets tab-session.js reconstruct "which phase was running and when it
// ends" after a reload or an in-app tab switch and back.
export function phaseTimer({ label, seconds, accent, resumeEndAt, onPersist, onDone }) {
  const endAt = resumeEndAt ?? Date.now() + seconds * 1000;
  if (resumeEndAt == null) onPersist?.(endAt);

  const remainingNow = () => Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  const valueEl = el('div', { style: 'font:600 44px/1 var(--font-display);color:var(--text-primary);text-align:center;margin-top:6px', text: String(remainingNow()) });

  let done = false;
  let timer = null;
  let wakeLockHeld = false;

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', tick);
    if (wakeLockHeld) { wakeLockHeld = false; releaseWakeLock(); }
  };

  const complete = () => {
    if (done) return;
    done = true;
    stop();
    onDone();
  };

  function tick() {
    if (done) return;
    const remaining = remainingNow();
    valueEl.textContent = String(remaining);
    if (remaining <= 0) complete();
  }

  timer = setInterval(tick, 1000);
  wakeLockHeld = true;
  acquireWakeLock();
  document.addEventListener('visibilitychange', tick);
  // The completion check is deferred to a microtask rather than run synchronously here
  // (display text above is still set synchronously): resuming an already-elapsed phase
  // (came back to the app after the hold time had fully passed) would otherwise fire
  // onDone before this function has even returned {node, stop} — the caller
  // (tab-session.js) hasn't appended `node` yet, so its onDone handler would clear/
  // rebuild phaseHost out from under a node that isn't there yet, then the caller's own
  // post-call appendChild would stack a stale, already-finished node on top of whatever
  // onDone just built. Deferring one microtask guarantees the caller's synchronous
  // appendChild always runs first.
  queueMicrotask(tick);

  const node = el('div', { style: `padding:16px 0 18px;text-align:center;border-radius:10px;background:var(--card-bg-alt);border:1px solid ${accent};margin-bottom:11px` }, [
    el('div', { style: `font:500 10px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:${accent}`, text: label }),
    valueEl
  ]);

  return { node, stop };
}

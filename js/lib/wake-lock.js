// Keeps the screen from auto-locking while a rest/hold timer is running. Doesn't change
// the honest limitation documented in rest-timer.js/phase-timer.js — a page still can't
// run or make sound through a screen that's ALREADY off/locked — but it stops the screen
// from getting there in the first place while a timer is actively counting down, which is
// the actual moment that matters.
//
// Reference-counted: more than one timer component can be active at once from the
// caller's perspective, so this only releases once nothing left needs it. The browser
// auto-releases a wake lock the instant the tab is backgrounded (app-switch, manual screen
// lock) — re-acquires on visibilitychange if still needed, the same signal the timer
// components already use to self-heal their own countdown display.

let sentinel = null;
let count = 0;

async function acquire() {
  if (!navigator.wakeLock) return; // unsupported browser — silently a no-op
  try {
    sentinel = await navigator.wakeLock.request('screen');
  } catch {
    sentinel = null; // e.g. denied, or document not visible yet — visibilitychange retry below covers it
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && count > 0 && !sentinel) acquire();
});

export function acquireWakeLock() {
  count++;
  if (count === 1) acquire();
}

export function releaseWakeLock() {
  count = Math.max(0, count - 1);
  if (count === 0 && sentinel) {
    sentinel.release();
    sentinel = null;
  }
}

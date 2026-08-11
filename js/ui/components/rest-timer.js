import { el } from '../dom.js';

// Honest limitation: a plain web page cannot keep running — or make sound — while the
// phone's screen is fully off/locked. That's an OS-level restriction; overriding it
// needs a native app or server-scheduled push notifications, neither of which this
// static site has. What this DOES guarantee: the countdown is timestamp-based (not a
// naive decrement), so browser throttling of a backgrounded/dimmed tab never causes
// drift — the instant the page's JS runs again (screen comes back on, tab regains
// focus, or the app is reopened after being fully killed), it recomputes from the real
// end time and fires the chime/vibrate immediately if rest was already up.

export function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch { /* Web Audio unavailable — no fallback sound source to try */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

function storageKey(userId) {
  return `the-path:rest-timer-end:${userId}`;
}

// Starts a rest timer and returns { node, stop }. onDone fires exactly once, either
// from the interval reaching 0 or from a visibility-regain finding it already elapsed.
export function restTimer(userId, seconds, onDone) {
  const endAt = Date.now() + seconds * 1000;
  localStorage.setItem(storageKey(userId), String(endAt));

  const label = el('div', { style: 'font:600 24px/1 var(--font-display);color:var(--text-primary)' });
  const format = (remaining) => `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

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
    localStorage.removeItem(storageKey(userId));
    playChime();
    onDone?.();
  };

  function tick() {
    if (done) return;
    const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    label.textContent = format(remaining);
    if (remaining <= 0) complete();
  }

  timer = setInterval(tick, 1000);
  document.addEventListener('visibilitychange', tick);
  tick();

  const node = el('div', { class: 'banner', style: 'background:rgba(209,154,46,.13);border:1px solid rgba(209,154,46,.45);justify-content:space-between' }, [
    el('div', { style: 'font:500 10px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--amber)', text: 'Rest' }),
    label,
    el('button', {
      class: 'banner__action', style: 'color:var(--text-secondary)', text: 'Skip',
      onClick: () => { if (done) return; done = true; stop(); localStorage.removeItem(storageKey(userId)); onDone?.(); }
    })
  ]);

  return { node, stop };
}

// Call once when the app loads: if a rest timer was already running (and possibly
// already finished) before the app was closed, reloaded, or the phone was locked
// through the whole rest period, this catches it up — chiming immediately if it's
// already elapsed. There's no exercise card to re-attach a countdown to at this point
// (the app hasn't rendered a tab yet), so an unelapsed pending timer is just left in
// storage; starting the next rest timer naturally overwrites it.
export function catchUpRestTimer(userId) {
  const key = storageKey(userId);
  const raw = localStorage.getItem(key);
  if (!raw) return;
  const endAt = Number(raw);
  if (Date.now() >= endAt) {
    localStorage.removeItem(key);
    playChime();
  }
}

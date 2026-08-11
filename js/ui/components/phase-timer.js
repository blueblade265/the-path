import { el } from '../dom.js';

// A plain countdown for a short, actively-supervised phase (a 5s "get in position"
// cue, or a live hold) — unlike rest-timer.js's, this is NOT persisted to localStorage:
// you're physically doing the exercise while it runs, not leaving the app, so surviving
// a background/foreground cycle doesn't apply the way it does for a multi-minute rest.
export function phaseTimer({ label, seconds, accent, onDone }) {
  let remaining = seconds;
  const valueEl = el('div', { style: 'font:600 44px/1 var(--font-display);color:var(--text-primary);text-align:center;margin-top:6px', text: String(remaining) });

  let done = false;
  const timer = setInterval(() => {
    if (done) return;
    remaining--;
    if (remaining <= 0) {
      done = true;
      clearInterval(timer);
      onDone();
    } else {
      valueEl.textContent = String(remaining);
    }
  }, 1000);

  const stop = () => { done = true; clearInterval(timer); };

  const node = el('div', { style: `padding:16px 0 18px;text-align:center;border-radius:10px;background:var(--card-bg-alt);border:1px solid ${accent};margin-bottom:11px` }, [
    el('div', { style: `font:500 10px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:${accent}`, text: label }),
    valueEl
  ]);

  return { node, stop };
}

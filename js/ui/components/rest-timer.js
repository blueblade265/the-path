import { el } from '../dom.js';

// Known v1 limitation: setInterval-based, so the countdown stalls while the phone
// screen is locked/backgrounded (per the plan's verification notes) — accepted for v1.
export function restTimer(seconds, onDone) {
  let remaining = seconds;
  const label = el('div', { style: 'font:600 24px/1 var(--font-display);color:var(--text-primary)' });
  const format = () => `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  label.textContent = format();

  let timer = null;
  const stop = () => { if (timer) clearInterval(timer); timer = null; };
  timer = setInterval(() => {
    remaining--;
    if (remaining <= 0) { stop(); onDone?.(); }
    else label.textContent = format();
  }, 1000);

  const node = el('div', { class: 'banner', style: 'background:rgba(209,154,46,.13);border:1px solid rgba(209,154,46,.45);justify-content:space-between' }, [
    el('div', { style: 'font:500 10px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--amber)', text: 'Rest' }),
    label,
    el('button', { class: 'banner__action', style: 'color:var(--text-secondary)', text: 'Skip', onClick: () => { stop(); onDone?.(); } })
  ]);

  return { node, stop };
}

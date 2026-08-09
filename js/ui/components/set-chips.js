import { el } from '../dom.js';

// values: array of numbers already logged this session (UI feedback only — only the
// LAST tap is ever persisted to training_entries, per the one-row-per-day schema).
export function setChips(values, max = 3) {
  const chips = [];
  for (let i = 0; i < max; i++) {
    const v = values[i];
    const filled = v != null;
    chips.push(el('div', {
      class: 'card', style: `flex:1;padding:10px 0;text-align:center;margin:0;border-style:${filled ? 'solid' : 'dashed'};border-color:${filled ? 'var(--moss)' : 'var(--card-border)'};background:${filled ? 'rgba(163,190,115,.14)' : 'var(--card-bg-alt)'}`
    }, [
      el('div', { style: `font:600 15px/1 var(--font-display);color:${filled ? 'var(--moss-hi)' : 'var(--card-border-strong)'}`, text: filled ? String(v) : '—' }),
      el('div', { style: 'font:400 8.5px/1 var(--font-mono);color:var(--text-faint);margin-top:5px', text: `SET ${i + 1}` })
    ]));
  }
  return el('div', { style: 'display:flex;gap:7px;margin-bottom:12px' }, chips);
}

import { el } from '../dom.js';

export function statusChip(text, variant = '') {
  const cls = ['status-chip', variant && `status-chip--${variant}`].filter(Boolean).join(' ');
  return el('span', { class: cls, text });
}

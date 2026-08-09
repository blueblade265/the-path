import { el } from '../dom.js';

// variant: 'missed' | 'readonly' | 'provisional'
export function banner({ variant, text, actionLabel, onAction }) {
  const children = [el('div', { text })];
  if (actionLabel && onAction) {
    children.push(el('button', { class: 'banner__action', text: actionLabel, onClick: onAction }));
  }
  return el('div', { class: `banner banner--${variant}` }, children);
}

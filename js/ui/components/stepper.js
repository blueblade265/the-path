import { el } from '../dom.js';

// { value, unitLabel, step, min=0, onChange(newValue) } -> HTMLElement with a live-updating display
export function stepper({ value, unitLabel, step, min = 0, onChange }) {
  let current = value;
  const valueEl = el('div', { class: 'stepper__value', text: String(current) });

  const apply = (next) => {
    current = Math.max(min, next);
    valueEl.textContent = String(current);
    onChange(current);
  };

  return el('div', { class: 'stepper' }, [
    el('button', { class: 'stepper__btn', text: '−', onClick: () => apply(current - step) }),
    el('div', { class: 'stepper__value-box' }, [
      valueEl,
      el('div', { class: 'stepper__unit', text: unitLabel })
    ]),
    el('button', { class: 'stepper__btn', text: '+', onClick: () => apply(current + step) })
  ]);
}

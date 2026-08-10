import { el } from '../dom.js';

// { value, unitLabel, step, min=0, onChange(newValue) } -> HTMLElement.
// The value display is a real number input — the +/- buttons still work, but you can
// also tap in and type a value directly.
export function stepper({ value, unitLabel, step, min = 0, onChange }) {
  let current = value;

  const valueInput = el('input', {
    class: 'stepper__value', type: 'number', inputmode: 'decimal', step: String(step), value: String(current),
    onInput: (e) => {
      const n = Number(e.target.value);
      if (e.target.value === '' || Number.isNaN(n)) return; // still typing (e.g. a bare "-" or empty) — wait for a real number
      current = n;
      onChange(current);
    },
    onBlur: (e) => {
      // Snap back to something valid if left empty, non-numeric, or under min.
      let n = Number(e.target.value);
      if (e.target.value === '' || Number.isNaN(n)) n = min;
      n = Math.max(min, n);
      current = n;
      e.target.value = String(current);
      onChange(current);
    }
  });

  const apply = (next) => {
    current = Math.max(min, next);
    valueInput.value = String(current);
    onChange(current);
  };

  return el('div', { class: 'stepper' }, [
    el('button', { class: 'stepper__btn', text: '−', onClick: () => apply(current - step) }),
    el('div', { class: 'stepper__value-box' }, [
      valueInput,
      el('div', { class: 'stepper__unit', text: unitLabel })
    ]),
    el('button', { class: 'stepper__btn', text: '+', onClick: () => apply(current + step) })
  ]);
}

import { el, clear } from './dom.js';

let hostEl = null;

export function mountDetailSheet(appRoot) {
  hostEl = el('div');
  appRoot.appendChild(hostEl);
}

export function closeDetail() {
  if (hostEl) clear(hostEl);
}

// spec: { kicker, title, hero?:{label,value,sub}, ladder?:[{name,reached,current,meta}],
//         bars?:[{label,heightPct,clean}], sections?:[{title,rows:[{name,value,sub}]}] }
export function openDetail(spec) {
  if (!hostEl) return;
  clear(hostEl);

  const body = [];

  if (spec.hero) {
    body.push(el('div', { class: 'rx-block' }, [
      el('div', { class: 'rx-block__label', text: spec.hero.label }),
      el('div', { class: 'rx-block__value', text: spec.hero.value }),
      spec.hero.sub ? el('div', { style: 'font:400 12px/1.5 var(--font-mono);color:var(--text-secondary);margin-top:9px', text: spec.hero.sub }) : null
    ]));
  }

  if (spec.ladder) {
    body.push(el('div', { class: 'section-label', text: 'Stage ladder' }));
    body.push(el('div', { style: 'margin-bottom:22px' }, spec.ladder.map(l =>
      el('div', { class: `ladder-row${l.current ? ' ladder-row--current' : ''}` }, [
        el('div', { class: 'ladder-row__dot', style: l.reached ? 'background:var(--moss)' : (l.current ? 'background:var(--amber)' : '') }),
        el('div', { class: `ladder-row__name${l.reached || l.current ? ' ladder-row__name--reached' : ''}`, text: l.name }),
        el('div', { class: 'ladder-row__meta', text: l.meta || '' })
      ])
    )));
  }

  if (spec.bars) {
    const max = Math.max(1, ...spec.bars.map(b => b.value));
    body.push(el('div', { class: 'section-label', text: 'Every logged week' }));
    body.push(el('div', { style: 'display:flex;align-items:flex-end;gap:6px;height:92px;margin-bottom:8px' },
      spec.bars.map(b => el('div', { style: 'flex:1;display:flex;flex-direction:column;align-items:center;gap:6px' }, [
        el('div', { style: `width:100%;border-radius:4px 4px 0 0;height:${Math.round(18 + (b.value / max) * 68)}px;background:${b.clean ? 'var(--moss)' : '#4A3A33'}` }),
        el('div', { style: 'font:400 8.5px/1 var(--font-mono);color:var(--text-faint)', text: b.label })
      ]))
    ));
  }

  for (const sec of spec.sections || []) {
    body.push(el('div', { style: 'margin-bottom:22px' }, [
      el('div', { class: 'section-label', text: sec.title }),
      ...sec.rows.map(r => el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--card-border-alt)' }, [
        el('div', { style: 'min-width:0' }, [
          el('div', { style: 'font:400 13.5px/1.4 var(--font-body);color:var(--text-body)', text: r.name }),
          r.sub ? el('div', { style: 'font:400 11px/1.45 var(--font-mono);color:var(--text-dim);margin-top:4px', text: r.sub }) : null
        ]),
        el('div', { style: `flex:none;font:400 12px/1.3 var(--font-mono);color:${r.color || 'var(--text-secondary)'};text-align:right`, text: r.value })
      ]))
    ]));
  }

  const sheet = el('div', { class: 'sheet' }, [
    el('div', { class: 'sheet__header' }, [
      el('div', {}, [
        el('div', { style: 'font:500 9.5px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--amber);margin-bottom:8px', text: spec.kicker }),
        el('div', { style: 'font:600 24px/1.05 var(--font-display);text-transform:uppercase;color:var(--text-primary)', text: spec.title })
      ]),
      el('button', { class: 'sheet__close', text: '✕', onClick: closeDetail })
    ]),
    el('div', { class: 'sheet__body' }, body)
  ]);

  hostEl.appendChild(sheet);
}

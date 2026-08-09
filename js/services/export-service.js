// Plain-text dump of the signed-in user's own training log — "yours to keep," per the
// More tab spec. No formatting assumptions beyond human-readable; this is meant to be
// pasted elsewhere, not parsed back in.

import { allEntries } from './entries-repo.js';
import { EXERCISES } from '../data/exercises.js';

export async function exportAsText(userId) {
  const rows = await allEntries(userId);
  const lines = [`The Path — training log export (${new Date().toISOString().slice(0, 10)})`, ''];

  let currentWeek = null;
  for (const r of rows) {
    if (r.week !== currentWeek) {
      currentWeek = r.week;
      lines.push(`Week ${currentWeek}`, '-'.repeat(`Week ${currentWeek}`.length));
    }
    const name = EXERCISES[r.exercise_id]?.name ?? r.exercise_id;
    const parts = [`  ${name}:`];
    if (r.value != null) parts.push(String(r.value));
    if (r.sub_value != null) parts.push(`(sub: ${r.sub_value})`);
    parts.push(r.form_clean ? '[clean]' : '[form broke]');
    if (r.notes) parts.push(`— ${r.notes}`);
    lines.push(parts.join(' '));
  }
  return lines.join('\n');
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

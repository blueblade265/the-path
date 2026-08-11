// A short audio + vibration cue, used at every phase transition (countdown -> hold,
// hold -> rest, rest -> done) across rest-timer.js, phase-timer.js's callers, and
// session-state.js's boot-time catch-up. Lives here (not inside a ui/components file)
// so session-state.js — a services module — doesn't have to import from ui/ to use it.
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

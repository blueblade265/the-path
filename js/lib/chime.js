// A short audio + vibration cue, used at every phase transition (countdown -> hold,
// hold -> rest, rest -> done) across rest-timer.js, phase-timer.js's callers, and
// session-state.js's boot-time catch-up. Lives here (not inside a ui/components file)
// so session-state.js — a services module — doesn't have to import from ui/ to use it.
//
// A web page has no way to duck or override audio another app (Spotify, etc.) is
// already playing — there's no API for that. The only lever available is making our
// own sound as hard to miss as possible: max gain, two stacked harmonically-rich
// waveforms per beep (a single sine gets buried under music; square+sawtooth's extra
// harmonics punch through), and three sharp beeps instead of one soft decaying tone —
// closer to how an alarm clock signals "notice me" than the original single 880Hz sine
// at 0.3 gain.
export function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    // Several oscillators stack louder in the mix than any one of them can alone — this
    // limiter keeps that combined signal from clipping/crackling instead of capping how
    // loud each oscillator can be.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;
    limiter.connect(ctx.destination);

    const beep = (startOffset, freq, duration = 0.16) => {
      const t0 = ctx.currentTime + startOffset;
      ['square', 'sawtooth'].forEach(type => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.9, t0 + 0.008);
        gain.gain.setValueAtTime(0.9, t0 + duration - 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
        osc.connect(gain).connect(limiter);
        osc.start(t0);
        osc.stop(t0 + duration + 0.01);
      });
    };

    beep(0, 1046);
    beep(0.22, 1046);
    beep(0.44, 1568);
  } catch { /* Web Audio unavailable — no fallback sound source to try */ }
  // iOS Safari doesn't implement the Vibration API at all (Apple's decision, not a bug
  // here) — on iPhone this call is always a silent no-op and the audio above is the only
  // real signal. Android gets both.
  if (navigator.vibrate) navigator.vibrate([250, 90, 250, 90, 250]);
}

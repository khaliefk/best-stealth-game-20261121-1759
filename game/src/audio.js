// Lantern Heist: every sound is made here, with the Web Audio API and nothing else. No audio
// files, no network: short oscillators and filtered noise bursts for footsteps, pickups, the
// alarm sting, a coin ping and the win arpeggio. Silent until the first key or click, because
// browsers will not let audio start before a gesture.
let ctx = null;
let muted = false;
let master = null;

function ensure() {
  if (ctx) return ctx;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.35;
  return muted;
}

function tone(freq, dur, type, vol, when = 0) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur, vol, cutoff) {
  const c = ensure();
  if (!c || muted) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = c.createGain();
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start();
}

/** A soft step. Louder for the thief running, barely there for a guard far away. */
export function playStep(running, distance = 0) {
  const vol = Math.max(0.02, (running ? 0.22 : 0.1) * (1 - distance / 260));
  noiseBurst(0.05, vol, running ? 900 : 500);
}

/** The two-note chime of a relic picked up. */
export function playPickup() {
  tone(660, 0.14, 'sine', 0.25);
  tone(990, 0.22, 'sine', 0.25, 0.09);
}

/** The alarm sting: two harsh notes when a guard spots the thief. */
export function playAlarm() {
  tone(220, 0.28, 'sawtooth', 0.2);
  tone(175, 0.4, 'sawtooth', 0.2, 0.16);
}

/** The bright ping of a coin landing. */
export function playCoin() {
  tone(1568, 0.18, 'triangle', 0.22);
  tone(2093, 0.25, 'triangle', 0.16, 0.06);
}

/** The low thud of being caught. */
export function playCaught() {
  tone(98, 0.35, 'sine', 0.35);
  noiseBurst(0.2, 0.2, 300);
}

/** The little arpeggio when a floor is cleared. */
export function playClear() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.22, i * 0.1));
}

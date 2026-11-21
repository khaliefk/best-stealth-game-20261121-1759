// Procedural sound, no audio files: every sound is a few oscillators or a burst of
// filtered noise through one WebAudio context, created on the first user gesture so
// the browser allows it. Footsteps get quieter with distance, so the player can hear
// where a guard is walking.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, duration, type, gainValue, when = 0, slideTo = 0) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainValue, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function noiseBurst(duration, gainValue, filterFreq) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  /** Gain from 0 to 1 for a sound `distance` pixels away from the player. */
  function byDistance(distance) {
    return Math.max(0, 1 - distance / 520);
  }

  return {
    unlock() {
      ensure();
      if (context && context.state === 'suspended') context.resume();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    playerStep(loud) {
      noiseBurst(0.05, loud ? 0.22 : 0.1, loud ? 900 : 500);
    },
    guardStep(distance) {
      const gain = byDistance(distance);
      if (gain <= 0.02) return;
      noiseBurst(0.06, 0.16 * gain, 420);
    },
    relic() {
      tone(880, 0.12, 'sine', 0.25);
      tone(1318, 0.2, 'sine', 0.22, 0.09);
    },
    coinLand() {
      tone(2400, 0.06, 'triangle', 0.18);
      tone(1900, 0.09, 'triangle', 0.14, 0.05);
    },
    spotted() {
      tone(220, 0.35, 'sawtooth', 0.2, 0, 440);
      tone(440, 0.3, 'square', 0.1, 0.05, 660);
    },
    caught() {
      tone(330, 0.5, 'sawtooth', 0.25, 0, 110);
      tone(165, 0.5, 'square', 0.14, 0.1, 82);
    },
    levelClear() {
      tone(523, 0.14, 'sine', 0.22);
      tone(659, 0.14, 'sine', 0.22, 0.12);
      tone(784, 0.26, 'sine', 0.24, 0.24);
    },
    win() {
      tone(523, 0.16, 'sine', 0.22);
      tone(659, 0.16, 'sine', 0.22, 0.14);
      tone(784, 0.16, 'sine', 0.22, 0.28);
      tone(1046, 0.4, 'sine', 0.24, 0.42);
    },
  };
}

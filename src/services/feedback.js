/**
 * Game audio and haptics. Everything is synthesized with Web Audio (no asset
 * files), so it works offline. Browsers only allow audio after a user
 * gesture, so the context is created on the first tap/keypress.
 */
let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuffer = null;
let unlocked = false;
let enabled = { sound: true, haptics: true, music: true };

export function configureFeedback(settings) {
  enabled = { sound: Boolean(settings.sound), haptics: Boolean(settings.haptics), music: settings.music !== false };
  syncMusic();
}

function audio() {
  if (!unlocked) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(master);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function unlock() {
  if (unlocked) return;
  unlocked = true;
  audio();
  syncMusic();
}

if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(type, unlock, { capture: true, passive: true });
}

const mtof = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/** One enveloped oscillator voice. `when` is an absolute AudioContext time. */
function voice(ac, { freq, when, duration, type = 'sine', gain = 0.05, attack = 0.006, release = null, slide = 0, bus = sfxBus }) {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  const end = when + duration;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), end);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(gain, when + attack);
  if (release) amp.gain.setValueAtTime(gain, Math.max(when + attack, end - release));
  amp.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(amp).connect(bus);
  osc.start(when);
  osc.stop(end + 0.05);
}

/** Filtered noise burst: knocks, ticks, whooshes. */
function noise(ac, { when, duration, freq = 1200, q = 1, type = 'bandpass', gain = 0.08, bus = sfxBus }) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, when);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  src.connect(filter).connect(amp).connect(bus);
  src.start(when, Math.random() * 0.5);
  src.stop(when + duration + 0.02);
}

const STAR_NOTES = [76, 79, 84];

const SOUNDS = {
  select: (ac, t) => {
    voice(ac, { freq: 740, when: t, duration: 0.06, type: 'triangle', gain: 0.035 });
    voice(ac, { freq: 1110, when: t + 0.025, duration: 0.05, gain: 0.018 });
  },
  pick: (ac, t) => {
    voice(ac, { freq: 420, when: t, duration: 0.09, type: 'triangle', gain: 0.045, slide: 260 });
    noise(ac, { when: t, duration: 0.07, freq: 2500, q: 0.7, gain: 0.02 });
  },
  place: (ac, t) => {
    noise(ac, { when: t, duration: 0.05, freq: 900, type: 'lowpass', gain: 0.16 });
    voice(ac, { freq: 190, when: t, duration: 0.14, gain: 0.14, slide: -70 });
    voice(ac, { freq: 587, when: t + 0.01, duration: 0.08, type: 'triangle', gain: 0.03 });
  },
  rotate: (ac, t) => {
    noise(ac, { when: t, duration: 0.03, freq: 3200, q: 4, gain: 0.06 });
    voice(ac, { freq: 880, when: t, duration: 0.04, gain: 0.02, slide: 120 });
  },
  remove: (ac, t) => {
    voice(ac, { freq: 520, when: t, duration: 0.13, type: 'triangle', gain: 0.04, slide: -260 });
    noise(ac, { when: t, duration: 0.1, freq: 1500, q: 0.6, gain: 0.02 });
  },
  invalid: (ac, t) => {
    voice(ac, { freq: 185, when: t, duration: 0.09, type: 'square', gain: 0.028 });
    voice(ac, { freq: 139, when: t + 0.1, duration: 0.14, type: 'square', gain: 0.028 });
  },
  hint: (ac, t) => {
    [84, 88, 91, 96].forEach((n, i) => voice(ac, { freq: mtof(n), when: t + i * 0.06, duration: 0.22, gain: 0.03 }));
  },
  ui: (ac, t) => voice(ac, { freq: 660, when: t, duration: 0.04, gain: 0.025 }),
  start: (ac, t) => {
    voice(ac, { freq: mtof(72), when: t, duration: 0.14, type: 'triangle', gain: 0.04 });
    voice(ac, { freq: mtof(79), when: t + 0.09, duration: 0.22, type: 'triangle', gain: 0.04 });
  },
  complete: (ac, t) => {
    // Rising arpeggio into a bright major chord, topped with sparkles.
    [60, 64, 67, 72, 76].forEach((n, i) => voice(ac, { freq: mtof(n), when: t + i * 0.08, duration: 0.25, type: 'triangle', gain: 0.05 }));
    const chordAt = t + 0.45;
    [60, 64, 67, 72].forEach((n) => voice(ac, { freq: mtof(n), when: chordAt, duration: 1.3, type: 'triangle', gain: 0.035, release: 0.9 }));
    voice(ac, { freq: mtof(48), when: chordAt, duration: 1.3, gain: 0.06, release: 0.9 });
    [96, 100, 103, 108].forEach((n, i) => voice(ac, { freq: mtof(n), when: chordAt + 0.1 + i * 0.07, duration: 0.3, gain: 0.015 }));
  },
  star: (ac, t, index = 0) => {
    const n = STAR_NOTES[Math.min(index, STAR_NOTES.length - 1)];
    voice(ac, { freq: mtof(n), when: t, duration: 0.6, gain: 0.06, release: 0.45 });
    voice(ac, { freq: mtof(n + 12), when: t, duration: 0.35, gain: 0.02 });
  },
  newBest: (ac, t) => {
    [79, 83, 86, 91].forEach((n, i) => voice(ac, { freq: mtof(n), when: t + i * 0.07, duration: 0.2, type: 'triangle', gain: 0.035 }));
  },
};

const VIBRATION = {
  select: 5,
  pick: 8,
  place: 14,
  rotate: 6,
  remove: 8,
  invalid: [20, 40, 20],
  hint: 10,
  star: 12,
  complete: [30, 60, 30, 60, 80],
};

export function feedback(kind, arg) {
  try {
    if (enabled.sound && SOUNDS[kind]) {
      const ac = audio();
      if (ac) SOUNDS[kind](ac, ac.currentTime + 0.005, arg);
    }
    if (enabled.haptics && VIBRATION[kind] && navigator.vibrate) navigator.vibrate(VIBRATION[kind]);
  } catch {
    /* feedback is best-effort */
  }
}

/* ---------- Background music: a calm generative loop ---------- */

const BPM = 84;
const EIGHTH = 60 / BPM / 2;
// Am – F – C – G, one bar each.
const PROGRESSION = [
  [57, 60, 64],
  [53, 57, 60],
  [48, 52, 55],
  [55, 59, 62],
];
const MELODY_SCALE = [69, 72, 74, 76, 79, 81, 84];

let musicWanted = false;
let musicTimer = null;
let nextStepTime = 0;
let step = 0;

function scheduleStep(ac, t) {
  const bar = Math.floor(step / 8) % PROGRESSION.length;
  const beat = step % 8;
  const chord = PROGRESSION[bar];
  const bus = musicBus;
  if (beat === 0) {
    chord.forEach((n) => voice(ac, { freq: mtof(n), when: t, duration: EIGHTH * 8.5, gain: 0.012, attack: 0.5, release: 0.7, bus }));
    voice(ac, { freq: mtof(chord[0] - 12), when: t, duration: EIGHTH * 3.5, type: 'triangle', gain: 0.04, attack: 0.02, bus });
  }
  if (beat === 4) voice(ac, { freq: mtof(chord[2] - 12), when: t, duration: EIGHTH * 3.5, type: 'triangle', gain: 0.032, attack: 0.02, bus });
  if (beat === 2 || beat === 6) noise(ac, { when: t, duration: 0.04, freq: 7000, type: 'highpass', gain: 0.012, bus });
  // Sparse plucked melody that follows the chord.
  const density = beat % 2 === 0 ? 0.55 : 0.25;
  if (Math.random() < density) {
    const pool = Math.random() < 0.6 ? chord.map((n) => n + 12) : MELODY_SCALE;
    const note = pool[Math.floor(Math.random() * pool.length)];
    voice(ac, { freq: mtof(note), when: t, duration: 0.45, type: 'triangle', gain: 0.018, attack: 0.005, bus });
  }
}

function musicTick() {
  const ac = audio();
  if (!ac) return;
  while (nextStepTime < ac.currentTime + 0.3) {
    scheduleStep(ac, nextStepTime);
    nextStepTime += EIGHTH;
    step += 1;
  }
}

function startMusic() {
  const ac = audio();
  if (!ac || musicTimer) return;
  nextStepTime = ac.currentTime + 0.1;
  musicBus.gain.cancelScheduledValues(ac.currentTime);
  musicBus.gain.setValueAtTime(musicBus.gain.value, ac.currentTime);
  musicBus.gain.linearRampToValueAtTime(1, ac.currentTime + 1.5);
  musicTimer = setInterval(musicTick, 100);
  musicTick();
}

function stopMusic() {
  if (!musicTimer) return;
  clearInterval(musicTimer);
  musicTimer = null;
  if (ctx) {
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
  }
}

function syncMusic() {
  if (musicWanted && enabled.music && unlocked) startMusic();
  else stopMusic();
}

/** Play background music while a puzzle is actively being played. */
export function setMusicPlaying(on) {
  musicWanted = Boolean(on);
  syncMusic();
}

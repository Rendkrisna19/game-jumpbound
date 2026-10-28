// Procedural audio: every sound effect and music loop is synthesised at runtime with the
// Web Audio API, so the game ships with zero third-party audio files.
// The AudioContext is created lazily on the first user gesture (browser autoplay policy).
import { createRng } from '../game/math/random.js';

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Licensed music loops in public/assets/music (all CC0 — see ASSET_CREDITS.md).
// The menu gets its own track; every island gets a different one.
const FILE_TRACKS = {
  menu: 'menu-a-brand-new-wisdom.ogg',
  meadow: 'meadow-shakkar.ogg',
  canyon: 'canyon-telos-wilderness-14.ogg',
  temple: 'temple-a-path-somewhere.ogg',
  lagoon: 'lagoon-swinging-sweet.ogg',
  candy: 'summit-just-saying-tho.ogg',
};

// ---------- music definitions (original compositions generated from fixed seeds) ----------
const SCALES = {
  majorPent: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
};

const TRACKS = {
  menu: { bpm: 92, root: 62, scale: 'majorPent', chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], seed: 11, drums: false, lead: 'triangle' },
  meadow: { bpm: 116, root: 60, scale: 'major', chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], seed: 3, drums: true, lead: 'square' },
  canyon: { bpm: 104, root: 57, scale: 'dorian', chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-2, 2, 5]], seed: 7, drums: true, lead: 'triangle' },
  temple: { bpm: 90, root: 64, scale: 'lydian', chords: [[0, 4, 7], [2, 6, 9], [-1, 2, 7], [-3, 0, 4]], seed: 19, drums: true, lead: 'sine' },
  lagoon: { bpm: 122, root: 62, scale: 'majorPent', chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [-5, -1, 2]], seed: 23, drums: true, lead: 'triangle' },
  candy: { bpm: 128, root: 65, scale: 'lydian', chords: [[0, 4, 7], [-3, 0, 4], [2, 6, 9], [-5, -1, 2]], seed: 31, drums: true, lead: 'square' },
};

function buildMelody(track) {
  const rng = createRng(track.seed * 7919);
  const scale = SCALES[track.scale];
  const notes = [];
  for (let o = 0; o < 2; o++) for (const s of scale) notes.push(s + o * 12);
  let idx = Math.floor(notes.length / 2);
  const bars = [];
  for (let bar = 0; bar < 4; bar++) {
    const steps = new Array(16).fill(null);
    for (let step = 0; step < 16; step += 2) {
      const strong = step % 4 === 0;
      if (rng.next() < (strong ? 0.75 : 0.45)) {
        idx = Math.max(0, Math.min(notes.length - 1, idx + rng.int(-2, 2)));
        steps[step] = { note: notes[idx], len: rng.next() < 0.3 ? 4 : 2 };
      }
    }
    bars.push(steps);
  }
  return bars;
}

// ---------- the manager ----------
class AudioManager {
  constructor() {
    this.ctx = null;
    this.volumes = { master: 0.8, music: 0.5, sfx: 0.8 };
    this.track = null;
    this.pendingTrack = null;
    this.timer = null;
    this.ducked = false;
    this.buffers = new Map();
    this.fileSource = null;
    this.currentMusic = null;
    this.musicToken = 0;
    this.lastCollect = 0;
    this.combo = 0;
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.ratio.value = 4;
      this.master = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.musicFilter = ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 18000;
      this.sfxBus = ctx.createGain();
      this.musicBus.connect(this.musicFilter).connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(this.compressor).connect(ctx.destination);

      const len = ctx.sampleRate;
      this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      const rng = createRng(42);
      for (let i = 0; i < len; i++) data[i] = rng.next() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.pendingTrack && !this.timer) this.playMusic(this.pendingTrack);
  }

  setVolumes({ masterVolume, musicVolume, sfxVolume }) {
    this.volumes = { master: masterVolume, music: musicVolume, sfx: sfxVolume };
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * (this.ducked ? 0.35 : 1) * 0.55, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
    this.musicFilter.frequency.setTargetAtTime(this.ducked ? 900 : 18000, t, 0.15);
  }

  duck(on) {
    if (this.ducked === on) return;
    this.ducked = on;
    this.applyVolumes();
  }

  // ---------- primitives ----------
  tone({ freq, to, dur = 0.15, type = 'sine', vol = 0.2, attack = 0.005, delay = 0, bus, detune = 0, filter }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (detune) osc.detune.setValueAtTime(detune, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc.connect(gain);
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      node = node.connect(f);
    }
    node.connect(bus || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.1, vol = 0.2, freq = 1000, type = 'lowpass', delay = 0, q = 0.8, bus }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(bus || this.sfxBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  // ---------- sound effects ----------
  play(name, opts = {}) {
    if (!this.ready) return;
    const vol = opts.volume ?? 1;
    switch (name) {
      case 'jump':
        this.tone({ freq: 300, to: 640, dur: 0.14, type: 'square', vol: 0.06 * vol, filter: 2400 });
        this.tone({ freq: 420, to: 820, dur: 0.12, type: 'sine', vol: 0.1 * vol });
        break;
      case 'land':
        this.noise({ dur: 0.09, vol: 0.22 * vol, freq: 380 });
        this.tone({ freq: 120, to: 60, dur: 0.08, type: 'sine', vol: 0.12 * vol });
        break;
      case 'collect': {
        const now = performance.now();
        this.combo = now - this.lastCollect < 900 ? Math.min(this.combo + 1, 7) : 0;
        this.lastCollect = now;
        const base = 76 + [0, 2, 4, 5, 7, 9, 11, 12][this.combo];
        this.tone({ freq: midiToFreq(base), dur: 0.08, type: 'sine', vol: 0.14 });
        this.tone({ freq: midiToFreq(base + 7), dur: 0.16, type: 'triangle', vol: 0.12, delay: 0.055 });
        break;
      }
      case 'sunstone':
        [72, 76, 79, 84, 88].forEach((m, i) =>
          this.tone({ freq: midiToFreq(m), dur: 0.35, type: 'triangle', vol: 0.12, delay: i * 0.07 }),
        );
        this.tone({ freq: midiToFreq(96), dur: 0.6, type: 'sine', vol: 0.05, delay: 0.35 });
        break;
      case 'stomp':
        this.tone({ freq: 520, to: 110, dur: 0.16, type: 'square', vol: 0.08, filter: 1800 });
        this.noise({ dur: 0.12, vol: 0.18, freq: 900 });
        break;
      case 'bounce':
        this.tone({ freq: 160, to: 880, dur: 0.28, type: 'sine', vol: 0.18 });
        this.tone({ freq: 240, to: 1200, dur: 0.22, type: 'triangle', vol: 0.06, delay: 0.02 });
        break;
      case 'shatter':
        for (let i = 0; i < 6; i++) {
          this.tone({ freq: 1400 + Math.random() * 1800, dur: 0.18 + Math.random() * 0.2, type: 'sine', vol: 0.06, delay: i * 0.025 });
        }
        this.noise({ dur: 0.25, vol: 0.12, freq: 3000, type: 'highpass' });
        break;
      case 'charge':
        this.tone({ freq: 180, to: 520, dur: 0.55, type: 'sawtooth', vol: 0.04 * vol, filter: 1200, attack: 0.1 });
        break;
      case 'dash':
        this.noise({ dur: 0.3, vol: 0.12 * vol, freq: 1200, type: 'bandpass', q: 2 });
        break;
      case 'checkpoint':
        [76, 79, 83, 88].forEach((m, i) =>
          this.tone({ freq: midiToFreq(m), dur: 0.7, type: 'triangle', vol: 0.1, delay: i * 0.08 }),
        );
        break;
      case 'hurt':
        this.tone({ freq: 460, to: 130, dur: 0.32, type: 'sawtooth', vol: 0.1, filter: 1600 });
        this.noise({ dur: 0.15, vol: 0.12, freq: 700 });
        break;
      case 'lifeLost':
        [67, 64, 60, 55].forEach((m, i) =>
          this.tone({ freq: midiToFreq(m), dur: 0.22, type: 'square', vol: 0.06, delay: i * 0.13, filter: 1500 }),
        );
        break;
      case 'spikes':
        this.noise({ dur: 0.08, vol: 0.08 * vol, freq: 4000, type: 'highpass' });
        break;
      case 'portal':
        this.tone({ freq: 200, to: 1600, dur: 0.9, type: 'sine', vol: 0.1, attack: 0.2 });
        this.noise({ dur: 0.8, vol: 0.06, freq: 2500, type: 'bandpass', q: 3 });
        break;
      case 'victory': {
        const seq = [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [79, 0.54], [84, 0.66]];
        seq.forEach(([m, d]) => {
          this.tone({ freq: midiToFreq(m), dur: 0.3, type: 'square', vol: 0.05, delay: d, filter: 3000 });
          this.tone({ freq: midiToFreq(m), dur: 0.35, type: 'triangle', vol: 0.09, delay: d });
        });
        [60, 64, 67, 72].forEach((m) => this.tone({ freq: midiToFreq(m), dur: 1.4, type: 'triangle', vol: 0.06, delay: 0.66, attack: 0.05 }));
        break;
      }
      case 'gameover':
        [67, 63, 60, 55, 48].forEach((m, i) =>
          this.tone({ freq: midiToFreq(m), dur: 0.4, type: 'triangle', vol: 0.1, delay: i * 0.2 }),
        );
        break;
      case 'menuOpen':
        this.tone({ freq: 620, to: 920, dur: 0.09, type: 'sine', vol: 0.09 });
        break;
      case 'menuClose':
        this.tone({ freq: 900, to: 600, dur: 0.09, type: 'sine', vol: 0.08 });
        break;
      case 'click':
        this.tone({ freq: 1100, to: 1500, dur: 0.05, type: 'triangle', vol: 0.08 });
        break;
      case 'hover':
        this.tone({ freq: 1500, dur: 0.03, type: 'sine', vol: 0.025 });
        break;
      default:
        break;
    }
  }

  // ---------- music ----------
  /** Plays the licensed loop for `name` (see FILE_TRACKS), or the procedural fallback if it fails. */
  playMusic(name) {
    this.pendingTrack = name;
    if (!this.ctx) return;
    if (this.currentMusic === name) return;
    this.stopMusic(true);
    this.currentMusic = name;
    const token = ++this.musicToken;
    if (FILE_TRACKS[name]) {
      this.playFileTrack(name, token);
    } else {
      this.playProcedural(name);
    }
  }

  playProcedural(name) {
    const def = TRACKS[name];
    if (!def) return;
    this.track = { name, def, melody: buildMelody(def), step: 0, nextTime: this.ctx.currentTime + 0.1 };
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  async playFileTrack(name, token) {
    const buffer = await this.loadBuffer(name);
    if (token !== this.musicToken) return;
    if (!buffer) {
      this.playProcedural(name);
      return;
    }
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
    src.connect(gain).connect(this.musicBus);
    src.start();
    this.fileSource = { src, gain };
  }

  async loadBuffer(name) {
    if (!this.buffers.has(name)) {
      const url = `${import.meta.env.BASE_URL}assets/music/${FILE_TRACKS[name]}`;
      this.buffers.set(
        name,
        fetch(url)
          .then((r) => {
            if (!r.ok) throw new Error(`${r.status} ${url}`);
            return r.arrayBuffer();
          })
          .then((data) => this.ctx.decodeAudioData(data))
          .catch((err) => {
            console.warn('Music file unavailable, using procedural fallback:', err.message);
            return null;
          }),
      );
    }
    return this.buffers.get(name);
  }

  stopMusic(immediate = false) {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.track = null;
    if (this.fileSource && this.ctx) {
      const { src, gain } = this.fileSource;
      const t = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.4);
      src.stop(t + 0.45);
    }
    this.fileSource = null;
    this.currentMusic = null;
    this.musicToken++;
    if (!immediate) this.pendingTrack = null;
  }

  schedule() {
    const tr = this.track;
    if (!tr || !this.ctx) return;
    const stepDur = 60 / tr.def.bpm / 4;
    while (tr.nextTime < this.ctx.currentTime + 0.15) {
      this.playStep(tr, tr.step, tr.nextTime, stepDur);
      tr.nextTime += stepDur;
      tr.step = (tr.step + 1) % 64;
    }
  }

  playStep(tr, step, time, stepDur) {
    const { def, melody } = tr;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = def.chords[bar % def.chords.length];
    const delay = Math.max(0, time - this.ctx.currentTime);
    const bus = this.musicBus;

    if (s === 0) {
      chord.forEach((n) =>
        this.tone({ freq: midiToFreq(def.root + n - 12), dur: stepDur * 15, type: 'sine', vol: 0.035, attack: 0.25, delay, bus }),
      );
    }
    if (s === 0 || s === 8 || (def.drums && (s === 6 || s === 14))) {
      const bassNote = def.root + chord[0] - 24 + (s === 14 ? 7 : 0);
      this.tone({ freq: midiToFreq(bassNote), dur: stepDur * 3, type: 'triangle', vol: 0.12, delay, bus });
    }
    const m = melody[bar][s];
    if (m) {
      this.tone({ freq: midiToFreq(def.root + m.note), dur: stepDur * m.len, type: def.lead, vol: def.lead === 'square' ? 0.035 : 0.06, delay, bus, filter: 2600 });
    }
    if (def.drums) {
      if (s % 8 === 0) this.tone({ freq: 130, to: 45, dur: 0.14, type: 'sine', vol: 0.16, delay, bus });
      if (s % 4 === 2) this.noise({ dur: 0.035, vol: 0.025, freq: 7000, type: 'highpass', delay, bus });
      if (s === 4 || s === 12) this.noise({ dur: 0.1, vol: 0.04, freq: 1800, type: 'bandpass', delay, bus });
    }
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) this.ctx.close().catch(() => {});
    this.ctx = null;
  }
}

export const audio = new AudioManager();

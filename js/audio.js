'use strict';
// Procedural audio: every sound is synthesised. Music is a step sequencer driven by
// the game's beat clock, so gameplay that keys off the beat stays in sync with it.
const AU = {
  ctx: null, out: null, nbuf: null, mute: false, last: {},
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = typeof AudioContext !== 'undefined' ? AudioContext : null;
    if (!AC) return;
    try { this.setup(new AC()); } catch (e) { this.ctx = null; }
  },
  setup(ctx) {
    this.ctx = ctx; this.mg = null;
    this.out = ctx.createGain(); this.out.gain.value = 0.5 * META.vol;
    const comp = ctx.createDynamicsCompressor();
    this.out.connect(comp); comp.connect(ctx.destination);
    const n = ctx.sampleRate * 0.5;
    this.nbuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.nbuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  },

  // ------------------------------------------------------------ sound effects
  tone(f, d, type, vol, f2) {
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + d + 0.02);
  },
  noise(d, vol, fq, q) {
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    s.buffer = this.nbuf; f.type = 'bandpass'; f.frequency.value = fq || 2000; f.Q.value = q || 0.7;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random() * 0.3, d + 0.02);
  },
  GAP: { shoot: .05, hit: .04, tink: .05, absorb: .03, kill: .05, graze: .06 },
  sfx(n, v) {
    if (!this.ctx || this.mute) return;
    const t = this.ctx.currentTime;
    if (t - (this.last[n] || -1) < (this.GAP[n] || .02)) return;
    this.last[n] = t;
    switch (n) {
      case 'shoot': this.tone(620 + rand(60), .06, 'square', .035, 300); break;
      case 'hit': this.noise(.04, .08, 3200); break;
      case 'absorb': this.tone(500 + (v || 0) * 6, .07, 'sine', .09, 900 + (v || 0) * 8); break;
      case 'tink': this.tone(1500, .035, 'triangle', .05, 900); break;
      case 'graze': this.tone(1800, .03, 'triangle', .04); break;
      case 'flip': this.tone(v ? 240 : 480, .12, 'sawtooth', .07, v ? 480 : 240); break;
      case 'deny': this.tone(110, .1, 'square', .08, 90); break;
      case 'kill': this.noise(.16, .16, 900); this.tone(200, .14, 'triangle', .1, 60); break;
      case 'boom': this.noise(.5, .3, 300); this.tone(90, .5, 'sine', .3, 30); break;
      case 'hurt': this.noise(.3, .3, 500); this.tone(300, .3, 'sawtooth', .14, 50); break;
      case 'burst': this.tone(200, .4, 'sawtooth', .1, 1600); this.noise(.3, .12, 4000); break;
      case 'pick': this.tone(880, .06, 'triangle', .08, 1320); break;
      case 'take': this.tone(440, .1, 'square', .07, 880); this.tone(660, .25, 'triangle', .08, 1320); break;
      case 'clear': this.tone(523, .1, 'triangle', .09); this.tone(784, .25, 'triangle', .08); break;
      case 'unlock': this.tone(660, .12, 'square', .06); this.tone(990, .3, 'triangle', .09, 1980); break;
      case 'warp': this.tone(80, .9, 'sawtooth', .12, 1200); this.noise(.8, .1, 1500); break;
      case 'swap': this.tone(1200, .15, 'square', .07, 150); break;
      case 'beam': this.tone(140, .2, 'sawtooth', .05, 130); break;
    }
  },

  // ------------------------------------------------------------ music
  // Five songs (floor themes pick one by index). Each has its own key, mode, chord loop,
  // bassline, arpeggio and timbres. scale = semitone offsets; prog = scale degrees, two bars
  // per chord; bass/arp are 16-step patterns (-1 = rest; bass in scale steps above the chord
  // root, arp as chord-tone index 0-3).
  MUS: [
    { root: 55, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], arpW: 'square', bassW: 'sawtooth',
      bass: [-1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, 0], arp: [0, -1, 2, -1, 1, -1, 2, -1, 3, -1, 2, -1, 1, -1, 2, -1] },
    { root: 49, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 5, 4], arpW: 'sawtooth', bassW: 'square',
      bass: [0, -1, 0, 0, -1, 0, 0, -1, 0, -1, 0, 0, -1, 0, 7, 0], arp: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3] },
    { root: 41.2, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 6], arpW: 'triangle', bassW: 'sawtooth',
      bass: [0, -1, -1, -1, -1, -1, -1, 0, -1, -1, 0, -1, -1, -1, -1, -1], arp: [0, -1, -1, 2, -1, -1, 1, -1, -1, 3, -1, -1, 2, -1, 1, -1] },
    { root: 46.25, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 0, 6], arpW: 'square', bassW: 'sawtooth',
      bass: [0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 7, 7], arp: [3, -1, 3, 2, -1, 3, -1, 1, 3, -1, 3, 2, -1, 0, -1, 1] },
    { root: 51.9, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 6, 4], arpW: 'sawtooth', bassW: 'sawtooth',
      bass: [0, 0, 7, 0, 2, 0, 7, 0, 0, 4, 7, 0, 2, 0, 7, 4], arp: [0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 1, 2, 0, 3, 2, 1] }
  ],
  initMusic() {
    const c = this.ctx;
    this.mg = c.createGain(); this.mg.gain.value = .85; this.mg.connect(this.out);
    // everything tonal runs through "duck", which the kick pulls down for the sidechain pump
    this.duck = c.createGain(); this.duck.connect(this.mg);
    this.dly = c.createDelay(1.5); this.dly.delayTime.value = .3;
    const fb = c.createGain(), wet = c.createGain(), lp = c.createBiquadFilter();
    fb.gain.value = .4; wet.gain.value = .45; lp.type = 'lowpass'; lp.frequency.value = 2800;
    this.dly.connect(lp); lp.connect(fb); fb.connect(this.dly); lp.connect(wet); wet.connect(this.duck);
  },
  // one enveloped oscillator -> optional lowpass -> dest
  voice(type, f, t, dur, vol, dest, o) {
    const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
    o = o || {};
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.ft || dur));
    if (o.det) osc.detune.value = o.det;
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || .004));
    if (o.hold) g.gain.setValueAtTime(vol, t + dur - o.hold);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let tail = g;
    if (o.cut) {
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = o.q || 1;
      fl.frequency.setValueAtTime(o.cut, t); if (o.cut2) fl.frequency.exponentialRampToValueAtTime(o.cut2, t + dur);
      g.connect(fl); tail = fl;
    }
    osc.connect(g); tail.connect(dest); if (o.send) tail.connect(o.send);
    osc.start(t); osc.stop(t + dur + .05);
  },
  hiss(t, dur, vol, type, fq, dest, a) {
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    s.buffer = this.nbuf; s.loop = true; f.type = type; f.frequency.value = fq;
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + (a || .002)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * .3); s.stop(t + dur + .05);
  },
  kick(t, vol) {
    this.voice('sine', 165, t, .32, vol, this.mg, { f2: 42, ft: .11 });
    this.voice('triangle', 900, t, .03, vol * .25, this.mg, { f2: 120 });
    const g = this.duck.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(.3, t); g.linearRampToValueAtTime(1, t + .24);
  },
  // i = sixteenth-note index; level 0 calm, 1 combat, 2 boss; late = seconds since the step
  // was due (keeps spacing even despite frame timing); at = absolute time, for offline renders
  step(i, mus, level, bpm, late, at) {
    if (!this.ctx || this.mute) return;
    if (!this.mg) this.initMusic();
    const M = this.MUS[mus % 5], sd = 15 / bpm, t = at !== undefined ? at : this.ctx.currentTime + .06 - Math.min(late || 0, .05);
    const s = i % 16, bar = Math.floor(i / 16), ph = bar % 16, B = ph >= 8;
    const n = M.scale.length;
    const deg = (d, oct) => M.root * Math.pow(2, oct + (M.scale[((d % n) + n) % n] + 12 * Math.floor(d / n)) / 12);
    const chord = M.prog[(B ? 3 - ((bar >> 1) % 4) : (bar >> 1) % 4)];
    const fill = bar % 4 === 3 && s >= 12, breakdown = ph === 8 && level < 2, build = ph === 7 || ph === 15;
    const sweep = .5 - .5 * Math.cos((bar % 8 + s / 16) / 8 * Math.PI * 2); // 8-bar filter sweep, 0..1
    this.dly.delayTime.setValueAtTime(sd * 3, t);

    // --- drums
    if (s % 4 === 0 && !breakdown) this.kick(t, level ? .85 : .5);
    if (level > 0) {
      if (s === 4 || s === 12) { this.hiss(t, .16, .2, 'bandpass', 1700, this.mg); this.hiss(t + .012, .1, .12, 'highpass', 2500, this.mg); }
      if (s % 4 === 2) this.hiss(t, .09 + .06 * sweep, .07, 'highpass', 7500, this.mg);          // open hat on the off-beat
      if (s % 2 === 1 && (level > 1 || B)) this.hiss(t, .03, .035, 'highpass', 9000, this.mg);    // 16th shaker
      if (fill) this.hiss(t, .07, .06 + (s - 12) * .035, 'bandpass', 2200, this.mg);              // snare roll into the next phrase
      if (build && s === 0) this.hiss(t, sd * 16, .09, 'bandpass', 5000, this.duck, sd * 15);      // riser
      if ((ph === 0 || ph === 8) && s === 0 && bar > 0) this.hiss(t, 1.2, .11, 'highpass', 5000, this.mg); // crash
    } else if (s === 8) this.hiss(t, .05, .03, 'highpass', 8000, this.mg);

    // --- bass: filtered saw + sub an octave below, on the boss the pattern jumps octaves
    const bn = M.bass[s];
    if (level > 0 ? bn >= 0 : s === 0) {
      const d = chord + (level > 0 ? bn : 0) + (level > 1 && s % 8 === 6 ? 7 : 0), cut = 260 + 1300 * sweep + level * 350;
      this.voice(M.bassW, deg(d, 1), t, sd * (level ? 1.7 : 6), level ? .2 : .1, this.duck, { cut, cut2: 140, q: 7 });
      this.voice('sine', deg(d, 0), t, sd * (level ? 1.9 : 7), .26, this.duck, { a: .008 });
    }

    // --- pad: detuned triad, re-struck every bar, opening up with the sweep
    if (s === 0) for (const k of [0, 2, 4]) for (const det of [-9, 9])
      this.voice('sawtooth', deg(chord + k, 2), t, sd * 16.5, level ? .028 : .04, this.duck, { a: sd * 3, hold: sd * 3, det, cut: 500 + 1500 * sweep + level * 300, q: .7 });

    // --- arpeggio: plucks into the delay; the B half of each phrase uses the next song's pattern
    const ap = (B ? this.MUS[(mus + 1) % 5].arp : M.arp)[s];
    if (ap >= 0 && (level > 0 || s % 4 === 0)) {
      const f = deg(chord + [0, 2, 4, 7][ap], 3);
      this.voice(M.arpW, f, t, sd * 1.6, level ? .05 : .03, this.duck, { cut: 900 + 2600 * sweep, cut2: 500, q: 3, send: this.dly });
    }

    // --- lead (boss only): a fixed pseudo-random melody per song, eight bars long
    if (level > 1 && s % 2 === 0) {
      const h = (((bar % 8) * 31 + s * 17 + mus * 7 + 3) * 2654435761) >>> 0;
      if (h % 100 < 58) {
        const f = deg(chord + [0, 2, 4, 6, 7, 9][(h >>> 8) % 6], 4);
        this.voice('sawtooth', f, t, sd * ((h >>> 12) % 3 === 0 ? 3.6 : 1.8), .04, this.duck, { det: 6, cut: 3500, cut2: 1200, q: 2, send: this.dly });
        this.voice('square', f / 2, t, sd * 1.6, .018, this.duck, { cut: 2000, send: this.dly });
      }
    }
  }
};

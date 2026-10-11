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
  // Five songs, each in its own sub-genre; floor themes pick one by index (tempo comes from
  // the theme). All patterns are 16 steps of sixteenth notes.
  //   scale  semitone offsets          prog  chord roots as scale degrees, cb bars each
  //   bass   scale steps above the chord root, -1 rest
  //   acid   optional 303-style line (with acc = accents, sl = slides into the note)
  //   gate   rhythm that chops the supersaw chord (the "trance gate"), 0..1 per step
  //   arp    pluck line, scale steps above the chord root
  //   leadA/leadB  melody (B on every fourth bar): scale steps above the chord root, -1 rest, -2 tie
  MUS: [
    { // progressive trance, A minor: i-VI-III-VII, offbeat bass, 3-3-2 plucks
      root: 55, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], cb: 2, bassW: 'sawtooth', bassLen: 1.6, bassCut: 420, arpW: 'sawtooth',
      bass: [-1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, 0],
      gate: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
      arp: [7, -1, -1, 4, -1, -1, 2, -1, 7, -1, -1, 4, -1, -1, 9, -1],
      leadA: [4, -2, -2, 4, -2, 2, -2, -1, 4, -2, -2, 7, -2, -2, 4, -2],
      leadB: [4, -2, -2, 4, -2, 2, -2, -1, 0, -2, 2, -2, 4, -2, 6, -2] },
    { // acid techno, G phrygian: one chord with a flat-second turn, squelching 303 line
      root: 49, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 0, 0, 1], cb: 2, bassW: 'sawtooth', bassLen: 1.4, bassCut: 200, arpW: 'square',
      bass: [-1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1],
      acid: [0, -1, 0, 7, -1, 0, 3, -1, 0, 0, -1, 7, 0, -1, 10, 7],
      acc: [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0], sl: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1],
      gate: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      leadB: [7, -1, -1, 7, -1, -1, 6, -2, -2, -2, -1, -1, -1, -1, -1, -1] },
    { // dark techno, E minor: rumbling sixteenths, lone stabs into the reverb, slow eerie lead
      root: 41.2, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 6, 0], cb: 2, bassW: 'sawtooth', bassLen: .8, bassCut: 170, arpW: 'triangle',
      bass: [-1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0],
      gate: [0, 0, 0, .6, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      arp: [-1, -1, 7, -1, -1, 7, -1, -1, 9, -1, -1, 7, -1, -1, -1, -1],
      leadA: [4, -2, -2, -2, -2, -2, -2, -2, 3, -2, -2, -2, -2, -2, -2, -1],
      leadB: [7, -2, -2, -2, -2, -2, -2, -2, 6, -2, -2, -2, 4, -2, -2, -1] },
    { // uplifting trance, F# minor: VI-VII-i-i, rolling bass, full gate, soaring lead
      root: 46.25, scale: [0, 2, 3, 5, 7, 8, 10], prog: [5, 6, 0, 0], cb: 2, bassW: 'sawtooth', bassLen: .9, bassCut: 380, arpW: 'sawtooth',
      bass: [-1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 7],
      gate: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1],
      arp: [0, 2, 4, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2, 4, 7],
      leadA: [7, -2, -2, 6, -2, -2, 4, -2, 2, -2, -2, 4, -2, -2, -2, -1],
      leadB: [7, -2, -2, 6, -2, -2, 4, -2, 9, -2, -2, 7, -2, 6, 4, -2] },
    { // psy / hard trance, G# phrygian dominant: galloping bass, stepwise goa runs
      root: 51.9, scale: [0, 1, 4, 5, 7, 8, 10], prog: [0, 0, 1, 0], cb: 2, bassW: 'square', bassLen: .8, bassCut: 500, arpW: 'sawtooth',
      bass: [-1, -1, 0, 0, -1, 0, 0, 7, -1, -1, 0, 0, -1, 0, 7, 0],
      gate: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
      arp: [0, 1, 2, 4, 2, 1, 0, 1, 4, 5, 4, 2, 1, 2, 0, -1],
      leadA: [7, -2, 8, 7, -1, 5, 4, -2, 7, -2, 8, 9, -2, 8, 7, -2],
      leadB: [11, -2, 9, 8, -2, 7, -1, 5, 7, -2, 8, 7, -2, 5, 4, -2] }
  ],
  initMusic() {
    const c = this.ctx;
    this.mg = c.createGain(); this.mg.gain.value = .85; this.mg.connect(this.out);
    // everything tonal runs through "duck", which the kick pulls down for the sidechain pump
    this.duck = c.createGain(); this.duck.connect(this.mg);
    // tempo-synced feedback delay
    this.dly = c.createDelay(1.5); this.dly.delayTime.value = .3;
    const fb = c.createGain(), wet = c.createGain(), lp = c.createBiquadFilter();
    fb.gain.value = .42; wet.gain.value = .4; lp.type = 'lowpass'; lp.frequency.value = 3000;
    this.dly.connect(lp); lp.connect(fb); fb.connect(this.dly); lp.connect(wet); wet.connect(this.duck);
    // reverb: convolution with a generated decaying-noise impulse
    const len = Math.floor(c.sampleRate * 2), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3.5); }
    this.rev = c.createGain(); this.rev.gain.value = .5;
    const cv = c.createConvolver(), rw = c.createGain(), hp = c.createBiquadFilter();
    cv.buffer = ir; rw.gain.value = .55; hp.type = 'highpass'; hp.frequency.value = 350;
    this.rev.connect(hp); hp.connect(cv); cv.connect(rw); rw.connect(this.mg);
    this.lastAcid = 0;
  },
  // one enveloped oscillator -> optional lowpass -> dest (+ optional delay / reverb sends)
  voice(type, f, t, dur, vol, dest, o) {
    const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
    o = o || {};
    osc.type = type;
    if (o.from) { osc.frequency.setValueAtTime(o.from, t); osc.frequency.exponentialRampToValueAtTime(f, t + .07); } else osc.frequency.setValueAtTime(f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.ft || dur));
    if (o.det) osc.detune.value = o.det;
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || .004));
    if (o.hold) g.gain.setValueAtTime(vol, t + dur * o.hold);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let tail = g;
    if (o.cut) {
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = o.q || 1;
      fl.frequency.setValueAtTime(o.cut, t); if (o.cut2) fl.frequency.exponentialRampToValueAtTime(o.cut2, t + dur);
      g.connect(fl); tail = fl;
    }
    osc.connect(g); tail.connect(dest);
    if (o.dly) tail.connect(this.dly);
    if (o.rev) tail.connect(this.rev);
    osc.start(t); osc.stop(t + dur + .05);
  },
  hiss(t, dur, vol, type, fq, dest, a, rev) {
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    s.buffer = this.nbuf; s.loop = true; f.type = type; f.frequency.value = fq;
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + (a || .002)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); if (rev) g.connect(this.rev);
    s.start(t, Math.random() * .3); s.stop(t + dur + .05);
  },
  kick(t, vol) {
    this.voice('sine', 155, t, .24, vol, this.mg, { f2: 46, ft: .07, hold: .2 });
    this.hiss(t, .014, vol * .5, 'highpass', 3000, this.mg);
    const g = this.duck.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(.4, t); g.linearRampToValueAtTime(1, t + .17);
  },
  clap(t, vol) {
    for (let k = 0; k < 3; k++) this.hiss(t + k * .011, .02, vol * .7, 'bandpass', 1500, this.mg);
    this.hiss(t + .03, .16, vol, 'bandpass', 1500, this.mg, 0, true);
  },
  // a supersaw chord for one bar, chopped by the song's gate rhythm
  gateChord(t, sd, gate, freqs, vol, cut) {
    const c = this.ctx, g = c.createGain(), fl = c.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.value = cut; fl.Q.value = 1.2;
    g.gain.setValueAtTime(0, t);
    for (let k = 0; k < 16; k++) {
      if (!gate[k]) continue;
      const a = t + k * sd, v = gate[k] * vol;
      g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(v, a + .006);
      g.gain.setValueAtTime(v, a + sd * .5); g.gain.linearRampToValueAtTime(0, a + sd * .92);
    }
    for (const f of freqs) for (const det of [-16, -6, 6, 16]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + sd * 16 + .05);
    }
    g.connect(fl); fl.connect(this.duck); fl.connect(this.rev);
  },
  // i = sixteenth-note index; level 0 calm, 1 combat, 2 boss; late = seconds since the step
  // was due (keeps spacing even despite frame timing); at = absolute time, for offline renders.
  //
  // Arrangement: calm rooms are a breakdown (no kick; chords, plucks and melody). Combat is a
  // 16-bar loop: 8 bars of groove, then 8 with the gated chords and lead on top, ending in a
  // snare-roll build. Bosses stay in the full drop. So walking into a fight is the drop.
  step(i, mus, level, bpm, late, at) {
    if (!this.ctx || this.mute) return;
    if (!this.mg) this.initMusic();
    const M = this.MUS[mus % 5], sd = 15 / bpm, t = at !== undefined ? at : this.ctx.currentTime + .06 - Math.min(late || 0, .05);
    const s = i % 16, bar = Math.floor(i / 16), ph = bar % 16, n = M.scale.length;
    const full = level > 1 || (level === 1 && ph >= 8), build = level > 0 && ph === 15, cut8 = build && s >= 8;
    const hz = (d, oct) => M.root * Math.pow(2, oct + (M.scale[((d % n) + n) % n] + 12 * Math.floor(d / n)) / 12);
    const c0 = M.prog[Math.floor(bar / M.cb) % M.prog.length], cm = c0 > 4 ? c0 - 7 : c0; // keep chords near the tonic
    const sweep = .5 - .5 * Math.cos((bar % 8 + s / 16) / 8 * Math.PI * 2); // 8-bar filter sweep, 0..1
    const lead = bar % 4 === 3 ? M.leadB : M.leadA;
    this.dly.delayTime.setValueAtTime(sd * 3, t);

    // --- drums: four on the floor, clap on 2 and 4, open hat on every off-beat
    if (level > 0) {
      if (s % 4 === 0 && !cut8) this.kick(t, .58);
      if ((s === 4 || s === 12) && !cut8) this.clap(t, .42);
      if (s % 4 === 2) this.hiss(t, .12, .24, 'highpass', 7000, this.mg);
      else if (s % 4 !== 0) this.hiss(t, .03, s % 4 === 3 ? .13 : .08, 'highpass', 9500, this.mg);
      if (full && s % 4 === 0) this.hiss(t, .22, .09, 'bandpass', 6500, this.mg);                         // ride
      if (build) {                                                                                       // roll: quarters, eighths, sixteenths
        if (s === 0) this.hiss(t, sd * 16, .25, 'bandpass', 4500, this.duck, sd * 15.5, true);
        if (s === 0 || s === 4 || s === 8 || s === 10 || s >= 12) this.hiss(t, .09, .16 + s * .022, 'bandpass', 1800 + s * 60, this.mg, 0, true);
      } else if (ph === 7 && s >= 13) this.hiss(t, .07, .22, 'bandpass', 1900, this.mg);
      if (ph % 8 === 0 && s === 0 && bar > 0) this.hiss(t, 1.6, .22, 'highpass', 4500, this.mg, 0, true);   // crash on the downbeat
    } else if (s % 4 === 2) this.hiss(t, .03, .07, 'highpass', 9000, this.mg);

    // --- bass
    if (level > 0 && !cut8) {
      const b = M.bass[s];
      if (b >= 0) {
        this.voice(M.bassW, hz(cm + b, 1), t, sd * M.bassLen, .26, this.duck, { cut: M.bassCut * (1.6 + 2.4 * sweep) + level * 150, cut2: 160, q: 6 });
        this.voice('sine', hz(cm, 0), t, sd * M.bassLen, .11, this.duck, { a: .006, hold: .4 });
      }
      const a = M.acid ? M.acid[s] : -1;
      if (a >= 0) {
        const f = hz(cm + a, 1), acc = M.acc[s], sl = M.sl[s];
        this.voice('sawtooth', f, t, sd * (sl ? 2 : .95), acc ? .32 : .22, this.duck,
          { from: sl ? this.lastAcid : 0, cut: (350 + 1900 * sweep) * (acc ? 2.6 : 1.3), cut2: 200, q: 14, dly: !!acc });
        this.lastAcid = f;
      }
    } else if (level === 0 && s === 0 && bar % M.cb === 0) {
      this.voice('sine', hz(cm, 1), t, sd * 16 * M.cb, .09, this.mg, { a: .2, hold: .6 });
      this.voice('triangle', hz(cm + 4, 1), t, sd * 16 * M.cb, .04, this.mg, { a: .4, hold: .6 });
    }

    // --- gated supersaw chord (calm: soft and filtered; drop: wide open)
    if (s === 0 && (level === 0 || full) && !build) {
      const fr = [hz(cm, 2), hz(cm + 2, 2), hz(cm + 4, 2), hz(cm + 7, 2)];
      this.gateChord(t, sd, M.gate, fr, level ? .06 : .04, level ? 1400 + 3200 * sweep : 500 + 900 * sweep);
    }

    // --- pluck arpeggio
    const ap = M.arp ? M.arp[s] : -1;
    if (ap >= 0 && !cut8)
      this.voice(M.arpW, hz(cm + ap, 3), t, sd * 1.5, full ? .12 : .14, this.duck, { cut: 1100 + 3200 * sweep, cut2: 500, q: 2.5, dly: true, rev: level === 0 });

    // --- lead: three detuned saws, an octave doubled on bosses; short repeating figures
    const L = lead ? lead[s] : -1;
    if (L >= 0 && (full || (level === 0 && bar % 8 >= 4)) && !build) {
      let len = 1; while (s + len < 16 && lead[s + len] === -2) len++;
      const f = hz(cm + L, 3), v = level ? .1 : .06, o = { cut: 1800 + 3500 * sweep, cut2: 900, q: 1.5, hold: .6, dly: true, rev: true };
      for (const det of [-11, 0, 11]) this.voice('sawtooth', f, t, sd * (len + .4), v, this.duck, Object.assign({ det }, o));
      if (level > 1) this.voice('square', f * 2, t, sd * (len + .2), .03, this.duck, o);
    }
  }
};

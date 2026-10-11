'use strict';
// Procedural audio: every sound is synthesised. Music is a step sequencer driven by
// the game's beat clock, so gameplay that keys off the beat stays in sync with it.
// One bar of melody as text: numbers are scale degrees counted from the tonic two octaves below
// the lead's range (7 = tonic, 9 = third, 11 = fifth, 14 = tonic above); "." rests, "-" ties.
const _bar = t => t.split(' ').map(x => x === '.' ? -1 : x === '-' ? -2 : +x);

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
  // Effects are pitched from the current song's scale (see note), so they sit inside the music
  // rather than fighting it, and are loud and bright enough to read over a full mix.
  tone(f, d, type, vol, f2, o) {
    const c = this.ctx, t = c.currentTime + ((o && o.at) || 0), osc = c.createOscillator(), g = c.createGain();
    osc.type = type || 'square'; osc.frequency.setValueAtTime(f, t);
    if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .003); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    osc.connect(g); g.connect(this.out);
    if (o && o.rev && this.rev) g.connect(this.rev);
    if (o && o.dly && this.dly) g.connect(this.dly);
    osc.start(t); osc.stop(t + d + 0.02);
  },
  noise(d, vol, fq, q, rev) {
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    s.buffer = this.nbuf; f.type = 'bandpass'; f.frequency.value = fq || 2000; f.Q.value = q || 0.7;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f); f.connect(g); g.connect(this.out); if (rev && this.rev) g.connect(this.rev);
    s.start(t, Math.random() * 0.3, d + 0.02);
  },
  // frequency of a scale degree in the song that is playing
  note(deg, oct) {
    const M = this.key || this.MUS[0], n = M.scale.length;
    return M.root * (this.lift || 1) * Math.pow(2, oct + (M.scale[((deg % n) + n) % n] + 12 * Math.floor(deg / n)) / 12);
  },
  GAP: { shoot: .05, hit: .04, tink: .05, absorb: .03, kill: .05, graze: .06, pick: .04 },
  sfx(n, v) {
    if (!this.ctx || this.mute) return;
    const t = this.ctx.currentTime;
    if (t - (this.last[n] || -1) < (this.GAP[n] || .02)) return;
    this.last[n] = t;
    const N = (d, o) => this.note(d, o);
    switch (n) {
      // the shot: a bright zap on the tonic (light) or the fifth below it (dark), with a click on top
      case 'shoot': { const f = v ? N(4, 4) : N(0, 5); this.tone(f, .075, v ? 'sawtooth' : 'square', .14, f * .4); this.noise(.018, .12, 6500, 1); break; }
      case 'hit': this.noise(.05, .17, 2600); this.tone(N(0, 3), .04, 'square', .08, N(0, 2)); break;
      case 'absorb': this.tone(N(Math.floor((v || 0) / 15) % 15, 4), .1, 'sine', .17, 0, { dly: true }); break; // climbs the scale as charge builds
      case 'tink': this.tone(N(7, 5), .045, 'triangle', .12, N(4, 5)); break;
      case 'graze': this.tone(N(4, 6), .04, 'triangle', .08); break;
      case 'flip': this.tone(N(0, v ? 4 : 3), .14, 'sawtooth', .14, N(0, v ? 3 : 4)); this.noise(.08, .09, 3000, 2); break;
      case 'deny': this.tone(N(1, 2), .12, 'square', .13, N(0, 2)); break;
      case 'kill': this.noise(.2, .28, 1100, .8, true); this.tone(N(0, 3), .16, 'triangle', .22, N(0, 1)); break;
      case 'boom': this.noise(.7, .42, 260, .7, true); this.tone(95, .6, 'sine', .45, 30); break;
      case 'hurt': this.noise(.35, .42, 600); this.tone(N(1, 3), .35, 'sawtooth', .24, 50); break;
      case 'burst': this.tone(N(0, 2), .45, 'sawtooth', .17, N(0, 5), { rev: true }); this.noise(.35, .17, 4000, .7, true); break;
      case 'pick': this.pk = ((this.pk || 0) + 1) % 4; this.tone(N(4 + this.pk, 5), .08, 'triangle', .14, 0, { dly: true }); break;
      case 'take': [0, 2, 4, 7].forEach((d, k) => this.tone(N(d, 4), .16, 'square', .11, 0, { at: k * .06, dly: true, rev: true })); break;
      case 'clear': [4, 7, 9].forEach((d, k) => this.tone(N(d, 4), .2, 'triangle', .14, 0, { at: k * .08, rev: true })); break;
      case 'unlock': [0, 4, 7, 11].forEach((d, k) => this.tone(N(d, 5), .22, 'triangle', .12, 0, { at: k * .07, dly: true, rev: true })); break;
      case 'warp': this.tone(N(0, 1), .9, 'sawtooth', .17, N(0, 5), { rev: true }); this.noise(.8, .15, 1500, .7, true); break;
      case 'swap': this.tone(N(7, 5), .16, 'square', .12, N(0, 3)); break;
      case 'beam': this.tone(N(0, 2), .25, 'sawtooth', .1, N(0, 2) * .93); break;
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
  //   mel/melB/melP  instead of leadA.., a through-written 8-bar melody in absolute scale degrees
  //                  (see _bar): mel for the base phrase, melB its variation, melP over progB
  // Each song runs a 64-bar cycle of four 16-bar phrases: the base patterns; the *B patterns
  // with leadC/leadD; the base patterns over progB; then both together, lifted by `lift`
  // semitones where the song has one.
  MUS: [
    { // dramatic trance, G harmonic minor: i-iv-VI-V. The major V and its leading tone give
      // tension rather than cheer; the leading tone is only ever sung over that chord.
      root: 49, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 3, 5, 4], cb: 2, bassW: 'sawtooth', bassLen: 1.5, bassCut: 400, arpW: 'sawtooth',
      bass: [-1, -1, 0, -1, -1, -1, 7, -1, -1, -1, 0, -1, -1, -1, 7, -1],
      gate: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      arp: [0, -1, 4, -1, 7, -1, 4, -1, 9, -1, 7, -1, 4, -1, 7, -1],
      mel: [ // Gm: D Eb D Bb | D Eb D G   Cm: Eb G Eb C | Eb G Eb A G   Eb: Bb G Eb G | Bb G Bb G Eb   D: A F# A F# | A F# D F# A
        '11 - - - 12 - 11 - 9 - - - - - - -', '11 - - - 12 - 11 - 14 - - - - - - -',
        '12 - - - 14 - 12 - 10 - - - - - - -', '12 - - - 14 - 12 - 15 - - - 14 - - -',
        '16 - - - 14 - 12 - 14 - - - - - - -', '16 - - - 14 - 16 - 14 - - - 12 - - -',
        '15 - - - 13 - 15 - 13 - - - - - - -', '15 - - - 13 - 11 - 13 - - - 15 - - -'].map(_bar),
      melB: [ // variation: leaping calls that climb through each chord
        '14 - 11 - 14 - - - 11 - - - 9 - - -', '16 - 14 - 11 - - - 9 - 11 - 14 - - -',
        '17 - 14 - 17 - - - 14 - - - 12 - - -', '19 - 17 - 14 - - - 12 - 14 - 17 - - -',
        '16 - 14 - 16 - - - 14 - - - 12 - - -', '19 - 16 - 14 - - - 12 - 14 - 16 - - -',
        '18 - 15 - 18 - - - 15 - - - 13 - - -', '20 - 18 - 15 - - - 13 - 15 - 18 - - -'].map(_bar),
      lift: 2, progB: [0, 5, 3, 4], // second progression: i-VI-iv-V (melP below reorders the bars to match)
      bassB: [-1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 7],
      gateB: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0],
      arpB: [7, 4, 0, 4, 7, 9, 7, 4, 7, 4, 0, 4, 7, 9, 11, 9] },
    { // acid techno, G phrygian: one chord with a flat-second turn, squelching 303 line
      root: 49, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 0, 0, 1], cb: 2, bassW: 'sawtooth', bassLen: 1.4, bassCut: 200, arpW: 'square',
      bass: [-1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1],
      acid: [0, -1, 0, 7, -1, 0, 3, -1, 0, 0, -1, 7, 0, -1, 10, 7],
      acc: [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0], sl: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1],
      gate: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      leadB: [7, -1, -1, 7, -1, -1, 6, -2, -2, -2, -1, -1, -1, -1, -1, -1],
      progB: [0, 0, 3, 1],
      acidB: [0, 0, -1, 3, 0, -1, 7, 5, 0, -1, 3, 0, 10, -1, 7, 3],
      accB: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1], slB: [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0],
      gateB: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
      arpB: [-1, -1, -1, -1, 7, -1, -1, -1, -1, -1, -1, 7, -1, -1, -1, -1],
      leadC: [7, -1, -1, -1, -1, -1, -1, -1, 8, -2, 7, -1, -1, -1, -1, -1],
      leadD: [7, -1, 7, -1, 6, -1, 7, -1, -1, -1, 4, -2, -2, -1, -1, -1] },
    { // dark techno, E minor: rumbling sixteenths, lone stabs into the reverb, slow eerie lead
      root: 41.2, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 6, 0], cb: 2, bassW: 'sawtooth', bassLen: .8, bassCut: 170, arpW: 'triangle',
      bass: [-1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0],
      gate: [0, 0, 0, .6, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      arp: [-1, -1, 7, -1, -1, 7, -1, -1, 9, -1, -1, 7, -1, -1, -1, -1],
      leadW: 'square',
      mel: [ // call (E E D B) and answer (B B G E) over Em, shifted down over the D chord
        '. . 14 . . 14 . 13 . . 11 . . . . .', '. . 14 . . 14 . 13 . . 11 . 9 . 11 .',
        '. . 11 . . 11 . 9 . . 7 . . . . .', '. . 11 . . 11 . 9 . . 7 . 6 . 7 .',
        '. . 13 . . 13 . 11 . . 10 . . . . .', '. . 13 . . 13 . 11 . . 10 . 8 . 10 .',
        '. . 14 . . 14 . 13 . . 11 . . . . .', '. . 11 . . 11 . 9 . . 7 . 6 . 7 .'].map(_bar),
      melB: [ // busier: a sixteenth-note burst, then space
        '14 . 14 13 . 11 . . 14 . 14 13 . 11 9 .', '. . . . . . . . 11 . 9 . 7 . . .',
        '14 . 14 13 . 11 . . 14 . 14 13 . 11 9 .', '. . . . . . . . 11 . 9 . 7 . . .',
        '13 . 13 11 . 10 . . 13 . 13 11 . 10 8 .', '. . . . . . . . 10 . 8 . 6 . . .',
        '14 . 14 13 . 11 . . 14 . 14 13 . 11 9 .', '. . . . . . . . 11 . 9 . 7 . . .'].map(_bar),
      melP: [ // over Em Em Am D
        '. . 14 . . 14 . 13 . . 11 . . . . .', '. . 14 . . 14 . 13 . . 11 . 9 . 11 .',
        '. . 11 . . 11 . 9 . . 7 . . . . .', '. . 11 . . 11 . 9 . . 7 . 6 . 7 .',
        '. . 14 . . 14 . 12 . . 10 . . . . .', '. . 14 . . 14 . 12 . . 10 . 9 . 10 .',
        '. . 13 . . 13 . 11 . . 10 . . . . .', '. . 13 . . 13 . 11 . . 10 . 8 . 10 .'].map(_bar),
      progB: [0, 0, 3, 6],
      bassB: [-1, 0, 0, 0, -1, 0, 0, 3, -1, 0, 0, 0, -1, 0, 5, 3],
      gateB: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, .6, 0, 0],
      arpB: [7, -1, -1, -1, -1, -1, 9, -1, -1, 7, -1, -1, -1, -1, 4, -1] },
    { // uplifting trance, F# minor: VI-VII-i-i, rolling bass, full gate, soaring lead
      root: 46.25, scale: [0, 2, 3, 5, 7, 8, 10], prog: [5, 6, 0, 0], cb: 2, bassW: 'sawtooth', bassLen: .9, bassCut: 380, arpW: 'sawtooth',
      bass: [-1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 7],
      gate: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1],
      arp: [0, 2, 4, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2, 4, 7],
      // A falling four-note figure per chord, all starting from the top of the phrase:
      //   D: F# D C# A (a lush major seventh)   E: G# E B G# (plain triad)   F#m: F# E C# A (minor seventh)
      // The E bars avoid D: E-D-B-G# spells a dominant seventh, which pulls toward A major and
      // out of the key.
      mel: [
        '14 - - 12 - - 11 - 9 - - 11 - - - .', '14 - - 12 - - 11 - 9 - - 12 - - - .',
        '15 - - 13 - - 10 - 8 - - 10 - - - .', '15 - - 13 - - 10 - 15 - - 13 - 11 10 -',
        '14 - - 13 - - 11 - 9 - - 11 - - - .', '14 - - 13 - - 11 - 9 - - 11 - - - .',
        '14 - - 13 - - 11 - 9 - - 11 - - - .', '14 - - 13 - - 11 - 16 - - 14 - 13 11 -'].map(_bar),
      melB: [ // the rising variation, likewise
        '9 - - - 11 - 12 - - - 14 - 12 - - .', '9 - - - 11 - 12 - - - 14 - 12 - - .',
        '10 - - - 11 - 13 - - - 15 - 13 - - .', '10 - - - 11 - 13 - 17 - - 15 - 13 11 -',
        '11 - - - 13 - 14 - - - 16 - 14 - - .', '11 - - - 13 - 14 - - - 16 - 14 - - .',
        '11 - - - 13 - 14 - - - 16 - 14 - - .', '11 - - - 13 - 14 - 18 - - 16 - 14 13 -'].map(_bar),
      melP: [ // over F#m D A E
        '14 - - 13 - - 11 - 9 - - 11 - - - .', '14 - - 13 - - 11 - 16 - - 14 - 13 11 -',
        '14 - - 12 - - 11 - 9 - - 11 - - - .', '14 - - 12 - - 11 - 9 - - 12 - - - .',
        '16 - - 13 - - 11 - 9 - - 11 - - - .', '16 - - 13 - - 11 - 13 - - 11 - - - .',
        '15 - - 13 - - 10 - 8 - - 10 - - - .', '15 - - 13 - - 10 - 15 - - 13 - 11 10 -'].map(_bar),
      lift: 2, progB: [0, 5, 2, 6],
      bassB: [-1, 0, 0, 0, -1, 0, 7, 0, -1, 0, 0, 0, -1, 7, 0, 7],
      gateB: [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
      arpB: [7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2, 0, 2, 4, 7, 4] },
    { // psy / hard trance, G# phrygian dominant: galloping bass, stepwise goa runs
      root: 51.9, scale: [0, 1, 4, 5, 7, 8, 10], prog: [0, 0, 1, 0], cb: 2, bassW: 'square', bassLen: .8, bassCut: 500, arpW: 'sawtooth',
      bass: [-1, -1, 0, 0, -1, 0, 0, 7, -1, -1, 0, 0, -1, 0, 7, 0],
      gate: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
      arp: [0, 1, 2, 4, 2, 1, 0, 1, 4, 5, 4, 2, 1, 2, 0, -1],
      leadA: [7, -2, 8, 7, -1, 5, 4, -2, 7, -2, 8, 9, -2, 8, 7, -2],
      leadB: [11, -2, 9, 8, -2, 7, -1, 5, 7, -2, 8, 7, -2, 5, 4, -2],
      progB: [0, 0, 3, 1],
      bassB: [-1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 7, -1, 0, 7, 0],
      gateB: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      arpB: [7, 5, 4, 2, 4, 5, 7, 8, 7, 5, 4, 2, 1, 2, 4, -1],
      leadC: [4, -2, 5, 4, -1, 2, 1, -2, 4, -2, 5, 7, -2, 5, 4, -2],
      leadD: [7, -2, 8, 9, -2, 11, -1, 9, 8, -2, 7, 5, -2, 4, 2, -2] }
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
    const P4 = Math.floor(bar / 16) % 4, V = P4 % 2 === 1, pat = k => (V && M[k + 'B']) || M[k];
    const lift = M.lift && P4 === 3 ? Math.pow(2, M.lift / 12) : 1;
    this.key = M; this.lift = lift; // sound effects follow the song
    const hz = (d, oct) => M.root * lift * Math.pow(2, oct + (M.scale[((d % n) + n) % n] + 12 * Math.floor(d / n)) / 12);
    const prog = (P4 >= 2 && M.progB) || M.prog, c0 = prog[Math.floor(bar / M.cb) % prog.length], cm = c0 > 4 ? c0 - 7 : c0; // keep chords near the tonic
    const sweep = .5 - .5 * Math.cos((bar % 8 + s / 16) / 8 * Math.PI * 2); // 8-bar filter sweep, 0..1
    const lead = M.mel ? ((P4 >= 2 && M.melP) || (V && M.melB) || M.mel)[bar % 8]
      : V ? (bar % 4 === 3 ? M.leadD : M.leadC) : (bar % 4 === 3 ? M.leadB : M.leadA);
    this.dly.delayTime.setValueAtTime(sd * 3, t);

    // --- drums: four on the floor, clap on 2 and 4, open hat on every off-beat
    if (level > 0) {
      if (s % 4 === 0 && !cut8) this.kick(t, .58);
      if ((s === 4 || s === 12) && !cut8) this.clap(t, .42);
      if (V && s === 15 && bar % 2 === 1 && !build) this.clap(t, .2);                                    // ghost clap in the variation phrases
      if (s % 4 === 2) this.hiss(t, .12, .24, 'highpass', 7000, this.mg);
      else if (s % 4 !== 0) this.hiss(t, .03, s % 4 === 3 ? .13 : .08, 'highpass', 9500, this.mg);
      if ((full || P4 >= 2) && s % 4 === 0) this.hiss(t, .22, .09, 'bandpass', 6500, this.mg);                         // ride
      if (build) {                                                                                       // roll: quarters, eighths, sixteenths
        if (s === 0) this.hiss(t, sd * 16, .25, 'bandpass', 4500, this.duck, sd * 15.5, true);
        if (s === 0 || s === 4 || s === 8 || s === 10 || s >= 12) this.hiss(t, .09, .16 + s * .022, 'bandpass', 1800 + s * 60, this.mg, 0, true);
      } else if (ph === 7 && s >= 13) this.hiss(t, .07, .22, 'bandpass', 1900, this.mg);
      if (ph % 8 === 0 && s === 0 && bar > 0) this.hiss(t, 1.6, .22, 'highpass', 4500, this.mg, 0, true);   // crash on the downbeat
    } else if (s % 4 === 2) this.hiss(t, .03, .07, 'highpass', 9000, this.mg);

    // --- bass
    if (level > 0 && !cut8) {
      const b = pat('bass')[s];
      if (b >= 0) {
        this.voice(M.bassW, hz(cm + b, 1), t, sd * M.bassLen, .26, this.duck, { cut: M.bassCut * (1.6 + 2.4 * sweep) + level * 150, cut2: 160, q: 6 });
        this.voice('sine', hz(cm, 0), t, sd * M.bassLen, .11, this.duck, { a: .006, hold: .4 });
      }
      const a = M.acid ? pat('acid')[s] : -1;
      if (a >= 0) {
        const f = hz(cm + a, 1), acc = pat('acc')[s], sl = pat('sl')[s];
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
      this.gateChord(t, sd, pat('gate'), fr, level ? .06 : .04, level ? 1400 + 3200 * sweep : 500 + 900 * sweep);
    }

    // --- pluck arpeggio
    const arp = pat('arp'), ap = arp ? arp[s] : -1;
    if (ap >= 0 && !cut8)
      this.voice(M.arpW, hz(cm + ap, 3), t, sd * 1.5, full ? .12 : .14, this.duck, { cut: 1100 + 3200 * sweep, cut2: 500, q: 2.5, dly: true, rev: level === 0 });

    // --- lead: three detuned saws, an octave doubled on bosses; short repeating figures
    const L = lead ? lead[s] : -1;
    if (L >= 0 && (full || (level === 0 && bar % 8 >= 4)) && !build) {
      let len = 1; while (s + len < 16 && lead[s + len] === -2) len++;
      const f = M.mel ? hz(L, 2) : hz(cm + L, 3), v = level ? .1 : .06, o = { cut: 1800 + 3500 * sweep, cut2: 900, q: 1.5, hold: .6, dly: true, rev: true };
      for (const det of [-11, 0, 11]) this.voice(M.leadW || 'sawtooth', f, t, sd * (len + .4), v, this.duck, Object.assign({ det }, o));
      if (level > 1) this.voice('square', f * 2, t, sd * (len + .2), .03, this.duck, o);
    }
  }
};
AU.MUS[0].melP = [0, 1, 4, 5, 2, 3, 6, 7].map(i => AU.MUS[0].mel[i]);

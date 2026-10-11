'use strict';
// Procedural audio: every sound is synthesised. Music is a step sequencer driven by
// the game's beat clock, so gameplay that keys off the beat stays in sync with it.
const AU = {
  ctx: null, out: null, nbuf: null, mute: false, last: {},
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = typeof AudioContext !== 'undefined' ? AudioContext : null;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.out = this.ctx.createGain(); this.out.gain.value = 0.5 * META.vol;
      const comp = this.ctx.createDynamicsCompressor();
      this.out.connect(comp); comp.connect(this.ctx.destination);
      const n = this.ctx.sampleRate * 0.5;
      this.nbuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
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
  ROOT: [110, 98, 82.4, 123.5, 92.5],
  SCALE: [0, 3, 5, 7, 10, 12, 15],
  BASS: [[0, 0, 5, 0, 3, 0, 5, 4], [0, 4, 0, 2, 0, 4, 3, 2], [0, 0, 0, 3, 0, 0, 2, 1], [0, 5, 0, 5, 3, 5, 0, 4], [0, 2, 4, 5, 0, 5, 4, 2]],
  // i = sixteenth-note index; level 0 calm, 1 combat, 2 boss
  step(i, stage, level) { // stage = the theme's music index
    if (!this.ctx || this.mute) return;
    const s = i % 16, bar = Math.floor(i / 16), root = this.ROOT[stage % 5];
    const nt = d => root * Math.pow(2, this.SCALE[d % 7] / 12);
    if (s % 4 === 0) this.tone(130, .13, 'sine', .32, 38);
    if (s % 2 === 1 && level > 0) this.noise(.03, .05, 7000, 2);
    if (level > 1 && (s === 4 || s === 12)) this.noise(.12, .14, 1800);
    if (s % 2 === 0) this.tone(nt(this.BASS[stage % 5][(s / 2) | 0]), .16, 'triangle', .16);
    if (level > 0 && (s * 3 + bar) % 4 !== 1) this.tone(nt((s * 3 + bar * 2) % 7) * 4, .07, 'square', .022 + level * .008);
  }
};

'use strict';
const IN = {
  keys: {}, pressed: {}, mx: W / 2, my: H / 2, mb: [false, false, false], mhit: [false, false, false],
  canvas: null, any: false, mouseAim: false, mouseIdle: 0,
  dash: null, tapT: {}, TAP: { KeyW: [0, -1], KeyA: [-1, 0], KeyS: [0, 1], KeyD: [1, 0] },
  padMove: { x: 0, y: 0 }, padAim: { x: 0, y: 0 }, padPrev: [],
  // Twin-stick pad: left stick moves, right stick aims and fires. Buttons are folded into
  // the same key codes the keyboard uses, so the rest of the game needs no pad logic.
  PAD: { 0: ['Enter', 'KeyE'], 1: ['KeyQ'], 2: ['Space'], 3: ['KeyR'], 4: ['Space'], 5: ['KeyQ'], 6: ['Space'], 7: ['KeyQ'], 8: ['KeyX'], 9: ['Escape'], 10: ['Dash'], 12: ['ArrowUp'], 13: ['ArrowDown'], 14: ['ArrowLeft'], 15: ['ArrowRight'] },
  pollPad() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let p = null;
    for (const q of pads) if (q && q.connected) { p = q; break; }
    if (!p) { this.padMove.x = this.padMove.y = this.padAim.x = this.padAim.y = 0; return; }
    this.padMove.x = p.axes[0] || 0; this.padMove.y = p.axes[1] || 0;
    this.padAim.x = p.axes[2] || 0; this.padAim.y = p.axes[3] || 0;
    for (const i in this.PAD) {
      const d = !!(p.buttons[i] && p.buttons[i].pressed);
      if (d && !this.padPrev[i]) { for (const k of this.PAD[i]) this.pressed[k] = true; this.any = true; }
      this.padPrev[i] = d;
    }
  },
  down(k) { return !!this.keys[k]; },
  hit(k) { return !!this.pressed[k]; },
  end() { this.pressed = {}; this.mhit = [false, false, false]; this.any = false; this.dash = null; },
  init(canvas) {
    this.canvas = canvas;
    const block = { Space: 1, Tab: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1 };
    window.addEventListener('keydown', e => {
      if (block[e.code]) e.preventDefault();
      if (!e.repeat) {
        this.pressed[e.code] = true; this.any = true;
        if (this.TAP[e.code]) { // two presses of the same direction in quick succession
          if (e.timeStamp - (this.tapT[e.code] || -1e9) < 260) this.dash = this.TAP[e.code];
          this.tapT[e.code] = e.timeStamp;
        }
      }
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mb = [false, false, false]; });
    const pos = e => {
      const r = this.canvas.getBoundingClientRect();
      this.mx = (e.clientX - r.left) / r.width * W;
      this.my = (e.clientY - r.top) / r.height * H;
      this.mouseAim = true; this.mouseIdle = 0;
    };
    window.addEventListener('mousemove', pos);
    window.addEventListener('mousedown', e => { pos(e); if (e.button < 3) { this.mb[e.button] = true; this.mhit[e.button] = true; } this.any = true; });
    window.addEventListener('mouseup', e => { if (e.button < 3) this.mb[e.button] = false; });
    window.addEventListener('contextmenu', e => e.preventDefault());
  }
};

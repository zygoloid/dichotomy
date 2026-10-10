'use strict';
// Shared helpers. All files are classic scripts sharing one global scope so the
// game runs straight from index.html with no server or build step.
const TAU = Math.PI * 2, W = 1280, H = 720;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const randi = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const chance = p => Math.random() < p;
const hyp = Math.hypot;

function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
const turnTo = (a, b, max) => a + clamp(angDiff(a, b), -max, max);

function wpick(items, wf) {
  let t = 0;
  const ws = items.map(i => { const w = wf(i); t += w; return w; });
  let r = Math.random() * t;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

const _rgba = {};
function rgba(hex, a) {
  let c = _rgba[hex];
  if (!c) {
    let h = hex.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    c = _rgba[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
  }
  return 'rgba(' + c + ',' + a + ')';
}

function polyPath(c, x, y, r, n, rot) {
  c.beginPath();
  if (n < 3) { c.arc(x, y, r, 0, TAU); return; }
  for (let i = 0; i < n; i++) {
    const a = rot + i * TAU / n;
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}

// Circle vs axis-aligned rect {x,y,w,h}. Returns push-out vector + normal, or null.
const _cr = { x: 0, y: 0, nx: 0, ny: 0 };
function circRect(cx, cy, r, o) {
  const nx = clamp(cx, o.x, o.x + o.w), ny = clamp(cy, o.y, o.y + o.h);
  const dx = cx - nx, dy = cy - ny, d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2);
    _cr.nx = dx / d; _cr.ny = dy / d; _cr.x = _cr.nx * (r - d); _cr.y = _cr.ny * (r - d);
    return _cr;
  }
  const l = cx - o.x, rr = o.x + o.w - cx, t = cy - o.y, b = o.y + o.h - cy, m = Math.min(l, rr, t, b);
  _cr.x = _cr.y = _cr.nx = _cr.ny = 0;
  if (m === l) { _cr.nx = -1; _cr.x = -(l + r); }
  else if (m === rr) { _cr.nx = 1; _cr.x = rr + r; }
  else if (m === t) { _cr.ny = -1; _cr.y = -(t + r); }
  else { _cr.ny = 1; _cr.y = b + r; }
  return _cr;
}

function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1);
  return hyp(px - x0 - dx * t, py - y0 - dy * t);
}

// Tiny vector-icon DSL on a 10x10 grid, ops separated by ';':
//   C x,y,r  circle      D x,y,r  dot (filled)     R x,y,r,deg0,deg1  arc
//   L x,y,.. polyline    P x,y,.. closed outline   F x,y,..  filled polygon
//   A x,y,x,y arrow
const _ic = {};
function icon(c, spec, x, y, s, col, lw) {
  let ops = _ic[spec];
  if (!ops) ops = _ic[spec] = spec.split(';').filter(Boolean).map(t => ({ k: t[0], a: t.slice(1).split(',').map(Number) }));
  c.save();
  c.translate(x - s / 2, y - s / 2); c.scale(s / 10, s / 10);
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw || 0.9; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const o of ops) {
    const a = o.a;
    c.beginPath();
    switch (o.k) {
      case 'C': c.arc(a[0], a[1], a[2], 0, TAU); c.stroke(); break;
      case 'D': c.arc(a[0], a[1], a[2], 0, TAU); c.fill(); break;
      case 'R': c.arc(a[0], a[1], a[2], a[3] * Math.PI / 180, a[4] * Math.PI / 180); c.stroke(); break;
      case 'L': case 'P': case 'F':
        for (let i = 0; i < a.length; i += 2) c.lineTo(a[i], a[i + 1]);
        if (o.k !== 'L') c.closePath();
        if (o.k === 'F') c.fill(); else c.stroke();
        break;
      case 'A': {
        c.moveTo(a[0], a[1]); c.lineTo(a[2], a[3]); c.stroke();
        const g = Math.atan2(a[3] - a[1], a[2] - a[0]);
        c.beginPath();
        c.moveTo(a[2] - Math.cos(g - .6) * 2.2, a[3] - Math.sin(g - .6) * 2.2);
        c.lineTo(a[2], a[3]);
        c.lineTo(a[2] - Math.cos(g + .6) * 2.2, a[3] - Math.sin(g + .6) * 2.2);
        c.stroke();
        break;
      }
    }
  }
  c.restore();
}

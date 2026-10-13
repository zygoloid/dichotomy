'use strict';
const BX0 = 70, BY0 = 70, BX1 = W - 70, BY1 = H - 70;
let R = null; // the current run

const ENEMY = {};
function E(type, def) { def.type = type; ENEMY[type] = def; }

const wellF = (w, d) => d < w.r ? Math.max(w.floor || 0, 1 - d / w.r) : 0;
const aimP = e => Math.atan2(R.P.y - e.y, R.P.x - e.x);
const distP = e => hyp(R.P.x - e.x, R.P.y - e.y);

// enemy bullet
function eb(x, y, a, spd, pol, r, o) {
  if (R.bullets.length > 900) return null;
  const v = spd * R.bspd * R.P.stats.bulletSpd;
  const b = { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, pol, r: r || 6, t: 0, gz: false, cv: 0, noEr: false, bn: PAL.haz.bounce || 0 };
  if (o) Object.assign(b, o);
  R.bullets.push(b);
  return b;
}
function ering(e, n, spd, off, pol, r, o) { for (let i = 0; i < n; i++) eb(e.x, e.y, off + i * TAU / n, spd, pol === undefined ? e.pol : pol, r, o); }
function efan(e, n, arc, a, spd, pol, r, o) { for (let i = 0; i < n; i++) eb(e.x, e.y, a + (n > 1 ? (i / (n - 1) - .5) * arc : 0), spd, pol === undefined ? e.pol : pol, r, o); }
// ---- pathfinding: a distance-to-pilot field over a coarse grid, so chasers can thread mazes
const NAV = 40, NC = Math.ceil((BX1 - BX0) / NAV), NQ = Math.ceil((BY1 - BY0) / NAV);
const navCell = (x, y) => clamp(Math.floor((x - BX0) / NAV), 0, NC - 1) + clamp(Math.floor((y - BY0) / NAV), 0, NQ - 1) * NC;
function updateNav() {
  const room = R.room, holes = room.holes.length === 2 ? room.holes : null;
  if (!room.obs.length && !holes) { R.nav = null; return; }
  if (R.nav && R.time - R.navT < .25) return;
  R.navT = R.time;
  if (!room.navB) { // cells too close to a fixed block to stand in
    const b = room.navB = new Uint8Array(NC * NQ);
    for (let q = 0; q < NQ; q++) for (let c = 0; c < NC; c++) {
      const x = BX0 + (c + .5) * NAV, y = BY0 + (q + .5) * NAV;
      for (const o of room.obs) if (!o.mv && x > o.x - 18 && x < o.x + o.w + 18 && y > o.y - 18 && y < o.y + o.h + 18) { b[c + q * NC] = 1; break; }
    }
  }
  const b = room.navB, d = R.nav || (R.nav = new Int16Array(NC * NQ)), queue = [navCell(R.P.x, R.P.y)];
  // Wormholes: walking across a ring means going through it, so the discs are no-go cells.
  // The cells around each ring are its mouth, and the two mouths are joined as a shortcut.
  const hb = R.navHB || (R.navHB = new Uint8Array(NC * NQ)), mouth = R.navMouth = holes ? [[], []] : null, jumped = [false, false];
  hb.fill(0);
  if (holes) for (let k = 0; k < NC * NQ; k++) {
    const x = BX0 + (k % NC + .5) * NAV, y = BY0 + (((k / NC) | 0) + .5) * NAV;
    for (let i = 0; i < 2; i++) { const dd = hyp(x - holes[i].x, y - holes[i].y); if (dd < holes[i].r - 6) hb[k] = 1; else if (dd < holes[i].r + 36 && !b[k]) { hb[k] = 2 + i; mouth[i].push(k); } }
  }
  R.navMouthD = [1e9, 1e9];
  d.fill(-1); d[queue[0]] = 0;
  if (b[queue[0]] || hb[queue[0]] === 1) { // the pilot is hugging a wall: start from the nearest open cells instead
    const pc = queue[0] % NC, pq = (queue[0] / NC) | 0;
    for (let rad = 1; rad <= 3 && queue.length === 1; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const nc = pc + dx, nq = pq + dy, nk = nc + nq * NC;
      if (nc < 0 || nq < 0 || nc >= NC || nq >= NQ || b[nk] || hb[nk] === 1 || d[nk] >= 0) continue;
      d[nk] = rad; queue.push(nk);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i], c = k % NC, q = (k / NC) | 0, m = hb[k] - 2;
    if (m >= 0) {
      R.navMouthD[m] = Math.min(R.navMouthD[m], d[k]);
      if (!jumped[m]) { jumped[m] = true; for (const nk of mouth[1 - m]) if (d[nk] < 0) { d[nk] = d[k] + 4; queue.push(nk); } }
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dx, nq = q + dy, nk = nc + nq * NC;
      if (nc < 0 || nq < 0 || nc >= NC || nq >= NQ || d[nk] >= 0 || b[nk] || hb[nk] === 1) continue;
      d[nk] = d[k] + 1; queue.push(nk);
    }
  }
}
// does a fixed block, or a wormhole ring, lie on the straight line between two points?
function wallBetween(x0, y0, x1, y1) {
  for (const h of R.room.holes) if (segDist(h.x, h.y, x0, y0, x1, y1) < h.r) return true;
  const n = Math.ceil(hyp(x1 - x0, y1 - y0) / 6);
  for (let i = 1; i < n; i++) {
    const x = lerp(x0, x1, i / n), y = lerp(y0, y1, i / n);
    for (const o of R.room.obs) if (!o.mv && x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) return true;
  }
  return false;
}
// where a chaser should head: straight at the pilot if nothing is in the way, else the next cell along
const _np = { x: 0, y: 0 };
function navPoint(e) {
  const P = R.P, b = R.room.navB, hb = R.navHB;
  if (!R.nav || !b) return P;
  const n = Math.ceil(hyp(P.x - e.x, P.y - e.y) / 28);
  let clear = true;
  for (let i = 1; i < n && clear; i++) { const k = navCell(lerp(e.x, P.x, i / n), lerp(e.y, P.y, i / n)); if (b[k] || hb[k] === 1) clear = false; }
  if (clear) return P;
  const k = navCell(e.x, e.y), c = k % NC, q = (k / NC) | 0, m = hb[k] - 2;
  let best = -1, bd = R.nav[k] < 0 ? 1e9 : R.nav[k];
  if (m >= 0 && R.navMouthD[1 - m] + 4 <= bd && R.navMouthD[1 - m] < R.navMouthD[m]) return R.room.holes[m]; // the far end is nearer the pilot: go in
  if (hb[k] === 1) { // already at a ring's edge: finish going in if that is the way, rather than dithering on the brink
    const hs = R.room.holes, i = hyp(e.x - hs[0].x, e.y - hs[0].y) < hyp(e.x - hs[1].x, e.y - hs[1].y) ? 0 : 1;
    if (R.navMouthD[1 - i] < R.navMouthD[i]) return hs[i];
  }
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nc = c + dx, nq = q + dy, nk = nc + nq * NC;
    if (nc < 0 || nq < 0 || nc >= NC || nq >= NQ || R.nav[nk] < 0 || R.nav[nk] >= bd) continue;
    bd = R.nav[nk]; best = nk;
  }
  if (best < 0 && R.nav[k] < 0) { // wedged somewhere off the map of open cells: make for the nearest one
    let bs = 1e9;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const nc = c + dx, nq = q + dy, nk = nc + nq * NC;
      if (nc < 0 || nq < 0 || nc >= NC || nq >= NQ || R.nav[nk] < 0) continue;
      if (wallBetween(e.x, e.y, BX0 + (nc + .5) * NAV, BY0 + (nq + .5) * NAV)) continue; // not one on the far side of a wall
      const sc = Math.abs(dx) + Math.abs(dy) + R.nav[nk] * .01;
      if (sc < bs) { bs = sc; best = nk; }
    }
  }
  if (best < 0 && R.nav[k] < 0) for (const h of R.room.holes) { // squeezed between a ring and a wall: slide round the ring
    const dx = e.x - h.x, dy = e.y - h.y, d = hyp(dx, dy);
    if (d > h.r + 70 || d < 1) continue;
    const sgn = (P.x - e.x) * -dy + (P.y - e.y) * dx >= 0 ? 1 : -1;
    _np.x = e.x + (-dy / d * sgn * 50 + dx / d * 12); _np.y = e.y + (dx / d * sgn * 50 + dy / d * 12);
    return _np;
  }
  if (best < 0) return P;
  _np.x = BX0 + (best % NC + .5) * NAV; _np.y = BY0 + (((best / NC) | 0) + .5) * NAV;
  return _np;
}

function moveTo(e, tx, ty, spd, dt, k) {
  if (tx === R.P.x && ty === R.P.y && R.nav) { // following a path round walls: hurry, so nobody waits on a slow walker
    const p = navPoint(e);
    if (p !== R.P) { tx = p.x; ty = p.y; spd = Math.max(spd * 2, 130); k = 6; }
  }
  const a = Math.atan2(ty - e.y, tx - e.x), d = hyp(tx - e.x, ty - e.y), s = Math.min(spd, d * 3), f = Math.min(1, (k || 3) * dt);
  e.vx = lerp(e.vx, Math.cos(a) * s, f); e.vy = lerp(e.vy, Math.sin(a) * s, f);
}
function rayLen(x, y, a) {
  const c = Math.cos(a), s = Math.sin(a); let t = 1e9;
  if (c > 1e-6) t = Math.min(t, (BX1 - x) / c); else if (c < -1e-6) t = Math.min(t, (BX0 - x) / c);
  if (s > 1e-6) t = Math.min(t, (BY1 - y) / s); else if (s < -1e-6) t = Math.min(t, (BY0 - y) / s);
  return Math.max(0, t);
}
// true on each new beat
function onBeat(e) { const b = Math.floor(R.beat); if (b !== e.lb) { e.lb = b; return true; } return false; }
function bulletWall(pol, split, fromBottom) {
  for (let x = BX0 + 24, i = 0; x < BX1 - 10; x += 38, i++) {
    const p = split ? ((x < W / 2) ? pol : pol ^ 1) : pol;
    eb(x, fromBottom ? BY1 - 8 : BY0 + 8, fromBottom ? -Math.PI / 2 : Math.PI / 2, 135, p, 7);
  }
}

// ---------------------------------------------------------------- regular enemies
E('drifter', {
  hp: 30, r: 16, sides: 4, cost: 1, min: 0,
  init(e) { e.cd = rand(.8, 2); },
  ai(e, dt) {
    moveTo(e, R.P.x, R.P.y, 65, dt); e.rot += dt;
    if ((e.cd -= dt) <= 0) { e.cd = rand(1.3, 2); efan(e, R.stage >= 2 ? 3 : 1, .4, aimP(e), 190); }
  }
});
E('spinner', {
  hp: 40, r: 17, sides: 3, cost: 2, min: 0,
  init(e) { e.cd = rand(.5, 1.5); e.va = rand(TAU); e.sa = rand(TAU); e.dir = chance(.5) ? 1 : -1; },
  ai(e, dt) {
    e.vx = Math.cos(e.va) * 45; e.vy = Math.sin(e.va) * 45;
    if (e.x < BX0 + 40 || e.x > BX1 - 40 || e.y < BY0 + 40 || e.y > BY1 - 40) e.va = Math.atan2(H / 2 - e.y, W / 2 - e.x) + rand(-.6, .6);
    if (e.t % 3.2 < 1.7 && (e.cd -= dt) <= 0) { e.cd = .17; ering(e, 3, 150, e.sa); e.sa += .21 * e.dir; }
    e.rot = e.sa;
  }
});
E('swarm', {
  hp: 9, r: 9, sides: 3, cost: 1, min: 0, group: 4,
  ai(e, dt) {
    // weave when the pilot is in sight; fly straight and turn sharply when following a path round walls
    const np = navPoint(e), direct = np === R.P, a = Math.atan2(np.y - e.y, np.x - e.x) + Math.sin(e.t * 4 + e.id) * (direct ? .9 : .2), k = (direct ? 2 : 6) * dt;
    e.vx = lerp(e.vx, Math.cos(a) * 175, k); e.vy = lerp(e.vy, Math.sin(a) * 175, k);
    e.rot = Math.atan2(e.vy, e.vx);
  }
});
E('charger', {
  hp: 45, r: 17, sides: 3, cost: 2, min: 0, arrow: true,
  init(e) { e.cd = rand(.8, 1.6); e.st = 0; },
  ai(e, dt) {
    e.cd -= dt;
    if (e.st === 0) {
      moveTo(e, R.P.x, R.P.y, 50, dt); e.rot = turnTo(e.rot, aimP(e), 4 * dt);
      if (e.cd <= 0) { e.st = 1; e.cd = .55; }
    } else if (e.st === 1) {
      e.vx *= .8; e.vy *= .8; if (e.cd > .2) e.rot = aimP(e); e.warn = e.rot;
      if (e.cd <= 0) { e.st = 2; e.cd = .5; e.warn = null; }
    } else {
      e.vx = Math.cos(e.rot) * 640; e.vy = Math.sin(e.rot) * 640;
      const wall = (e.vx < 0 && e.x <= BX0 + e.r + 2) || (e.vx > 0 && e.x >= BX1 - e.r - 2) || (e.vy < 0 && e.y <= BY0 + e.r + 2) || (e.vy > 0 && e.y >= BY1 - e.r - 2); // one it is flying into
      if (e.cd <= 0 || wall) { e.st = 0; e.cd = rand(1, 1.8); e.vx = e.vy = 0; ering(e, 8, 160, rand(TAU)); }
    }
  }
});
E('burster', {
  hp: 55, r: 19, sides: 5, cost: 2, min: 1,
  init(e) { e.cd = rand(1, 2.4); e.q = 0; },
  ai(e, dt) {
    moveTo(e, R.P.x, R.P.y, 35, dt); e.rot -= dt * .7;
    if ((e.cd -= dt) <= 0) {
      ering(e, 12, 150, e.rot + e.q * TAU / 24);
      if (e.q) { e.q = 0; e.cd = 2.4; } else { e.q = 1; e.cd = .28; }
    }
  }
});
E('sniper', {
  hp: 35, r: 15, sides: 4, cost: 2, min: 1, unlock: 'en:sniper', thin: true,
  init(e) { e.cd = rand(1.5, 2.8); e.q = 0; e.sd = chance(.5) ? 1 : -1; },
  ai(e, dt) {
    const a = aimP(e), d = distP(e);
    if (e.q > 0 || e.warn != null) { e.vx *= .85; e.vy *= .85; }
    else if (d < 300) moveTo(e, e.x - Math.cos(a) * 100, e.y - Math.sin(a) * 100, 130, dt);
    else moveTo(e, e.x - Math.sin(a) * 100 * e.sd, e.y + Math.cos(a) * 100 * e.sd, 70, dt);
    e.cd -= dt;
    if (e.q > 0) { if (e.cd <= 0) { e.cd = .08; e.q--; eb(e.x, e.y, e.rot, 400, e.pol, 5); if (!e.q) e.cd = rand(2.2, 3); } }
    else if (e.warn != null) { if (e.cd <= 0) { e.warn = null; e.q = 4; } }
    else { e.rot = a; if (e.cd <= 0) { e.warn = a; e.cd = .7; } }
  }
});
E('turret', {
  hp: 70, r: 18, sides: 8, cost: 3, min: 1, cross: true,
  init(e) { e.beams = [{ ang: rand(TAU), pol: e.pol, state: 'off' }]; e.cd = rand(.5, 1.5); e.dir = chance(.5) ? 1 : -1; e.st = 0; },
  ai(e, dt) {
    const b = e.beams[0]; b.pol = e.pol; e.vx = e.vy = 0;
    if ((e.cd -= dt) <= 0) { e.st = (e.st + 1) % 3; b.state = ['off', 'warn', 'on'][e.st]; e.cd = [1.4, .9, 2.6][e.st]; if (e.st === 2) AU.sfx('beam'); }
    if (e.st) b.ang += .45 * e.dir * dt * (e.st === 1 ? .3 : 1);
    e.rot = b.ang;
  }
});
E('splitter', {
  hp: 80, r: 23, sides: 6, cost: 3, min: 1, unlock: 'en:splitter',
  init(e) { e.cd = rand(1, 1.8); },
  ai(e, dt) {
    moveTo(e, R.P.x, R.P.y, e.mini ? 95 : 55, dt); e.rot += dt * .8;
    if ((e.cd -= dt) <= 0) { e.cd = e.mini ? 2.2 : 1.8; efan(e, 2, .3, aimP(e), 180); }
  },
  death(e) {
    if (e.mini) return;
    for (let k = 0; k < 2; k++) {
      const m = makeEnemy('splitter', e.x + (k ? 16 : -16), e.y, k);
      m.mini = true; m.r = 13; m.hp = m.maxHp = e.maxHp * .4; m.spawn = .25;
    }
  }
});
E('weaver', {
  hp: 75, r: 19, sides: 8, cost: 3, min: 2, unlock: 'en:weaver',
  init(e) { e.cd = rand(.6, 1.4); e.fp = 0; },
  ai(e, dt) {
    moveTo(e, W / 2 + Math.cos(e.t * .6 + e.id) * 380, H / 2 + Math.sin(e.t * .9 + e.id * 2) * 200, 140, dt); e.rot += dt * 2;
    if ((e.cd -= dt) <= 0) { e.cd = 1.1; e.fp ^= 1; efan(e, 5, .9, aimP(e), 170, e.fp); }
  }
});
E('flipper', {
  hp: 65, r: 18, sides: 0, cost: 3, min: 2, unlock: 'en:flipper', half: true,
  init(e) { e.cd = 2.6; e.c2 = 1.3; },
  ai(e, dt) {
    moveTo(e, R.P.x, R.P.y, 45, dt); e.rot += dt * 1.5;
    if ((e.cd -= dt) <= 0) { e.cd = 2.6; e.pol ^= 1; ering(e, 10, 150, rand(TAU)); fxRing(e.x, e.y, .02, 300, .4); }
    if ((e.c2 -= dt) <= 0) { e.c2 = 1.3; eb(e.x, e.y, aimP(e), 210, e.pol); }
  }
});

// lobs a fat shell that bursts into a ring of the *other* colour; absorb the shell to defuse it
E('bomber', {
  hp: 50, r: 18, sides: 7, cost: 2, min: 1, unlock: 'en:bomber',
  init(e) { e.cd = rand(1, 2.5); },
  ai(e, dt) {
    moveTo(e, R.P.x, R.P.y, distP(e) > 320 ? 60 : 0, dt); e.rot += dt * .6;
    if ((e.cd -= dt) <= 0) { e.cd = 2.8; eb(e.x, e.y, aimP(e), 120, e.pol, 11, { fuse: clamp(distP(e) / 130, .8, 2.2) }); }
  }
});
// only the opposite colour hurts it; its own colour bounces back at you as bullets
E('mirror', {
  hp: 60, r: 18, sides: 4, cost: 2, min: 1, unlock: 'en:mirror', mirror: true,
  init(e) { e.cd = rand(1, 2); e.sd = chance(.5) ? 1 : -1; },
  ai(e, dt) {
    const a = aimP(e);
    moveTo(e, R.P.x - Math.cos(a + e.sd * .9) * 260, R.P.y - Math.sin(a + e.sd * .9) * 260, 90, dt); e.rot = a + Math.PI / 4;
    if ((e.cd -= dt) <= 0) { e.cd = 1.9; efan(e, 2, .25, a, 170); }
  }
});

// ---------------------------------------------------------------- mini-bosses
// splits twice; extra = health of the heads it has yet to grow, for the health bar
E('hydra', {
  hp: 300, r: 40, sides: 6, mb: true,
  init(e) { e.cd = 1; e.gen = 0; e.extra = e.maxHp * 1.44; },
  ai(e, dt) {
    moveTo(e, R.P.x, R.P.y, 50 + e.gen * 35, dt); e.rot += dt * (.6 + e.gen * .5);
    if ((e.cd -= dt) <= 0) { e.cd = 1.3 - e.gen * .2; efan(e, 5 - e.gen, .9, aimP(e), 170 + e.gen * 20); }
  },
  death(e) {
    if (e.gen >= 2) return;
    for (let k = 0; k < 2; k++) {
      const m = makeEnemy('hydra', e.x + (k ? 20 : -20), e.y, k, .3);
      m.gen = e.gen + 1; m.r = e.r * .7; m.hp = m.maxHp = e.maxHp * .4; m.extra = m.gen < 2 ? m.maxHp * .8 : 0;
    }
  }
});
// wall-to-wall dashes that leave a curtain of bullets, swapping colour at every impact
E('lancer', {
  hp: 520, r: 28, sides: 3, mb: true, arrow: true,
  init(e) { e.st = 0; e.cd = 1.2; e.q = 0; },
  ai(e, dt) {
    e.cd -= dt;
    if (e.st === 0) {
      e.vx *= .85; e.vy *= .85;
      if (e.cd > .25) e.rot = turnTo(e.rot, aimP(e), 6 * dt);
      e.warn = e.rot;
      if (e.cd <= 0) { e.st = 1; e.warn = null; e.cd = 1.2; }
    } else {
      e.vx = Math.cos(e.rot) * 720; e.vy = Math.sin(e.rot) * 720;
      if ((e.q -= dt) <= 0) { e.q = .045; eb(e.x, e.y, e.rot + Math.PI / 2, 35, e.pol); eb(e.x, e.y, e.rot - Math.PI / 2, 35, e.pol); }
      // only a wall it is flying into stops it: each dash starts from the wall the last one ended on
      const wall = (e.vx < 0 && e.x <= BX0 + e.r + 2) || (e.vx > 0 && e.x >= BX1 - e.r - 2) || (e.vy < 0 && e.y <= BY0 + e.r + 2) || (e.vy > 0 && e.y >= BY1 - e.r - 2);
      if (e.cd <= 0 || wall) { e.st = 0; e.cd = e.hp < e.maxHp * .5 ? .6 : .95; e.vx = e.vy = 0; ering(e, 16, 170, rand(TAU)); e.pol ^= 1; fxShake(6); }
    }
  }
});
// three rotating beams of alternating colour around a fixed hub
E('carousel', {
  hp: 600, r: 32, sides: 8, mb: true, cross: true,
  init(e) { e.beams = [0, 1, 2].map(k => ({ ang: k * TAU / 3, pol: k & 1, state: 'off' })); e.st = 0; e.cd = 1; e.c2 = 1.5; e.dir = 1; e.q = 0; },
  ai(e, dt) {
    moveTo(e, W / 2, H / 2, 60, dt, 2);
    if ((e.cd -= dt) <= 0) {
      e.st = (e.st + 1) % 3; e.cd = [1.2, 1.2, 5][e.st];
      if (e.st === 1) { e.dir = -e.dir; for (const b of e.beams) b.pol ^= 1; }
      if (e.st === 2) AU.sfx('beam');
    }
    for (const b of e.beams) { b.state = ['off', 'warn', 'on'][e.st]; b.ang += e.dir * .55 * dt * (e.st === 2 ? 1 : .2); }
    e.rot = e.beams[0].ang;
    if ((e.c2 -= dt) <= 0) { e.c2 = 1.5; e.q ^= 1; ering(e, 12, 140, e.rot, e.q); }
  }
});

// ---------------------------------------------------------------- bosses
E('mono', {
  hp: 1300, r: 52, sides: 4, boss: true,
  init(e) { e.pat = 0; e.pt = 0; e.cd = 0; e.sa = 0; e.q = 0; },
  ai(e, dt) {
    const hard = e.hp < e.maxHp * .5;
    moveTo(e, W / 2 + Math.sin(e.t * .4) * 260 * (hard ? 1 : .4), H / 2 - 60 + Math.cos(e.t * .55) * 90, 70, dt, 1.5);
    e.rot += dt * (hard ? 1.1 : .5);
    if ((e.pt += dt) > 6) { e.pt = 0; e.pat = (e.pat + 1) % 3; e.pol ^= 1; fxRing(e.x, e.y, .04, 500, .5); }
    if (e.pt < 1) return;
    if ((e.cd -= dt * (hard ? 1.3 : 1)) > 0) return;
    if (e.pat === 0) { e.cd = .13; e.sa += .19; for (let k = 0; k < 4; k++) eb(e.x, e.y, e.sa + k * TAU / 4, 165, k & 1); }
    else if (e.pat === 1) { e.cd = .55; e.q ^= 1; efan(e, hard ? 9 : 7, 1.5, aimP(e), 200, e.q); }
    else { e.cd = .75; e.q ^= 1; ering(e, hard ? 22 : 16, 150, e.q * .14 + e.t, e.q); }
  }
});
E('gem', {
  hp: 900, r: 36, sides: 3, boss: true,
  init(e) { e.pat = 0; e.pt = 0; e.cd = 1; e.sa = 0; e.q = 0; },
  ai(e, dt) {
    const solo = !R.enemies.some(o => o !== e && o.type === 'gem' && !o.dead);
    const a = R.time * (solo ? 1.1 : .7) + e.k * Math.PI, rad = 200 + Math.sin(R.time * .5) * 70;
    moveTo(e, W / 2 + Math.cos(a) * rad * 1.5, H / 2 + Math.sin(a) * rad * .75, 400, dt, 4);
    e.rot = aimP(e);
    if ((e.pt += dt) > 5) { e.pt = 0; e.pat = (e.pat + 1) % 3; }
    if ((e.cd -= dt * (solo ? 1.5 : 1)) > 0) return;
    const pol = solo ? (e.q ^= 1) : e.pol;
    if (e.pat === 0) { e.cd = .5; efan(e, 5, .8, aimP(e), 210, pol); }
    else if (e.pat === 1) { e.cd = .12; e.sa += .3 * (e.k ? 1 : -1); eb(e.x, e.y, e.sa, 170, pol); eb(e.x, e.y, e.sa + Math.PI, 170, pol); }
    else { e.cd = .9; ering(e, 14, 140, rand(TAU), pol); }
  }
});
E('sing', {
  hp: 3000, r: 44, sides: 0, boss: true, hole: true,
  init(e) { e.pat = 0; e.pt = 0; e.cd = 1; e.c2 = 1; e.sa = 0; e.q = 0; e.well = { str: 120, r: 1300, core: 0, floor: .4, bcore: 26, vis: 100 }; },
  ai(e, dt) {
    const hard = e.hp < e.maxHp * .4;
    moveTo(e, W / 2 + Math.sin(e.t * .3) * 200, H / 2 + Math.cos(e.t * .4) * 80, 40, dt, 1);
    e.rot += dt;
    if ((e.pt += dt) > 7) { e.pt = 0; e.pat = (e.pat + 1) % 3; }
    e.well.str = lerp(e.well.str, e.pat === 2 ? 240 : 120, dt * 2);
    // accretion: bullets appear at the rim of the room and spiral in past anyone hiding out there
    if ((e.c2 -= dt * (hard ? 1.4 : 1)) <= 0) {
      e.c2 = e.pat === 1 ? .22 : .5; e.q ^= 1;
      const a = rand(TAU), dir = e.q ? 1 : -1;
      eb(W / 2 + Math.cos(a) * 545, H / 2 + Math.sin(a) * 275, a + Math.PI / 2 * dir + .5 * dir, 120, e.q, 7);
    }
    if ((e.cd -= dt * (hard ? 1.35 : 1)) > 0) return;
    if (e.pat === 0) { e.cd = .22; e.sa += .35; for (let k = 0; k < 3; k++) eb(e.x, e.y, e.sa + k * TAU / 3, 150, (k + Math.floor(e.t)) & 1, 6, { cv: .5, free: true }); }
    else if (e.pat === 1) { e.cd = 1.3; ering(e, 20, 150, rand(TAU), e.q, 6, { free: true }); }
    else { e.cd = .45; efan(e, 5, .9, aimP(e), 250, chance(.5) ? 1 : 0, 6, { free: true }); }
  }
});
E('metro', {
  hp: 4200, r: 46, sides: 4, boss: true, thin: true,
  init(e) { e.pat = 0; e.pt = 0; e.q = 0; e.lb = -1; e.beams = [{ ang: 1, pol: 0, state: 'off' }, { ang: 2, pol: 1, state: 'off' }]; },
  ai(e, dt) {
    const hard = e.hp < e.maxHp * .5;
    moveTo(e, W / 2 + Math.sin(e.t * .5) * 300, 170, 90, dt, 1.5);
    const sw = Math.sin(R.beat * Math.PI / 8) * 1.1;
    e.beams[0].ang = Math.PI / 2 + sw; e.beams[1].ang = Math.PI / 2 - sw; e.rot = Math.PI / 2 + sw * .5;
    if ((e.pt += dt) > 9) { e.pt = 0; e.pat = (e.pat + 1) % 3; }
    const bs = e.pat !== 1 ? 'off' : e.pt < 1.5 ? 'warn' : 'on';
    if (bs === 'on' && e.beams[0].state !== 'on') AU.sfx('beam');
    e.beams[0].state = e.beams[1].state = bs;
    if (!onBeat(e) || e.pt < .8) return;
    if (e.pat === 0) { if (e.lb % 2 === 0) { e.q ^= 1; bulletWall(e.q, hard && chance(.6)); } }
    else if (e.pat === 1) efan(e, hard ? 5 : 3, .7, aimP(e), 190, (e.q ^= 1));
    else { e.q ^= 1; ering(e, hard ? 24 : 18, 170, e.lb * .2, e.q); }
  }
});
E('eclipse', {
  hp: 7000, r: 54, sides: 6, boss: true,
  init(e) {
    e.pt = 0; e.cd = 1; e.c2 = 2; e.sa = 0; e.q = 0; e.lb = -1; e.pf = 0;
    e.beams = [{ ang: 0, pol: 0, state: 'off' }, { ang: Math.PI, pol: 1, state: 'off' }];
    e.well = { str: 0, r: 420, core: 0 };
  },
  ai(e, dt) {
    const f = e.hp / e.maxHp, ph = f > .66 ? 0 : f > .33 ? 1 : 2;
    moveTo(e, W / 2 + Math.sin(e.t * .35) * 220, H / 2 + Math.cos(e.t * .5) * 100, 60, dt, 1.2);
    e.rot += dt * (.4 + ph * .3);
    if ((e.pf += dt) > 5) { e.pf = 0; e.pol ^= 1; fxRing(e.x, e.y, .04, 500, .5); }
    if (ph !== e.ph) { e.ph = ph; e.pt = 0; fxRing(e.x, e.y, .09, 700, .9); fxShake(14); R.bullets.length = 0; }
    e.pt += dt;
    e.well.str = lerp(e.well.str, ph === 1 ? 150 : 0, dt * 2);
    const bs = ph !== 1 ? 'off' : e.pt < 1.6 ? 'warn' : 'on';
    e.beams[0].state = e.beams[1].state = bs;
    e.beams[0].ang += dt * .45; e.beams[1].ang = e.beams[0].ang + Math.PI;
    R.flipRule = ph === 2;
    const beat = onBeat(e);
    if (e.pt < 1) return;
    e.cd -= dt; e.c2 -= dt;
    if (ph === 0) {
      if (e.cd <= 0) { e.cd = .13; e.sa += .17; for (let k = 0; k < 4; k++) eb(e.x, e.y, e.sa + k * TAU / 4, 165, k & 1); }
      if (e.c2 <= 0) { e.c2 = 1.2; e.q ^= 1; efan(e, 5, .8, aimP(e), 220, e.q); }
    } else if (ph === 1) {
      if (e.cd <= 0) { e.cd = 1.1; e.q ^= 1; ering(e, 20, 120, rand(TAU), e.q, 6, { cv: e.q ? -.4 : .4 }); }
    } else {
      if (beat && e.lb % 4 === 0) { e.q ^= 1; bulletWall(e.q, true, (e.lb / 4) & 1); }
      if (e.cd <= 0) { e.cd = .16; e.sa -= .23; eb(e.x, e.y, e.sa, 170, 0); eb(e.x, e.y, e.sa + Math.PI, 170, 1); }
    }
  }
});

// --- alternate-floor and final bosses
// swings the room's current around while it fires, so every pattern arrives skewed
E('tide', {
  hp: 1300, r: 50, sides: 5, boss: true,
  init(e) { e.pat = 0; e.pt = 0; e.cd = 1; e.sa = 0; e.q = 0; e.fa = 0; },
  ai(e, dt) {
    const hard = e.hp < e.maxHp * .5;
    moveTo(e, W / 2 + Math.sin(e.t * .5) * 300, H / 2 - 60 + Math.cos(e.t * .7) * 80, 80, dt, 1.5); e.rot -= dt * .7;
    e.fa += dt * (hard ? .5 : .28); R.room.flow = { ang: e.fa, fixed: true };
    if ((e.pt += dt) > 6) { e.pt = 0; e.pat = (e.pat + 1) % 3; e.pol ^= 1; fxRing(e.x, e.y, .04, 500, .5); }
    if (e.pt < 1 || (e.cd -= dt * (hard ? 1.3 : 1)) > 0) return;
    if (e.pat === 0) { e.cd = .7; e.q ^= 1; efan(e, 9, 2.6, aimP(e), 150, e.q); }
    else if (e.pat === 1) { e.cd = .1; e.sa += .23; eb(e.x, e.y, e.sa, 160, 0); eb(e.x, e.y, e.sa + Math.PI, 160, 1); }
    else { e.cd = .8; e.q ^= 1; ering(e, 14, 140, e.t, e.q); }
  }
});
// six-fold symmetric patterns in a room where everything ricochets
E('kalei', {
  hp: 1900, r: 46, sides: 6, boss: true,
  init(e) { e.pat = 0; e.pt = 0; e.cd = 1; e.q = 0; e.la = 0; },
  ai(e, dt) {
    const hard = e.hp < e.maxHp * .5;
    moveTo(e, W / 2 + Math.sin(e.t * .3) * 120, H / 2 + Math.cos(e.t * .4) * 60, 50, dt, 1); e.rot += dt * .4;
    if ((e.pt += dt) > 6) { e.pt = 0; e.pat = (e.pat + 1) % 3; e.pol ^= 1; fxRing(e.x, e.y, .04, 500, .5); }
    if (e.pt < 1 || (e.cd -= dt * (hard ? 1.3 : 1)) > 0) return;
    if (e.pat === 0) { e.cd = .45; e.q ^= 1; for (let k = 0; k < 6; k++) eb(e.x, e.y, e.rot + k * TAU / 6, 175, (k + e.q) & 1, 6, hard ? { bn: 2 } : null); }
    else if (e.pat === 1) { e.cd = .9; e.q ^= 1; ering(e, 10, 130, e.rot * 2, e.q, 9); }
    else { e.cd = .12; e.la = turnTo(e.la, aimP(e), .09); for (let k = 0; k < 4; k++) eb(e.x, e.y, e.la + k * Math.PI / 2, 250, k & 1, 5); }
  }
});
// a rotating line through the boss splits the room in two; bullets take the colour of their half
E('binary', {
  hp: 3000, r: 44, sides: 0, boss: true, half: true,
  init(e) { e.pat = 0; e.pt = 0; e.cd = 1; e.sa = 0; e.la = 0; e.ld = 1; },
  ai(e, dt) {
    const hard = e.hp < e.maxHp * .4;
    moveTo(e, W / 2 + Math.sin(e.t * .3) * 160, H / 2 + Math.cos(e.t * .45) * 70, 50, dt, 1);
    e.la += e.ld * dt * (hard ? .6 : .38); e.rot = e.la; R.line = { x: e.x, y: e.y, ang: e.la };
    if ((e.pt += dt) > 6) { e.pt = 0; e.pat = (e.pat + 1) % 3; e.ld = -e.ld; e.pol ^= 1; fxRing(e.x, e.y, .04, 500, .5); }
    if (e.pt < 1 || (e.cd -= dt * (hard ? 1.3 : 1)) > 0) return;
    if (e.pat === 0) { e.cd = .8; ering(e, 22, 140, rand(TAU)); }
    else if (e.pat === 1) { e.cd = .09; e.sa += .2; for (let k = 0; k < 3; k++) eb(e.x, e.y, e.sa + k * TAU / 3, 165, 0); }
    else { e.cd = .45; efan(e, 7, 1.1, aimP(e), 230, randi(0, 1), 6, { fix: true }); } // these keep their own colour
  }
});
// final boss: one phase per trick the alternate floors taught, then the colour-swap rule on top
E('crown', {
  hp: 9000, r: 56, sides: 8, boss: true,
  init(e) {
    e.pt = 0; e.cd = 1; e.c2 = 2; e.sa = 0; e.s2 = 0; e.q = 0; e.lb = -1; e.la = 0; e.fa = 0;
    e.beams = [{ ang: 0, pol: 0, state: 'off' }, { ang: Math.PI, pol: 1, state: 'off' }];
  },
  ai(e, dt) {
    const f = e.hp / e.maxHp, ph = f > .66 ? 0 : f > .33 ? 1 : 2;
    moveTo(e, W / 2 + Math.sin(e.t * .35) * 200, H / 2 - 40 + Math.cos(e.t * .5) * 90, 60, dt, 1.2); e.rot += dt * (.4 + ph * .3);
    if (ph !== e.ph) { e.ph = ph; e.pt = 0; e.pol ^= 1; fxRing(e.x, e.y, .09, 700, .9); fxShake(14); R.bullets.length = 0; R.line = null; R.room.flow = null; }
    e.pt += dt;
    const beat = onBeat(e), sw = Math.sin(R.beat * Math.PI / 8) * .6;
    R.flipRule = ph === 2;
    e.s2 += dt * .4; e.beams[0].ang = e.s2 + sw; e.beams[1].ang = e.s2 + Math.PI - sw;
    e.beams[0].state = e.beams[1].state = ph !== 2 ? 'off' : e.pt < 1.6 ? 'warn' : 'on';
    if (e.pt < 1) return;
    e.cd -= dt; e.c2 -= dt;
    if (ph === 0) {
      e.la += dt * .45; R.line = { x: e.x, y: e.y, ang: e.la };
      if (e.cd <= 0) { e.cd = .7; ering(e, 20, 145, rand(TAU)); }
      if (e.c2 <= 0) { e.c2 = 1.6; efan(e, 5, .8, aimP(e), 230, randi(0, 1), 6, { fix: true }); }
    } else if (ph === 1) {
      e.fa += dt * .6; R.room.flow = { ang: e.fa, fixed: true };
      if (beat && e.lb % 2 === 0) { e.q ^= 1; bulletWall(e.q, true, (e.lb / 2) & 1); }
      if (e.cd <= 0) { e.cd = .5; efan(e, 3, .5, aimP(e), 210, e.q); }
    } else if (e.cd <= 0) { e.cd = .14; e.sa += .21; for (let k = 0; k < 4; k++) eb(e.x, e.y, e.sa + k * TAU / 4, 170, k & 1); }
  }
});

// ---------------------------------------------------------------- lifecycle
function makeEnemy(type, x, y, pol, spawnT) {
  const def = ENEMY[type];
  const hp = def.hp * (def.boss ? 1 + .25 * R.asc : R.hpMul * (def.mb ? 1 + .15 * R.asc : 1));
  const e = {
    type, def, x, y, vx: 0, vy: 0, r: def.r, hp, maxHp: hp, pol, t: 0, cd: 1, rot: rand(TAU), id: R.eid++,
    spawn: spawnT === undefined ? .9 : spawnT, fl: 0, burn: 0, burnDps: 0, slowT: 0, slowF: 1, boss: !!(def.boss || def.mb), dead: false, warn: null
  };
  if (def.init) def.init(e);
  R.enemies.push(e);
  return e;
}

function damageEnemy(e, d, crit) {
  if (e.dead || e.spawn > 0 || d <= 0) return;
  e.hp -= d; e.fl = .08;
  if (crit) fxParts(e.x, e.y, '#ffffff', 4, 220);
  if (e.hp <= 0) killEnemy(e);
}

function swarmDarts(e) {
  const P = R.P;
  for (let i = 0; i < 3 * P.stats.swarm + P.stats.swarmN; i++)
    spawnShot(e.x, e.y, rand(TAU), { dmg: shotDmg() * .5, pol: P.pol, hom: 6, spd: 420, life: 1.4, size: .8, split: 0, frag: 0, proj: true, kid: true });
}

function killEnemy(e) {
  const P = R.P;
  e.dead = true;
  if (e.def.death) e.def.death(e);
  R.st.kills++; mAdd('kills');
  // Ikaruga chain: three same-polarity kills in a row extend the chain
  if (P.seqN > 0 && e.pol !== P.seqPol) { P.chain = 0; P.seqN = 0; }
  P.seqPol = e.pol; P.seqN++;
  if (P.seqN === 3) { P.seqN = 0; P.chain++; mMax('chain', P.chain); AU.sfx('pick'); }
  swarmDarts(e);
  const col = PAL.pc[e.pol];
  fxParts(e.x, e.y, col, e.boss ? 80 : 14, e.boss ? 520 : 260);
  fxRing(e.x, e.y, e.boss ? .12 : .025, e.boss ? 900 : 420, e.boss ? 1.2 : .45);
  fxShake(e.boss ? 22 : 4);
  AU.sfx(e.boss ? 'boom' : 'kill');
  if (e.boss) {
    if (!e.def.mb) mAdd('bosses');
    if (!R.enemies.some(o => o.boss && !o.dead)) {
      for (const b of R.bullets) fxParts(b.x, b.y, PAL.pc[b.pol], 1, 80);
      R.bullets.length = 0; R.flipRule = false; R.killCam = 1.1; R.line = null; R.room.flow = null;
    }
    dropShards(e.x, e.y, e.def.mb ? 1 : 4);
  } else {
    if (e.elite) {
      mAdd('elites'); G.hitstop = .05;
      dropShards(e.x, e.y, 2); ering(e, 14, 150, rand(TAU));
      if (chance(.15)) R.pickups.push({ x: e.x, y: e.y, kind: 'heart', t: 0 });
    }
    if (chance(.12)) dropShards(e.x, e.y, 1);
    if (chance(.015 + .005 * P.stats.luck)) R.pickups.push({ x: e.x, y: e.y, kind: 'heart', t: 0 });
    // high ascension: the dead return fire in their own colour, so it can be absorbed
    if (R.asc >= 2) efan(e, 3, .5, aimP(e), 170, e.pol);
  }
}

function updateEnemies(dt) {
  const P = R.P;
  for (const e of R.enemies) {
    if (e.dead) continue;
    if (e.fl > 0) e.fl -= dt;
    if (e.df > 0) e.df -= dt;
    if (e.spawn > 0) { e.spawn -= dt; continue; }
    if (e.tu) { tubeStep(e, dt); continue; } // riding a wormhole
    let d = dt;
    if (e.slowT > 0) { e.slowT -= dt; d *= e.boss ? (1 + e.slowF) / 2 : e.slowF; }
    if (e.elite) d *= 1.35;
    if (e.burn > 0) {
      e.burn -= dt; damageEnemy(e, e.burnDps * dt);
      if (chance(dt * 12)) fxParts(e.x, e.y, '#ff9a3c', 1, 90);
      if (e.dead) continue;
    }
    e.t += d;
    e.def.ai(e, d);
    e.x += e.vx * d; e.y += e.vy * d;
    e.x = clamp(e.x, !e.boss && inWrap(e.y, -1) ? -99 : BX0 + e.r, !e.boss && inWrap(e.y, 1) ? W + 99 : BX1 - e.r);
    e.y = clamp(e.y, BY0 + e.r, BY1 - e.r);
    if (!e.boss) teleport(e);
    // Last resort for anything wedged where the pathfinder has no map (a sliver between a wall
    // and a wormhole, say): after a moment it drifts straight to the nearest open floor,
    // through whatever is in the way.
    e.offT = R.nav && !e.boss && R.nav[navCell(e.x, e.y)] < 0 ? (e.offT || 0) + d : 0;
    if (e.offT > 1.2) {
      const k = navCell(e.x, e.y), c = k % NC, q = (k / NC) | 0;
      let bx = 0, by = 0, bs = 1e9;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const nc = c + dx, nq = q + dy;
        if (nc < 0 || nq < 0 || nc >= NC || nq >= NQ || R.nav[nc + nq * NC] < 0) continue;
        const x = BX0 + (nc + .5) * NAV, y = BY0 + (nq + .5) * NAV, sc = hyp(x - e.x, y - e.y) + (wallBetween(e.x, e.y, x, y) ? 400 : 0);
        if (sc < bs) { bs = sc; bx = x; by = y; }
      }
      if (bs < 1e9) { const dd = hyp(bx - e.x, by - e.y) || 1; e.x += (bx - e.x) / dd * 170 * d; e.y += (by - e.y) / dd * 170 * d; }
    } else if (!e.boss) for (const o of R.room.obs) { const h = circRect(e.x, e.y, e.r, o); if (h) { e.x += h.x; e.y += h.y; } }
    // A colour field repaints every shot inside it, so an enemy of the field's own colour could
    // never be hurt there. Such an enemy is pushed out to the rim; one that is wedged inside
    // anyway (against a wall or a block) changes colour after a moment.
    let inF = false;
    for (const f of R.room.fields) {
      if (f.pol !== e.pol) continue;
      const dx = e.x - f.x, dy = e.y - f.y, dd = hyp(dx, dy), gap = f.r + e.r - dd;
      if (gap <= 0) continue;
      const a = dd ? Math.atan2(dy, dx) : rand(TAU), k = Math.min(gap, 240 * dt);
      e.x += Math.cos(a) * k; e.y += Math.sin(a) * k;
      if (gap > e.r) inF = true;
    }
    e.fT = inF ? (e.fT || 0) + dt : 0;
    if (e.fT > 1.5) { e.pol ^= 1; e.fT = 0; fxRing(e.x, e.y, .02, 300, .3); }
    if (hyp(P.x - e.x, P.y - e.y) < e.r * .85 + P.stats.hitR) hurtPlayer();
    else if (R.room.wraps.length) { const im = holeImage(e.x, e.y); if (im && hyp(P.x - im.x, P.y - im.y) < e.r * .85 + P.stats.hitR) hurtPlayer(); }
    if (e.beams) for (const b of e.beams) {
      if (b.state !== 'on') continue;
      const L = rayLen(e.x, e.y, b.ang);
      const ds = segDist(P.x, P.y, e.x, e.y, e.x + Math.cos(b.ang) * L, e.y + Math.sin(b.ang) * L);
      if (b.pol === P.pol) {
        if (ds < 8 + P.stats.absorbR * .5) {
          addCharge(30 * dt * P.stats.gain);
          if (chance(dt * 30)) { fxParts(P.x, P.y, PAL.pc[b.pol], 1, 160); AU.sfx('absorb', P.charge); }
        }
      } else if (ds < 5 + P.stats.hitR) hurtPlayer();
    }
  }
  R.enemies = R.enemies.filter(e => !e.dead);
}

// avoid: skip enemies of this colour (used to steer shots away from targets they cannot hurt)
function nearestEnemy(x, y, maxD, skip, avoid) {
  let best = null, bd = maxD * maxD;
  for (const e of R.enemies) {
    if (e.dead || e.spawn > 0 || e.pol === avoid || (skip && skip.has(e))) continue;
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

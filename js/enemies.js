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
  const v = spd * R.bspd;
  const b = { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, pol, r: r || 6, t: 0, gz: false, cv: 0, noEr: false };
  if (o) Object.assign(b, o);
  R.bullets.push(b);
  return b;
}
function ering(e, n, spd, off, pol, r, o) { for (let i = 0; i < n; i++) eb(e.x, e.y, off + i * TAU / n, spd, pol === undefined ? e.pol : pol, r, o); }
function efan(e, n, arc, a, spd, pol, r, o) { for (let i = 0; i < n; i++) eb(e.x, e.y, a + (n > 1 ? (i / (n - 1) - .5) * arc : 0), spd, pol === undefined ? e.pol : pol, r, o); }
function moveTo(e, tx, ty, spd, dt, k) {
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
    const a = aimP(e) + Math.sin(e.t * 4 + e.id) * .9;
    e.vx = lerp(e.vx, Math.cos(a) * 175, 2 * dt); e.vy = lerp(e.vy, Math.sin(a) * 175, 2 * dt);
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
      const wall = e.x <= BX0 + e.r + 2 || e.x >= BX1 - e.r - 2 || e.y <= BY0 + e.r + 2 || e.y >= BY1 - e.r - 2;
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

// ---------------------------------------------------------------- lifecycle
function makeEnemy(type, x, y, pol, spawnT) {
  const def = ENEMY[type];
  const hp = def.hp * (def.boss ? 1 + .25 * R.asc : R.hpMul);
  const e = {
    type, def, x, y, vx: 0, vy: 0, r: def.r, hp, maxHp: hp, pol, t: 0, cd: 1, rot: rand(TAU), id: R.eid++,
    spawn: spawnT === undefined ? .9 : spawnT, fl: 0, burn: 0, burnDps: 0, slowT: 0, slowF: 1, boss: !!def.boss, dead: false, warn: null
  };
  if (def.init) def.init(e);
  R.enemies.push(e);
  return e;
}

function damageEnemy(e, d, crit) {
  if (e.dead || e.spawn > 0) return;
  e.hp -= d; e.fl = .08;
  if (crit) fxParts(e.x, e.y, '#ffffff', 4, 220);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  const P = R.P;
  e.dead = true;
  if (e.def.death) e.def.death(e);
  R.st.kills++; mAdd('kills');
  // Ikaruga chain: three same-polarity kills in a row extend the chain
  if (P.seqN > 0 && e.pol !== P.seqPol) { P.chain = 0; P.seqN = 0; }
  P.seqPol = e.pol; P.seqN++;
  if (P.seqN === 3) { P.seqN = 0; P.chain++; mMax('chain', P.chain); dropShards(e.x, e.y, 1); AU.sfx('pick'); }
  const col = PAL.pc[e.pol];
  fxParts(e.x, e.y, col, e.boss ? 80 : 14, e.boss ? 520 : 260);
  fxRing(e.x, e.y, e.boss ? .12 : .025, e.boss ? 900 : 420, e.boss ? 1.2 : .45);
  fxShake(e.boss ? 22 : 4);
  AU.sfx(e.boss ? 'boom' : 'kill');
  if (e.boss) {
    mAdd('bosses');
    if (!R.enemies.some(o => o.boss && !o.dead)) {
      for (const b of R.bullets) fxParts(b.x, b.y, PAL.pc[b.pol], 1, 80);
      R.bullets.length = 0; R.flipRule = false; R.killCam = 1.1;
    }
    dropShards(e.x, e.y, 5);
  } else {
    if (e.elite) {
      mAdd('elites'); G.hitstop = .05;
      dropShards(e.x, e.y, 3); ering(e, 14, 150, rand(TAU));
      if (chance(.15)) R.pickups.push({ x: e.x, y: e.y, kind: 'heart', t: 0 });
    }
    if (chance(.2)) dropShards(e.x, e.y, 1);
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
    if (e.spawn > 0) { e.spawn -= dt; continue; }
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
    e.x = clamp(e.x, BX0 + e.r, BX1 - e.r); e.y = clamp(e.y, BY0 + e.r, BY1 - e.r);
    if (!e.boss) for (const o of R.room.obs) { const h = circRect(e.x, e.y, e.r, o); if (h) { e.x += h.x; e.y += h.y; } }
    if (hyp(P.x - e.x, P.y - e.y) < e.r * .85 + P.stats.hitR) hurtPlayer();
    if (e.beams) for (const b of e.beams) {
      if (b.state !== 'on') continue;
      const L = rayLen(e.x, e.y, b.ang);
      const ds = segDist(P.x, P.y, e.x, e.y, e.x + Math.cos(b.ang) * L, e.y + Math.sin(b.ang) * L);
      if (b.pol === P.pol) {
        if (ds < 8 + P.stats.absorbR * .5) {
          P.charge = Math.min(P.stats.chargeMax, P.charge + 30 * dt * P.stats.gain);
          if (chance(dt * 30)) { fxParts(P.x, P.y, PAL.pc[b.pol], 1, 160); AU.sfx('absorb', P.charge); }
        }
      } else if (ds < 5 + P.stats.hitR) hurtPlayer();
    }
  }
  R.enemies = R.enemies.filter(e => !e.dead);
}

function nearestEnemy(x, y, maxD, skip) {
  let best = null, bd = maxD * maxD;
  for (const e of R.enemies) {
    if (e.dead || e.spawn > 0 || (skip && skip.has(e))) continue;
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

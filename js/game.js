'use strict';
const PAUSE_QUIT = { x: W / 2 + 90, y: 115 };
const G = { hitstop: 0, state: 'title', t: 0, toasts: [], endT: 0, newUn: [], shipSel: 0, debug: false, demo: false };

// ---------------------------------------------------------------- fx helpers
function fxRing(x, y, str, spd, life) { if (R.fx.length < 24) R.fx.push({ x, y, str, spd, life, t: 0 }); }
function fxShake(n) { R.shake = Math.max(R.shake, n); }
function fxParts(x, y, col, n, spd) {
  for (let i = 0; i < n && R.parts.length < 700; i++) {
    const a = rand(TAU), v = rand(.3, 1) * spd;
    R.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(.25, .6), col, s: rand(2, 5), rot: rand(TAU) });
  }
}
function dropShards(x, y, n) {
  n = Math.round(n * (1 + .5 * R.P.stats.greed));
  for (let i = 0; i < n; i++) R.pickups.push({ x: x + rand(-14, 14), y: y + rand(-14, 14), kind: 'shard', t: 0, vx: rand(-90, 90), vy: rand(-90, 90) });
}
function toast(list) { for (const u of list) { G.toasts.push({ u, t: 0 }); G.newUn.push(u); } }

// ---------------------------------------------------------------- run setup
function newRun() {
  const ship = SHIPS.find(s => s.id === META.ship && (s.id === 'tri' || META.un['ship:' + s.id])) || SHIPS[0];
  R = {
    ship, asc: Math.min(META.asc || 0, maxAsc()), stage: 0, time: 0, beat: 0, lastStep: -1, slowT: 0,
    shots: [], bullets: [], enemies: [], pickups: [], parts: [], fx: [], arcs: [], booms: [], wells: [], mines: [], trails: [], orbs: [], slashes: [], bossMax: 1,
    offered: new Set(), killCam: 0, rerollCost: 3,
    shake: 0, inv: 0, ca: 0, flash: 0, eid: 0, shotN: 0, wave: 0, flipRule: false, lastFlipBeat: 0, over: false,
    nStages: 3 + (META.un.stage4 ? 1 : 0) + (META.un.stage5 ? 1 : 0) + (META.un.stage5 && META.un.stage6 ? 1 : 0),
    route: rollRoute(), flow: null, line: null,
    st: { kills: 0, absorbed: 0, rooms: 0, bursts: 0, shards: 0 }, hpMul: 1, bspd: 1, room: null, floor: null, nearPed: null
  };
  R.P = {
    x: W / 2, y: H / 2, vx: 0, vy: 0, kx: 0, ky: 0, pol: 0, ups: [], hp: 1, sh: 0, charge: 0, inv: 0, fireCd: 0, vq: [],
    novaCd: 0, lockT: 0, ang: -Math.PI / 2, face: -Math.PI / 2, still: 0, drones: [], misCd: 1, mineCd: 0, teslaCd: 0, orbCd: 2, bladeCd: 0, heat: 0, railN: 0, hist: [], fl: { x: W / 2, y: H / 2, vx: 0, vy: 0 }, shards: 0, refl: 0, vampN: 0, seqPol: -1, seqN: 0, chain: 0, preview: null,
    stats: null, rateBuff: 0, hit: false, firing: false, dn: 0
  };
  const P = R.P;
  if (ship.wild) P.ups = rollUps(ship.wild, 2);
  recompute();
  P.hp = P.stats.maxHp; P.sh = P.stats.shield;
  G.newUn = [];
  mAdd('runs');
  startStage(0);
  G.state = 'play';
}

function recompute() { const P = R.P; P.stats = computeStats(R.ship, P.ups, P.preview); P.fus = fusionsOf(P.ups, P.preview); }

function startStage(i) {
  R.stage = i; PAL = STAGES[R.route[i]];
  R.hpMul = (1 + .4 * i) * (1 + .2 * R.asc);
  mMax('stage', i + 1);
  R.offered = new Set();
  R.floor = genFloor(i);
  R.P.x = W / 2; R.P.y = H / 2;
  enterRoom(R.floor.start, null);
  toast(checkUnlocks());
}

function enterRoom(room, dir) {
  const P = R.P;
  R.room = room;
  R.shots = []; R.bullets = []; R.enemies = []; R.arcs = []; R.booms = []; R.mines = []; R.trails = [];
  R.pickups = room.pickups; R.flipRule = false; R.line = null; P.vq = [];
  if (dir) { const d = DOOR_POS[OPP[dir]]; P.x = d[0] + DIRV[dir][0] * 34; P.y = d[1] + DIRV[dir][1] * 34; }
  P.kx = P.ky = 0; P.hit = false;
  for (const d of P.drones) { d.x = P.x; d.y = P.y; }
  R.orbs = []; R.slashes = []; P.hist = []; P.fl.x = P.x; P.fl.y = P.y; P.fl.vx = P.fl.vy = 0;
  room.visited = room.seen = true;
  for (const d in room.doors) room.doors[d].seen = true;
  if (!room.cleared) {
    R.wave = 0;
    if (room.type === 'boss') {
      PAL.boss.forEach((b, k) => { const e = makeEnemy(b, W / 2 + (PAL.boss.length > 1 ? (k ? 160 : -160) : 0), H / 2, k, 1.6); e.k = k; });
      AU.sfx('warp'); fxShake(10);
    } else if (room.type === 'mini') { makeEnemy(room.mb, W / 2, H / 2, randi(0, 1), 1.4); AU.sfx('warp'); }
    else if (room.type === 'fight' && room.waves.length) spawnWave(room.waves[0]);
    else room.cleared = true;
    R.bossMax = R.enemies.reduce((a, e) => a + (e.boss ? e.maxHp + (e.extra || 0) : 0), 0) || 1;
  }
  fxRing(P.x, P.y, .03, 500, .4);
}

function spawnWave(wave) {
  const P = R.P;
  for (const w of wave) {
    let x = 0, y = 0;
    for (let g = 0; g < 30; g++) {
      x = rand(BX0 + 50, BX1 - 50); y = rand(BY0 + 50, BY1 - 50);
      if (hyp(x - P.x, y - P.y) < 230) continue;
      if (R.room.obs.some(o => circRect(x, y, 26, o))) continue;
      break;
    }
    const e = makeEnemy(w.type, x, y, w.pol, R.asc >= 4 ? .6 : .9);
    if (!e.def.group && R.stage > 0 && chance(.04 + .03 * R.stage + .02 * R.asc)) { e.elite = true; e.hp = e.maxHp *= 2.5; e.r *= 1.25; }
  }
}

function clearRoom() {
  const P = R.P, room = R.room, s = P.stats;
  room.cleared = true;
  R.st.rooms++; mAdd('rooms');
  if (!P.hit) mAdd('nohit');
  P.sh = s.shield;
  AU.sfx('clear'); fxRing(W / 2, H / 2, .03, 900, .7);
  if (room.type === 'boss') {
    const ups = rollUps(3, s.luck + 3);
    ups.forEach((u, i) => room.peds.push({ x: W / 2 + (i - 1) * 170, y: H / 2 + 90, up: u, price: 0, group: 2, taken: false }));
    room.portal = { x: W / 2, y: 190 };
    R.pickups.push({ x: W / 2, y: H / 2 - 20, kind: 'heart', t: 0 });
  } else if (room.type === 'mini') {
    mAdd('minis'); dropShards(W / 2, H / 2, 2);
    rollUps(2, s.luck + 2).forEach((u, i) => room.peds.push({ x: W / 2 + (i ? 95 : -95), y: H / 2, up: u, price: 0, group: 3, taken: false }));
  } else if (room.type === 'challenge') {
    dropShards(W / 2, H / 2, 3);
    R.pickups.push({ x: W / 2, y: H / 2, kind: 'heart', t: 0 });
  } else {
    const r = Math.random();
    if (r < .2 + .04 * s.luck && P.hp < s.maxHp) R.pickups.push({ x: W / 2, y: H / 2, kind: 'heart', t: 0 });
    else if (r < .4) dropShards(W / 2, H / 2, 1);
  }
  toast(checkUnlocks());
  saveMeta();
}

function nextStage() {
  AU.sfx('warp');
  if (R.stage + 1 >= R.nStages) {
    mAdd('wins'); mMax('asc', R.asc + 1);
    endRun('win');
  } else {
    startStage(R.stage + 1);
    R.inv = 1; fxRing(W / 2, H / 2, .15, 900, 1.2);
  }
}

function endRun(state) {
  R.over = true; G.state = state; G.endT = 0;
  toast(checkUnlocks());
  saveMeta();
}

// ---------------------------------------------------------------- player
function heal(n) { const P = R.P; if (P.hp >= P.stats.maxHp) return false; P.hp = Math.min(P.stats.maxHp, P.hp + n); fxParts(P.x, P.y, '#ff5a7a', 10, 160); return true; }

function giveUp(id) {
  const P = R.P, before = computeStats(R.ship, P.ups).maxHp;
  const had = fusionsOf(P.ups);
  P.ups.push(id); P.preview = null; recompute();
  for (const [f, a, b] of FUSIONS) if (P.fus[f] && !had[f]) G.toasts.push({ f: [a, b], t: 0 });
  const after = P.stats.maxHp;
  if (after > before) P.hp += after - before;
  P.hp = clamp(P.hp, 1, after);
  P.charge = Math.min(P.charge, P.stats.chargeMax);
  mAdd('taken');
  AU.sfx('take'); fxRing(P.x, P.y, .06, 600, .6);
  fxParts(P.x, P.y, TIER_COL[UP[id].tier], 24, 300);
}

function hurtPlayer() {
  const P = R.P, s = P.stats;
  if (P.inv > 0 || R.over || G.god) return;
  if (P.sh > 0) P.sh--; else P.hp--;
  P.inv = s.inv; P.hit = true; P.chain = 0; P.seqN = 0;
  mAdd('hits');
  R.ca = .03; R.flash = 1; fxShake(16); G.hitstop = .07; fxRing(P.x, P.y, .1, 800, .7); AU.sfx('hurt');
  for (const b of R.bullets) if (hyp(b.x - P.x, b.y - P.y) < 150) { b.dead = true; fxParts(b.x, b.y, PAL.pc[b.pol], 1, 120); }
  if (s.thorns) for (let i = 0, n = 16 * s.thorns; i < n; i++) spawnShot(P.x, P.y, i * TAU / n, { dmg: shotDmg() * 1.5, pol: P.pol });
  if (P.hp <= 0) {
    fxParts(P.x, P.y, PAL.pc[P.pol], 80, 500); fxRing(P.x, P.y, .2, 600, 1.5); R.inv = 1; AU.sfx('boom');
    endRun('dead');
  }
}

function flipPolarity() {
  const P = R.P, s = P.stats;
  if (P.lockT > 0) { AU.sfx('deny'); return; }
  P.pol ^= 1; P.lockT = s.flipLock;
  R.st.flips = (R.st.flips || 0) + 1; mAdd('flips');
  AU.sfx('flip', P.pol); fxRing(P.x, P.y, .018, 420, .3);
  if (s.nova && P.novaCd <= 0) {
    P.novaCd = 1.5;
    for (let i = 0, n = 8 * s.nova; i < n; i++) spawnShot(P.x, P.y, P.ang + i * TAU / n, { dmg: shotDmg() * .6, pol: P.pol });
  }
  if (P.fus.halo) for (let i = 0; i < s.orbit; i++) { const a = R.time * 2.6 + i * TAU / s.orbit; spawnShot(P.x + Math.cos(a) * 48, P.y + Math.sin(a) * 48, a, { dmg: shotDmg(), pol: P.pol }); }
  if (s.flipSlow) R.slowT = Math.max(R.slowT, s.flipSlow);
}

function absorbBullet(b) {
  const P = R.P, s = P.stats;
  b.dead = true;
  P.charge = Math.min(s.chargeMax, P.charge + 2.2 * s.gain);
  R.st.absorbed++; mAdd('absorbed');
  if (s.reflect) {
    P.refl += s.reflect * .34;
    while (P.refl >= 1) {
      P.refl--;
      const t = nearestEnemy(P.x, P.y, 900);
      spawnShot(P.x, P.y, t ? Math.atan2(t.y - P.y, t.x - P.x) : P.ang, { dmg: shotDmg(), pol: P.pol ^ 1, hom: 4 });
    }
  }
  if (s.vamp && ++P.vampN >= 90 / s.vamp) { P.vampN = 0; heal(1); }
  R.parts.push({ x: b.x, y: b.y, vx: (P.x - b.x) * 6, vy: (P.y - b.y) * 6, t: 0, life: .15, col: PAL.pc[b.pol], s: 4, rot: 0 });
  AU.sfx('absorb', P.charge);
}

function updatePlayer(dt) {
  const P = R.P, s = P.stats, room = R.room;
  let mx = (IN.down('KeyD') ? 1 : 0) - (IN.down('KeyA') ? 1 : 0), my = (IN.down('KeyS') ? 1 : 0) - (IN.down('KeyW') ? 1 : 0);
  if (hyp(IN.padMove.x, IN.padMove.y) > .25) { mx = IN.padMove.x; my = IN.padMove.y; }
  const l = Math.max(1, hyp(mx, my)), k = 1 - Math.exp(-dt * 16);
  P.vx = lerp(P.vx, mx / l * s.move, k); P.vy = lerp(P.vy, my / l * s.move, k);
  const kd = Math.exp(-dt * 6); P.kx *= kd; P.ky *= kd;
  let px = 0, py = 0;
  for (const w of R.wells) {
    const dx = w.x - P.x, dy = w.y - P.y, d = hyp(dx, dy) || 1;
    const wf = wellF(w, d);
    if (wf) { px += dx / d * w.str * wf; py += dy / d * w.str * wf; if (d < w.core) hurtPlayer(); }
  }
  if (R.flow) { px += R.flow.x * 75; py += R.flow.y * 75; }
  P.x += (P.vx + P.kx + px) * dt; P.y += (P.vy + P.ky + py) * dt;
  P.still = hyp(P.vx, P.vy) < s.move * .2 ? P.still + dt : 0;
  for (const o of room.obs) { const h = circRect(P.x, P.y, 12, o); if (h) { P.x += h.x; P.y += h.y; } }
  for (const g of room.gates) if (g.pol !== P.pol) { const h = circRect(P.x, P.y, 12, g); if (h) { P.x += h.x; P.y += h.y; } }
  // walls, with gaps where doors are open
  const pr = 12, open = room.cleared, D = room.doors;
  const gy = Math.abs(P.y - H / 2) < 32, gx = Math.abs(P.x - W / 2) < 32;
  if (P.x < BX0 + pr && !(open && D.w && gy)) P.x = BX0 + pr;
  if (P.x > BX1 - pr && !(open && D.e && gy)) P.x = BX1 - pr;
  if (P.y < BY0 + pr && !(open && D.n && gx)) P.y = BY0 + pr;
  if (P.y > BY1 - pr && !(open && D.s && gx)) P.y = BY1 - pr;
  if (P.x < BX0 - 26) return enterRoom(D.w, 'w');
  if (P.x > BX1 + 26) return enterRoom(D.e, 'e');
  if (P.y < BY0 - 26) return enterRoom(D.n, 'n');
  if (P.y > BY1 + 26) return enterRoom(D.s, 's');

  // aim: mouse, or arrow keys Isaac-style
  const ax = (IN.down('ArrowRight') ? 1 : 0) - (IN.down('ArrowLeft') ? 1 : 0), ay = (IN.down('ArrowDown') ? 1 : 0) - (IN.down('ArrowUp') ? 1 : 0);
  // whichever device was touched last owns the aim; an idle mouse never steers the ship
  const pa = IN.padAim;
  if (hyp(pa.x, pa.y) > .4) { P.ang = Math.atan2(pa.y, pa.x); P.firing = true; IN.mouseAim = false; }
  else if (ax || ay) { P.ang = Math.atan2(ay, ax); P.firing = true; IN.mouseAim = false; }
  else if (IN.mouseAim) { P.ang = Math.atan2(IN.my - P.y, IN.mx - P.x); P.firing = IN.mb[0]; }
  else P.firing = false;
  // the hull turns smoothly: toward the aim while firing, otherwise toward where it is heading
  P.face = turnTo(P.face, P.firing ? P.ang : (mx || my) ? Math.atan2(my, mx) : P.face, 14 * dt);

  if (P.inv > 0) P.inv -= dt;
  if (P.lockT > 0) P.lockT -= dt;
  if (P.novaCd > 0) P.novaCd -= dt;
  if (IN.hit('Space') || IN.mhit[2]) flipPolarity();
  if (IN.hit('KeyQ') || IN.hit('ShiftLeft') || IN.mhit[1]) releaseBurst();
}

// ---------------------------------------------------------------- bullets & pickups
function updateBullets(dt) {
  const P = R.P, s = P.stats, obs = R.room.obs;
  const aR = s.absorbR, hR = s.hitR;
  for (const b of R.bullets) {
    if (b.dead) continue;
    b.t += dt;
    if (b.cv) { const c = Math.cos(b.cv * dt), sn = Math.sin(b.cv * dt), vx = b.vx; b.vx = vx * c - b.vy * sn; b.vy = vx * sn + b.vy * c; }
    for (const w of R.wells) {
      const dx = w.x - b.x, dy = w.y - b.y, d = hyp(dx, dy) || 1, wf = b.free ? 0 : wellF(w, d);
      if (wf) { const g = w.str * 1.6 * wf * dt; b.vx += dx / d * g; b.vy += dy / d * g; }
      if (d < (w.bcore || w.core) && b.t > .5) b.dead = true;
    }
    if (b.fuse && b.t > b.fuse) {
      for (let i = 0; i < 10; i++) eb(b.x, b.y, i * TAU / 10, 150, b.pol ^ 1);
      b.dead = true; fxRing(b.x, b.y, .02, 300, .3); AU.sfx('kill');
      continue;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (R.flow) { b.x += R.flow.x * 60 * dt; b.y += R.flow.y * 60 * dt; }
    if (b.x < BX0 || b.x > BX1 || b.y < BY0 || b.y > BY1) {
      if (b.bn <= 0 || b.t < .3) { b.dead = true; continue; }
      b.bn--; // ricochet
      if (b.x < BX0 || b.x > BX1) b.vx = -b.vx;
      if (b.y < BY0 || b.y > BY1) b.vy = -b.vy;
      b.x = clamp(b.x, BX0, BX1); b.y = clamp(b.y, BY0, BY1);
    }
    if (b.t > 14) { b.dead = true; continue; }
    if (!b.fix) {
      for (const f of R.room.fields) if ((b.x - f.x) * (b.x - f.x) + (b.y - f.y) * (b.y - f.y) < f.r * f.r) b.pol = f.pol;
      if (R.line) b.pol = (b.x - R.line.x) * Math.sin(R.line.ang) - (b.y - R.line.y) * Math.cos(R.line.ang) > 0 ? 0 : 1;
    }
    for (const o of obs) if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) { b.dead = true; break; }
    for (const g of R.room.gates) if (g.pol !== b.pol && b.x > g.x && b.x < g.x + g.w && b.y > g.y && b.y < g.y + g.h) { b.dead = true; fxParts(b.x, b.y, PAL.pc[g.pol], 1, 80); break; }
    if (b.dead) continue;
    const dx = b.x - P.x, dy = b.y - P.y, d2 = dx * dx + dy * dy;
    if (b.pol === P.pol) { if (d2 < (aR + b.r) * (aR + b.r)) absorbBullet(b); }
    else if (d2 < (hR + b.r * .6) * (hR + b.r * .6)) { b.dead = true; hurtPlayer(); }
    else if (!b.gz && d2 < (hR + b.r + 20) * (hR + b.r + 20) && P.inv <= 0) {
      b.gz = true; mAdd('grazes'); AU.sfx('graze');
      R.parts.push({ x: P.x + dx * .5, y: P.y + dy * .5, vx: rand(-60, 60), vy: rand(-60, 60), t: 0, life: .25, col: '#ffffff', s: 3, rot: 0 });
      if (s.graze) { P.charge = Math.min(s.chargeMax, P.charge + 3 * s.graze * s.gain); P.rateBuff = 1 + .5 * s.graze; }
    }
  }
  if (R.bullets.some(b => b.dead)) R.bullets = R.bullets.filter(b => !b.dead);
}

function updatePickups(dt) {
  const P = R.P, s = P.stats, list = R.pickups;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]; p.t += dt;
    if (p.vx) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .9; p.vy *= .9; }
    const dx = P.x - p.x, dy = P.y - p.y, d = hyp(dx, dy) || 1;
    if (p.kind === 'heart' && P.hp >= s.maxHp) { p.x = clamp(p.x, BX0 + 20, BX1 - 20); p.y = clamp(p.y, BY0 + 20, BY1 - 20); continue; }
    if (d < s.magnet && p.t > .3) { const v = 520 * (1 - d / s.magnet) + 120; p.x += dx / d * v * dt; p.y += dy / d * v * dt; }
    p.x = clamp(p.x, BX0 + 12, BX1 - 12); p.y = clamp(p.y, BY0 + 12, BY1 - 12);
    if (d < 20) {
      if (p.kind === 'shard') { P.shards++; R.st.shards++; mAdd('shards'); }
      else heal(1);
      AU.sfx('pick'); list.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- room logic
function takePed(p) {
  const P = R.P, room = R.room;
  if (P.shards < p.price || (p.heart && P.hp >= P.stats.maxHp) || (p.hpCost && computeStats(R.ship, P.ups).maxHp <= 1)) { AU.sfx('deny'); return; }
  P.shards -= p.price; p.taken = true;
  if (p.hpCost) { P.ups.push('scar'); AU.sfx('hurt'); fxShake(10); R.flash = 1; }
  if (p.heart) { heal(1); AU.sfx('take'); } else giveUp(p.up);
  if (p.group) for (const q of room.peds) if (q.group === p.group && !q.taken) { q.taken = true; fxParts(q.x, q.y, '#888888', 12, 200); }
  if (room.type === 'challenge' && !room.done) { room.done = true; room.cleared = false; R.wave = 0; spawnWave(room.waves[0]); AU.sfx('warp'); fxShake(10); }
}

// free pedestals in the current room that a reroll would replace
function rerollable() { return META.un.reroll ? R.room.peds.filter(p => !p.taken && p.group && p.up) : []; }

// a shot struck a wall in a room with a hidden door: chip at it if it landed on the crack
function hitSecret(sh) {
  const room = R.room, hd = room.hidden, dp = DOOR_POS[hd.dir];
  if (hyp(sh.x - dp[0], sh.y - dp[1]) > 46) return;
  hd.hp -= sh.dmg; hd.flT = G.t; fxParts(sh.x, sh.y, '#ffffff', 3, 160);
  if (hd.hp > 0) return;
  room.doors[hd.dir] = hd.room; hd.room.doors[OPP[hd.dir]] = room; hd.room.seen = true; room.hidden = null;
  mAdd('secrets'); AU.sfx('boom'); fxShake(12); fxRing(dp[0], dp[1], .06, 500, .6); fxParts(dp[0], dp[1], PAL.wall, 30, 320);
  toast(checkUnlocks());
}

function updateRoom(dt) {
  const P = R.P, room = R.room;
  if (!room.cleared && !R.enemies.length) {
    if (R.wave < room.waves.length - 1) spawnWave(room.waves[++R.wave]); else clearRoom();
  }
  let near = null;
  for (const p of room.peds) if (!p.taken && hyp(p.x - P.x, p.y - P.y) < 50) near = p;
  const pid = near && near.up ? near.up : null;
  if (pid !== P.preview) { P.preview = pid; recompute(); }
  R.nearPed = near;
  if (near && (IN.hit('KeyE') || IN.hit('KeyF') || IN.hit('Enter'))) takePed(near);
  if (IN.hit('KeyR')) {
    const list = rerollable();
    if (list.length && P.shards < R.rerollCost) AU.sfx('deny');
    else if (list.length) {
      P.shards -= R.rerollCost; R.rerollCost += 2;
      const ups = rollUps(list.length, P.stats.luck);
      list.forEach((p, i) => { if (ups[i]) p.up = ups[i]; fxParts(p.x, p.y, '#ffffff', 12, 220); });
      AU.sfx('take');
    }
  }
  if (room.portal && room.cleared && hyp(room.portal.x - P.x, room.portal.y - P.y) < 30) nextStage();
}

function updateFx(dt) {
  for (let i = R.parts.length - 1; i >= 0; i--) {
    const p = R.parts[i];
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy *= .94;
    if (p.t >= p.life) { R.parts[i] = R.parts[R.parts.length - 1]; R.parts.pop(); }
  }
  for (let i = R.fx.length - 1; i >= 0; i--) { const f = R.fx[i]; if ((f.t += dt) >= f.life) R.fx.splice(i, 1); }
  for (let i = R.arcs.length - 1; i >= 0; i--) if ((R.arcs[i].t += dt) > .18) R.arcs.splice(i, 1);
  for (let i = R.booms.length - 1; i >= 0; i--) if ((R.booms[i].t += dt) > .25) R.booms.splice(i, 1);
  for (let i = R.slashes.length - 1; i >= 0; i--) if ((R.slashes[i].t += dt) > .16) R.slashes.splice(i, 1);
  for (let i = R.trails.length - 1; i >= 0; i--) if ((R.trails[i].t += dt) > .14) R.trails.splice(i, 1);
  R.shake *= Math.exp(-dt * 9);
  R.inv = Math.max(0, R.inv - dt * 3);
  R.flash = Math.max(0, R.flash - dt * 4);
  R.ca = Math.max(0, R.ca - dt * .06);
}

function update(dt) {
  const P = R.P;
  R.time += dt;
  R.beat = R.time * PAL.bpm / 60;
  const step = Math.floor(R.beat * 4);
  if (step !== R.lastStep) { R.lastStep = step; AU.step(step, PAL.mus, (R.room.type === 'boss' || R.room.type === 'mini') && !R.room.cleared ? 2 : R.enemies.length ? 1 : 0); }

  // the room's current: reverses every 16 beats unless a boss is steering it
  const fl = R.room.flow;
  if (fl) {
    const a = fl.ang + (!fl.fixed && Math.floor(R.beat / 16) % 2 ? Math.PI : 0);
    R.flow = { x: Math.cos(a), y: Math.sin(a), warn: !fl.fixed && R.beat % 16 > 14.5 };
  } else R.flow = null;
  R.wells = R.room.wells.slice();
  for (const e of R.enemies) if (e.well && e.spawn <= 0 && e.well.str > 5) R.wells.push({ x: e.x, y: e.y, str: e.well.str, r: e.well.r, core: 0, floor: e.well.floor, bcore: e.well.bcore, vis: e.well.vis });

  if (R.slowT > 0) R.slowT -= dt;
  const edt = dt * (R.slowT > 0 ? .3 : 1);
  updatePlayer(dt);
  if (R.over) return;
  updateFire(dt);
  updateSecondary(dt);
  updateShots(dt);
  updateEnemies(edt);
  updateBullets(edt);
  updatePickups(dt);
  updateRoom(dt);
  if (R.over) return;

  // PULSE stage (and the final boss): every eighth beat all bullets swap polarity
  const fb = Math.floor(R.beat / 8);
  if (fb !== R.lastFlipBeat) {
    R.lastFlipBeat = fb;
    if ((PAL.haz.flip || R.flipRule) && R.bullets.length) { for (const b of R.bullets) b.pol ^= 1; R.inv = .7; AU.sfx('swap'); }
  }
  updateFx(dt);
}

// ---------------------------------------------------------------- menus
function updateTitle() {
  const n = SHIPS.length;
  if (IN.hit('KeyA') || IN.hit('ArrowLeft')) G.shipSel = (G.shipSel + n - 1) % n;
  if (IN.hit('KeyD') || IN.hit('ArrowRight')) G.shipSel = (G.shipSel + 1) % n;
  const ma = maxAsc();
  if (IN.hit('KeyW') || IN.hit('ArrowUp')) META.asc = Math.min(ma, (META.asc || 0) + 1);
  if (IN.hit('KeyS') || IN.hit('ArrowDown')) META.asc = Math.max(0, (META.asc || 0) - 1);
  if (IN.hit('Tab') || IN.hit('KeyG')) { G.state = 'gallery'; return; }
  const ship = SHIPS[G.shipSel], ok = ship.id === 'tri' || META.un['ship:' + ship.id];
  if (IN.hit('Space') || IN.hit('Enter') || IN.mhit[0]) {
    AU.init();
    if (!ok) { AU.sfx('deny'); return; }
    META.ship = ship.id; saveMeta(); newRun();
  }
}

function frame(dt) {
  G.t += dt;
  if (IN.any) AU.init();
  if (IN.hit('KeyM')) { AU.mute = META.mute = !AU.mute; saveMeta(); }
  switch (G.state) {
    case 'title': updateTitle(); break;
    case 'play':
      if (IN.hit('Escape') || IN.hit('KeyP')) G.state = 'pause';
      else {
        if (G.debug) debugKeys();
        // hit-stop freezes the world for a few frames; the kill-cam slows it after a boss dies
        if (R.killCam > 0) R.killCam -= dt;
        if (G.hitstop > 0) G.hitstop -= dt; else update(dt * (R.killCam > 0 ? .25 : 1));
      }
      break;
    case 'pause':
      if (IN.hit('Escape') || IN.hit('KeyP')) G.state = 'play';
      if (IN.hit('ArrowRight') || IN.hit('ArrowLeft')) { META.fx = clamp(META.fx + (IN.hit('ArrowRight') ? .5 : -.5), 0, 1); saveMeta(); }
      if (IN.hit('ArrowUp') || IN.hit('ArrowDown')) { META.vol = clamp(Math.round((META.vol + (IN.hit('ArrowUp') ? .25 : -.25)) * 4) / 4, 0, 1); if (AU.out) AU.out.gain.value = .5 * META.vol; saveMeta(); AU.sfx('pick'); }
      else if (IN.hit('KeyX') || (IN.mhit[0] && hyp(IN.mx - PAUSE_QUIT.x, IN.my - PAUSE_QUIT.y) < 40)) { saveMeta(); G.state = 'title'; PAL = STAGES[0]; }
      break;
    case 'dead': case 'win':
      G.endT += dt; updateFx(dt * .5);
      if (G.endT > 1.2 && (IN.hit('Space') || IN.hit('Enter') || IN.mhit[0])) { G.state = 'title'; PAL = STAGES[0]; }
      break;
    case 'gallery': if (IN.hit('Escape') || IN.hit('Tab') || IN.hit('KeyG') || IN.mhit[0]) G.state = 'title'; break;
  }
  if (G.toasts.length && (G.toasts[0].t += dt) > 2.2) G.toasts.shift();
  if (G.toasts.length && !G.toasts[0].snd) { G.toasts[0].snd = true; AU.sfx('unlock'); }
}

// #dbg in the URL: U random upgrade, N next stage, K kill all, B jump to boss room, H heal
function debugKeys() {
  if (IN.hit('KeyU')) giveUp(pick(UPS).id);
  if (IN.hit('KeyN')) nextStage();
  if (IN.hit('KeyK')) for (const e of R.enemies.slice()) damageEnemy(e, 1e6);
  if (IN.hit('KeyB')) enterRoom(R.floor.rooms.find(r => r.type === 'boss'), null);
  if (IN.hit('KeyH')) R.P.hp = R.P.stats.maxHp;
}

'use strict';
// The player's weapon. A shot is a point with a heading; every trajectory upgrade is a
// steering force on that heading and every payload upgrade is an on-hit / on-death hook,
// which is what lets any set of upgrades combine. A beam is the same shot traced to the
// end of its life in a single frame, so beams curve, bounce, home and split too.

// damage multiplier for something of colour pol striking enemy e
const polMul = (pol, e) => pol !== e.pol ? R.P.stats.oppMul : R.P.stats.sameMul;
const noHurt = pol => R.P.stats.sameMul <= 0 ? pol : undefined;

// Charge as the weapon systems see it: bottomless while an upgrade is being tried on a pedestal.
// The meter is one or more rings of chargeMax each. chgFrac counts rings, so it runs past 1
// with a reserve tank; a burst only ever spends one ring.
const chargeCap = () => R.P.stats.chargeMax * R.P.stats.rings;
const chg = () => R.P.preview ? chargeCap() : R.P.charge;
const chgFrac = () => chg() / R.P.stats.chargeMax;
const addCharge = n => { R.P.charge = Math.min(chargeCap(), R.P.charge + n); };
function spendCharge(n) { if (!R.P.preview) R.P.charge = Math.max(0, R.P.charge - n); }

function shotDmg() {
  const P = R.P, s = P.stats;
  let d = s.dmg;
  if (s.kinetic) d *= 1 + s.kinetic * (hyp(P.vx, P.vy) > s.move * .5 ? .4 : -.2);
  if (s.berserk) d *= 1 + s.berserk * .2 * Math.max(0, s.maxHp - P.hp);
  d *= 1 + .06 * Math.min(P.chain, 8); // chain overdrive
  if (s.dynamo) d *= 1 + .8 * s.dynamo * chgFrac();
  if (s.vacuum) d *= 1 + .6 * s.vacuum * Math.max(0, 1 - chgFrac());
  if (P.fcN > 0) d *= 2; // polar charge: the volleys right after a flip
  return Math.max(1, d);
}

// o: {dmg, pol, hom, spd, life, size, split, frag, skip, burst, ex, proj}
function spawnShot(x, y, ang, o) {
  if (R.shots.length > 500) return null;
  const s = R.P.stats;
  const sh = {
    x, y, ang, spd: o.spd || s.spd, life: o.life || s.life, t: 0, r0: s.size * (o.size || 1), r: 0, dmg: o.dmg, pol: o.pol,
    pierce: o.rail ? 99 : s.pierce, bounce: s.bounce, split: o.split === undefined ? s.split : o.split, frag: o.frag === undefined ? s.frag : o.frag,
    hom: s.homing + (o.hom || 0), hit: o.skip ? new Set([o.skip]) : null, ret: false, sgn: (R.shotN++ & 1) ? 1 : -1,
    burst: !!o.burst, ex: o.ex || 0, beam: (s.beam > 0 && !o.proj) || !!o.rail, kid: !!o.kid, dead: false
  };
  sh.r = sh.r0;
  R.shots.push(sh);
  return sh;
}

// Auto-aim: if an enemy lies within 25 degrees of where the pilot is pointing (enough that
// eight-way aiming can reach anything), fire at it instead, leading it a little. Enemies the
// shot can actually hurt are preferred; among those, the nearest wins.
function autoAim(ang) {
  const P = R.P, s = P.stats, cone = (25 + 10 * (s.autoaim - 1)) * Math.PI / 180;
  let best = null, bs = 1e9;
  for (const e of R.enemies) {
    if (e.dead || e.spawn > 0) continue;
    const d = hyp(e.x - P.x, e.y - P.y);
    if (Math.abs(angDiff(ang, Math.atan2(e.y - P.y, e.x - P.x))) > cone) continue;
    const score = d + (polMul(P.pol, e) <= 0 ? 5000 : 0);
    if (score < bs) { bs = score; best = e; }
  }
  P.lockOn = best; P.aimT = best ? .25 : 0;
  if (!best) return ang;
  const t = Math.min(.5, hyp(best.x - P.x, best.y - P.y) / s.spd) * (s.beam ? 0 : 1);
  return Math.atan2(best.y + best.vy * t - P.y, best.x + best.vx * t - P.x);
}

function fireVolley(ang) {
  if (R.P.stats.autoaim) ang = autoAim(ang);
  // charged shot: whatever built up while the trigger was released goes into this volley
  const P = R.P, s = P.stats, cs = s.chargeshot ? P.cs : 0, d = shotDmg() * (1 + 3 * s.chargeshot * cs), rad = Math.PI / 180;
  P.cs = 0; if (P.fcN > 0) P.fcN--;
  let ox = P.x, oy = P.y, dm = 1; // origin and damage scale: the afterimage replays the pattern from elsewhere
  const emit = a => {
    a += rand(-s.inacc, s.inacc) * rad;
    const pol = s.dichro && (P.dn++ & 1) ? P.pol ^ 1 : P.pol;
    spawnShot(ox + Math.cos(a) * 12, oy + Math.sin(a) * 12, a, { dmg: d * dm, pol, size: 1 + cs });
    if (dm === 1 && s.echo && chance(Math.min(.9, s.echo))) P.vq.push({ t: .12, a, one: true });
  };
  const n = s.count;
  const pattern = () => {
  if (s.ring) for (let i = 0; i < n; i++) emit(ang + i * TAU / n);
  else { const sp = Math.min(s.spread * rad, 2.9 / Math.max(1, n - 1)); for (let i = 0; i < n; i++) emit(ang + (i - (n - 1) / 2) * sp); }
  for (let i = 0; i < s.back; i++) emit(ang + Math.PI + (i - (s.back - 1) / 2) * .16);
  for (let i = 0; i < s.side; i++) { emit(ang + Math.PI / 2 + i * .16); emit(ang - Math.PI / 2 - i * .16); }
  };
  pattern();
  if (s.ghost && P.hist.length) { ox = P.hist[0].x; oy = P.hist[0].y; dm = .5 * s.ghost; pattern(); }
  if (s.rail && ++P.railN % 4 === 0) spawnShot(P.x, P.y, ang, { dmg: d * 3 * s.rail, pol: P.pol, size: 1.8, life: s.life * 1.6, rail: true });
  if (s.blade && P.bladeCd <= 0) slash(ang);
  if (s.recoil) { P.kx -= Math.cos(ang) * 130 * s.recoil; P.ky -= Math.sin(ang) * 130 * s.recoil; }
  if (s.dynamo) spendCharge(1.5 * s.dynamo);
  AU.sfx('shoot', P.pol);
}

// melee arc in front of the ship: hurts enemies, cuts bullets of either colour
function slash(ang) {
  const P = R.P, s = P.stats, d = shotDmg() * 1.6 * s.blade, rad = 82;
  const inArc = (x, y, r) => hyp(x - P.x, y - P.y) < rad + r && Math.abs(angDiff(ang, Math.atan2(y - P.y, x - P.x))) < 1.15;
  P.bladeCd = .45;
  for (const e of R.enemies) if (!e.dead && e.spawn <= 0 && inArc(e.x, e.y, e.r)) damageEnemy(e, d * (e.pol !== P.pol ? s.oppMul : s.sameMul));
  for (const b of R.bullets) if (!b.dead && inArc(b.x, b.y, 4)) { b.dead = true; fxParts(b.x, b.y, PAL.pc[b.pol], 2, 90); }
  R.slashes.push({ x: P.x, y: P.y, ang, t: 0, pol: P.pol });
}

function updateFire(dt) {
  const P = R.P, s = P.stats;
  for (let i = P.vq.length - 1; i >= 0; i--) {
    const q = P.vq[i];
    if ((q.t -= dt) > 0) continue;
    P.vq.splice(i, 1);
    if (q.one) spawnShot(P.x, P.y, q.a, { dmg: shotDmg(), pol: P.pol }); else fireVolley(P.ang);
  }
  P.fireCd -= dt; P.bladeCd -= dt;
  P.heat = clamp(P.heat + (P.firing ? dt / 2 : -dt * 2), 0, 1);
  P.shockCd -= dt; P.aimT -= dt;
  if (P.firing) P.fireHeld += dt;
  else {
    // aftershock: letting go after sustained fire throws out a ring
    if (s.aftershock && P.fireHeld > .6 && P.shockCd <= 0) {
      P.shockCd = .8;
      for (let i = 0, n = 6 + 6 * s.aftershock; i < n; i++) spawnShot(P.x, P.y, P.ang + i * TAU / n, { dmg: shotDmg() * .8, pol: P.pol });
      fxRing(P.x, P.y, .02, 400, .3);
    }
    P.fireHeld = 0;
    if (s.chargeshot) P.cs = Math.min(1, P.cs + dt / 1.2);
  }
  if (P.rateBuff > 0) P.rateBuff -= dt;
  if (!P.firing || P.fireCd > 0) return;
  let rate = s.rate;
  if (s.turret) rate *= 1 + s.turret * (P.still > .25 ? .5 : -.15);
  if (P.rateBuff > 0) rate *= 1.3;
  if (P.rageT > 0) rate *= 1 + .8 * s.rage;
  if (s.spinup) rate *= 1 + s.spinup * (-.4 + 1.7 * P.heat);
  P.fireCd = (1 + .7 * s.volley) / Math.max(.3, rate);
  fireVolley(P.ang);
  for (let i = 1; i <= s.volley; i++) P.vq.push({ t: i * .07 });
}

// Secondary weapons run on their own clocks and fire whether or not the trigger is held.
function updateSecondary(dt) {
  const P = R.P, s = P.stats;
  for (let i = 0; i < s.drone; i++) {
    const d = P.drones[i] || (P.drones[i] = { x: P.x, y: P.y, cd: 0, ang: 0 });
    const a = P.face + Math.PI + (i - (s.drone - 1) / 2) * .9, k = Math.min(1, 8 * dt);
    d.x = lerp(d.x, P.x + Math.cos(a) * 40, k); d.y = lerp(d.y, P.y + Math.sin(a) * 40, k);
    const t = nearestEnemy(d.x, d.y, 520, null, noHurt(P.fus.twin ? P.pol ^ 1 : P.pol));
    if (t) d.ang = Math.atan2(t.y - d.y, t.x - d.x); else d.ang = P.face;
    if ((d.cd -= dt) <= 0 && t) {
      d.cd = 2 / s.rate;
      spawnShot(d.x, d.y, d.ang + rand(-s.inacc, s.inacc) * Math.PI / 180, { dmg: shotDmg() * .6, pol: P.fus.twin ? P.pol ^ 1 : P.pol });
    }
  }
  if (s.missile && (P.misCd -= dt) <= 0 && nearestEnemy(P.x, P.y, 2000)) {
    P.misCd = 2.4;
    for (let i = 0; i < s.missile; i++)
      spawnShot(P.x, P.y, P.ang + Math.PI + rand(-.9, .9), { dmg: shotDmg() * 3, pol: P.pol, hom: 6, spd: 400, life: 3, size: 1.6, ex: 70, proj: true, burst: true });
  }
  if (s.mine) {
    if ((P.mineCd -= dt) <= 0 && !R.room.cleared && hyp(P.vx, P.vy) > s.move * .3 && R.mines.length < 10) {
      P.mineCd = 1.4 / s.mine; R.mines.push({ x: P.x, y: P.y, t: 0 });
    }
  }
  for (let i = R.mines.length - 1; i >= 0; i--) {
    const m = R.mines[i]; m.t += dt;
    if (P.fus.sink) for (const e of R.enemies) { const d = hyp(e.x - m.x, e.y - m.y); if (!e.boss && e.spawn <= 0 && d < 180 && d > 4) { e.x -= (e.x - m.x) / d * 80 * dt; e.y -= (e.y - m.y) / d * 80 * dt; } }
    let go = m.t > 10;
    if (m.t > .4) for (const e of R.enemies) if (!e.dead && e.spawn <= 0 && hyp(e.x - m.x, e.y - m.y) < 46 + e.r) { go = true; break; }
    if (go) { R.mines.splice(i, 1); explodeAt(m.x, m.y, 95, shotDmg() * 4); AU.sfx('kill'); }
  }
  // afterimage: remember where the ship was 0.8s ago
  P.hist.push({ x: P.x, y: P.y, t: R.time });
  while (P.hist.length > 1 && P.hist[0].t < R.time - .8) P.hist.shift();
  // flail: a spiked ball on a spring; it hits as hard as it is moving
  if (s.flail) {
    const F = P.fl;
    F.vx += ((P.x - F.x) * 34 - F.vx * 2.2) * dt; F.vy += ((P.y - F.y) * 34 - F.vy * 2.2) * dt; F.x += F.vx * dt; F.y += F.vy * dt;
    const dps = shotDmg() * s.flail * clamp(hyp(F.vx, F.vy) / 250, .25, 3) * 6;
    for (const e of R.enemies) if (!e.dead && e.spawn <= 0 && hyp(e.x - F.x, e.y - F.y) < e.r + 13) damageEnemy(e, dps * dt * (e.pol !== P.pol ? s.oppMul : s.sameMul));
    for (const b of R.bullets) if (!b.dead && hyp(b.x - F.x, b.y - F.y) < b.r + 12) { b.dead = true; fxParts(b.x, b.y, PAL.pc[b.pol], 2, 90); }
  }
  // singularity: drifts out, drags enemies and bullets in, then detonates
  if (s.orb && (P.orbCd -= dt) <= 0 && nearestEnemy(P.x, P.y, 2000)) {
    P.orbCd = 6 / s.orb; R.orbs.push({ x: P.x, y: P.y, vx: Math.cos(P.ang) * 150, vy: Math.sin(P.ang) * 150, t: 0 }); AU.sfx('flip', 1);
  }
  for (let i = R.orbs.length - 1; i >= 0; i--) {
    const o = R.orbs[i]; o.t += dt;
    o.x = clamp(o.x + o.vx * dt, BX0 + 20, BX1 - 20); o.y = clamp(o.y + o.vy * dt, BY0 + 20, BY1 - 20); o.vx *= 1 - dt; o.vy *= 1 - dt;
    for (const e of R.enemies) { const d = hyp(e.x - o.x, e.y - o.y); if (!e.boss && e.spawn <= 0 && d < 210 && d > 6) { e.x -= (e.x - o.x) / d * 130 * dt; e.y -= (e.y - o.y) / d * 130 * dt; } }
    for (const b of R.bullets) { const dx = o.x - b.x, dy = o.y - b.y, d = hyp(dx, dy); if (d < 210 && d > 1) { b.vx += dx / d * 520 * dt; b.vy += dy / d * 520 * dt; if (d < 14) b.dead = true; } }
    if (o.t > 2.6) { R.orbs.splice(i, 1); explodeAt(o.x, o.y, 125, shotDmg() * 6); fxRing(o.x, o.y, .08, 600, .6); fxShake(8); AU.sfx('boom'); }
  }
  // corona: above 60% charge the ship scorches whatever is close
  if (s.corona && chgFrac() >= .6) {
    const rad = s.absorbR * 2.6, dps = s.dmg * s.rate * .5 * s.corona;
    for (const e of R.enemies) if (!e.dead && e.spawn <= 0 && hyp(e.x - P.x, e.y - P.y) < rad + e.r) damageEnemy(e, dps * dt * polMul(P.pol, e));
  }
  if (s.tesla && (P.teslaCd -= dt) <= 0) {
    const seen = new Set(); let fx = P.x, fy = P.y, d = shotDmg() * 1.2;
    for (let i = 0; i < 1 + s.tesla + s.chain; i++) {
      const t = nearestEnemy(fx, fy, i ? 230 : 260, seen, noHurt(P.pol));
      if (!t) break;
      if (!i) P.teslaCd = .9;
      seen.add(t); R.arcs.push({ x0: fx, y0: fy, x1: t.x, y1: t.y, t: 0, pol: P.pol });
      damageEnemy(t, d * (t.pol !== P.pol ? s.oppMul : s.sameMul)); d *= .7; fx = t.x; fy = t.y;
    }
  }
}

function releaseBurst() {
  const P = R.P, s = P.stats, c = Math.min(chg(), s.chargeMax), f = c / s.chargeMax;
  if (c < 20) { AU.sfx('deny'); return false; }
  const n = Math.max(2, Math.round(c / 100 * 12 * s.burstN)), d = shotDmg() * 1.6 * s.burstDmg * (1 + .25 * s.bfocus);
  for (const o of R.room.obs.filter(q => q.burst)) // the burst shatters barriers and crates nearby
    if (hyp(clamp(P.x, o.x, o.x + o.w) - P.x, clamp(P.y, o.y, o.y + o.h) - P.y) < 240) breakBlock(o);
  if (s.detonate) for (const sh of R.shots) { // every shot in flight goes off where it is
    if (sh.dead) continue;
    explodeAt(sh.x, sh.y, 55, sh.dmg * 1.5 * s.detonate, null, sh.pol); sh.dead = true;
  }
  for (let i = 0; i < n; i++) {
    // focus turns the ring into a forward cone
    const a = s.bfocus ? P.ang + (n > 1 ? i / (n - 1) - .5 : 0) * .8 : P.ang + i * TAU / n;
    spawnShot(P.x, P.y, a, { dmg: d, pol: P.pol, hom: 7, spd: 520, life: Math.max(2.2, s.life), size: 1.5, burst: true, proj: true, ex: 45 * s.detonate });
  }
  if (s.bwave) {
    // shockwave: the classic bomb, wiping bullets and shoving enemies back
    const rad = (150 + 170 * f) * Math.sqrt(s.bwave);
    for (const b of R.bullets) if (hyp(b.x - P.x, b.y - P.y) < rad) { b.dead = true; fxParts(b.x, b.y, PAL.pc[b.pol], 1, 120); }
    for (const e of R.enemies) {
      const dd = hyp(e.x - P.x, e.y - P.y) || 1;
      if (e.dead || e.spawn > 0 || dd > rad + e.r) continue;
      if (!e.boss) { e.vx += (e.x - P.x) / dd * 500; e.vy += (e.y - P.y) / dd * 500; }
      damageEnemy(e, shotDmg() * 2.5 * s.bwave);
    }
    R.booms.push({ x: P.x, y: P.y, r: rad, t: 0 }); fxRing(P.x, P.y, .1, rad * 4, .4);
  }
  if (s.bpolar) {
    const rad = 220 + 160 * s.bpolar;
    for (const b of R.bullets) if (!b.fix && b.pol !== P.pol && hyp(b.x - P.x, b.y - P.y) < rad) { b.pol = P.pol; fxParts(b.x, b.y, PAL.pc[b.pol], 1, 80); }
  }
  if (s.baegis) P.inv = Math.max(P.inv, (.6 + 1.2 * f) * s.baegis);
  if (!P.preview) { P.charge -= c; R.st.bursts++; mAdd('bursts'); }
  fxRing(P.x, P.y, .07, 700, .7); fxShake(8); AU.sfx('burst');
  return true;
}

// pol: the colour of the blast, if it came from a shot; colourless blasts hurt everything
function explodeAt(x, y, rad, dmg, skip, pol) {
  const st = R.P.stats;
  for (const e of R.enemies) if (e !== skip && !e.dead && hyp(e.x - x, e.y - y) < rad + e.r) {
    damageEnemy(e, dmg * (pol === undefined ? 1 : polMul(pol, e)));
    if (R.P.fus.afterburn) { e.burn = 3; e.burnDps = Math.max(e.burnDps, st.burn * st.dmg * .35); }
  }
  R.booms.push({ x, y, r: rad, t: 0 });
  fxRing(x, y, .012, rad * 5, .25);
}

function hitEnemy(sh, e) {
  const s = R.P.stats, f = sh.t / sh.life;
  if (e.def.mirror && sh.pol === e.pol) {
    if (chance(.5)) eb(sh.x, sh.y, sh.ang + Math.PI + rand(-.3, .3), 200, sh.pol, 5);
    fxParts(sh.x, sh.y, '#ffffff', 3, 160); e.fl = .04; killShot(sh);
    return;
  }
  let d = sh.dmg;
  if (s.grow) d *= .7 + s.grow * 1.5 * f;
  if (s.pblank) d *= Math.max(.3, 1 + s.pblank * (.9 - 1.5 * f));
  if (s.accel) d *= Math.pow(.6 + 1.2 * f, s.accel);
  if (sh.ret) d *= 1 + .4 * s.boom;
  const crit = chance(s.crit);
  if (crit) d *= s.critMul;
  const base = d, m = polMul(sh.pol, e);
  if (m <= 0) {
    // wrong colour: the shot glances off and none of its effects apply
    if (s.slip) { (sh.hit || (sh.hit = new Set())).add(e); return; } // slips straight through instead
    e.df = .14; fxParts(sh.x, sh.y, PAL.pc[e.pol], 2, 120); AU.sfx('tink');
    if (sh.pierce > 0) { sh.pierce--; (sh.hit || (sh.hit = new Set())).add(e); } else killShot(sh);
    return;
  }
  d *= m;
  if (R.P.fus.shock && e.burn > 0 && e.slowT > 0) d *= 1.5;
  if (!e.boss) { e.vx += Math.cos(sh.ang) * s.knock; e.vy += Math.sin(sh.ang) * s.knock; }
  if (s.burn) { e.burn = 3; e.burnDps = Math.max(e.burnDps, s.burn * s.dmg * .35); }
  if (s.slow) { e.slowT = 1.6; e.slowF = 1 / (1 + .6 * s.slow); }
  damageEnemy(e, d, crit);
  fxParts(sh.x, sh.y, PAL.pc[sh.pol], 2, 140);
  AU.sfx('hit');
  if (s.explode || sh.ex) explodeAt(sh.x, sh.y, (s.explode + sh.ex) * (.7 + sh.r / 16), base * .6, e, sh.pol);
  if (s.chain) {
    const seen = new Set([e]); let from = e;
    for (let i = 0; i < s.chain; i++) {
      const t = nearestEnemy(from.x, from.y, 230, seen);
      if (!t) break;
      seen.add(t); R.arcs.push({ x0: from.x, y0: from.y, x1: t.x, y1: t.y, t: 0, pol: sh.pol });
      damageEnemy(t, base * .5 * polMul(sh.pol, t)); from = t;
    }
  }
  if (sh.split > 0) for (const k of [-.5, .5])
    spawnShot(sh.x, sh.y, sh.ang + k, { dmg: sh.dmg * .55, pol: sh.pol, split: sh.split - 1, skip: e, size: .8, proj: !sh.beam });
  if (s.refract) { // carries on in the other colour, so it can only hurt each enemy once
    sh.pol ^= 1; (sh.hit || (sh.hit = new Set())).add(e); sh.dmg *= .85 * (1 + s.pierceGrow);
  } else if (sh.pierce > 0) { sh.pierce--; (sh.hit || (sh.hit = new Set())).add(e); sh.dmg *= 1 + s.pierceGrow; }
  else killShot(sh);
}

function killShot(sh) {
  if (sh.dead) return;
  sh.dead = true;
  for (let i = 0; i < sh.frag * 3; i++)
    spawnShot(sh.x, sh.y, rand(TAU), { dmg: sh.dmg * .35, pol: sh.pol, split: 0, frag: 0, size: .7, life: .35, proj: !sh.beam, kid: true });
}

// Advance one shot by dt: steer, move, bounce, hit.
function stepShot(sh, dt, scan) {
  const P = R.P, s = P.stats;
  sh.t += dt;
  if (sh.tu) { if (sh.t >= sh.life) killShot(sh); else tubeStep(sh, dt); return; } // riding a wormhole
  const f = sh.t / sh.life;
  if (f >= 1) {
    if (s.flak && !sh.kid) explodeAt(sh.x, sh.y, 52 * Math.sqrt(s.flak) * (.7 + sh.r / 16), sh.dmg * .5, null, sh.pol);
    killShot(sh); return;
  }
  sh.r = sh.r0 * (1 + s.grow * f * 1.2);
  if (sh.hom) { const t = nearestEnemy(sh.x, sh.y, 420, sh.hit, noHurt(sh.pol)); if (t) sh.ang = turnTo(sh.ang, Math.atan2(t.y - sh.y, t.x - sh.x), sh.hom * dt); }
  if (s.curve) sh.ang += s.curve * sh.sgn * dt;
  if (s.tether && hyp(P.x - sh.x, P.y - sh.y) > 70) sh.ang = turnTo(sh.ang, Math.atan2(P.y - sh.y, P.x - sh.x), s.tether * 2.6 * dt);
  if (s.boom && !sh.ret && f > .5) { sh.ret = true; sh.hit = null; sh.ang = Math.atan2(P.y - sh.y, P.x - sh.x); }
  const v = sh.spd * (s.accel ? Math.pow(.3 + 2 * f, s.accel) : 1);
  let vx = Math.cos(sh.ang) * v, vy = Math.sin(sh.ang) * v;
  for (const w of R.wells) {
    const dx = w.x - sh.x, dy = w.y - sh.y, d = hyp(dx, dy) || 1, wf = wellF(w, d);
    if (wf) { const g = w.str * 6 * wf * dt; vx += dx / d * g; vy += dy / d * g; sh.ang = Math.atan2(vy, vx); }
  }
  if (s.wave) { const lat = sh.sgn * 196 * s.wave * Math.cos(14 * sh.t); vx -= Math.sin(sh.ang) * lat; vy += Math.cos(sh.ang) * lat; }
  sh.x += vx * dt; sh.y += vy * dt;
  for (const fd of R.room.fields) if ((sh.x - fd.x) * (sh.x - fd.x) + (sh.y - fd.y) * (sh.y - fd.y) < fd.r * fd.r) sh.pol = fd.pol;
  if (R.flow) { sh.x += R.flow.x * 80 * dt; sh.y += R.flow.y * 80 * dt; }
  teleport(sh);
  for (const sw of R.room.switches) if (sw.cd <= 0 && hyp(sw.x - sh.x, sw.y - sh.y) < 16 + sh.r) { // a hit swaps every gate's colour
    sw.cd = .5; for (const g of R.room.gates) g.pol ^= 1;
    fxRing(sw.x, sw.y, .03, 500, .4); AU.sfx('swap');
    if (sh.pierce > 0) sh.pierce--; else { killShot(sh); return; }
  }
  // walls and blocks
  let nx = 0, ny = 0;
  if (sh.x < BX0) { nx = 1; sh.x = BX0; } else if (sh.x > BX1) { nx = -1; sh.x = BX1; }
  if (sh.y < BY0) { ny = 1; sh.y = BY0; } else if (sh.y > BY1) { ny = -1; sh.y = BY1; }
  if ((nx || ny) && R.room.hidden) hitSecret(sh);
  if (!nx && !ny && !s.phase) for (const o of R.room.obs) { const h = circRect(sh.x, sh.y, sh.r, o); if (h) { nx = h.nx; ny = h.ny; sh.x += h.x; sh.y += h.y; if (o.burst && sh.burst) breakBlock(o); break; } }
  if (!nx && !ny && !s.phase) for (const g of R.room.gates) if (g.pol !== sh.pol) { const h = circRect(sh.x, sh.y, sh.r, g); if (h) { nx = h.nx; ny = h.ny; sh.x += h.x; sh.y += h.y; break; } }
  if (nx || ny) {
    if (sh.bounce <= 0) { killShot(sh); return; }
    sh.bounce--;
    let cx = Math.cos(sh.ang), cy = Math.sin(sh.ang);
    if (nx && cx * nx < 0) cx = -cx;
    if (ny && cy * ny < 0) cy = -cy;
    sh.ang = Math.atan2(cy, cx); sh.dmg *= 1 + s.ricoGrow; sh.hit = null;
    if (P.fus.rain && sh.frag > 0) for (let i = 0; i < 2; i++) spawnShot(sh.x, sh.y, rand(TAU), { dmg: sh.dmg * .35, pol: sh.pol, split: 0, frag: 0, size: .7, life: .35, proj: !sh.beam, kid: true });
    fxParts(sh.x, sh.y, PAL.pc[sh.pol], 2, 100);
  }
  const im = R.room.wraps.length ? holeImage(sh.x, sh.y) : null, ix = im ? im.x : 0, iy = im ? im.y : 0; // the shot's shadow through a wormhole
  for (const e of R.enemies) {
    if (e.dead || e.spawn > 0 || (sh.hit && sh.hit.has(e))) continue;
    const dx = e.x - sh.x, dy = e.y - sh.y, rr = e.r + sh.r;
    if (dx * dx + dy * dy < rr * rr || (im && (e.x - ix) * (e.x - ix) + (e.y - iy) * (e.y - iy) < rr * rr)) { hitEnemy(sh, e); if (sh.dead) return; }
    else if (s.grav && !e.boss && dx * dx + dy * dy < 150 * 150) { const d = hyp(dx, dy); e.x -= dx / d * s.grav * 45 * dt; e.y -= dy / d * s.grav * 45 * dt; }
  }
  if (!scan) return;
  // enemy bullets: gravity rounds drag them along, erasers cancel them
  for (const b of R.bullets) {
    const dx = b.x - sh.x, dy = b.y - sh.y, d2 = dx * dx + dy * dy;
    if (s.grav && d2 < 110 * 110 && d2 > 1) { const d = Math.sqrt(d2); b.vx -= dx / d * s.grav * 300 * dt; b.vy -= dy / d * s.grav * 300 * dt; }
    if (s.convert && b.pol !== sh.pol && !b.noCv && d2 < (sh.r + b.r + 4) * (sh.r + b.r + 4)) {
      if (chance(Math.min(1, .5 * s.convert))) { b.pol = sh.pol; fxParts(b.x, b.y, PAL.pc[b.pol], 2, 70); } else b.noCv = true;
    }
    if (s.eraser && !b.noEr && !b.dead && d2 < (sh.r + b.r + 2) * (sh.r + b.r + 2)) {
      if (chance(Math.min(1, .34 * s.eraser))) {
        b.dead = true; fxParts(b.x, b.y, PAL.pc[b.pol], 2, 90);
        if (sh.pierce > 0) sh.pierce--; else { killShot(sh); return; }
      } else b.noEr = true;
    }
  }
}

function updateShots(dt) {
  const P = R.P, s = P.stats, scan = s.eraser > 0 || s.grav > 0 || s.convert > 0;
  for (let n = 0; n < R.shots.length; n++) {
    const sh = R.shots[n];
    if (sh.dead) continue;
    if (!sh.beam) { stepShot(sh, dt, scan); continue; }
    // beam: run the whole flight now and keep the path as a fading trail
    const step = Math.max(sh.life / 400, Math.min(1 / 90, 7 / sh.spd)), pts = [sh.x, sh.y];
    const trail = p => { if (p.length >= 4 && R.trails.length < 160) R.trails.push({ pts: p, pol: sh.pol, w: Math.max(2, sh.r * .8), t: 0 }); };
    let cur = pts;
    for (let i = 0; !sh.dead && i < 420; i++) {
      const px = sh.x, py = sh.y;
      stepShot(sh, step, scan);
      if (hyp(sh.x - px, sh.y - py) > 60) { trail(cur); cur = [sh.x, sh.y]; } // it teleported: start a new piece
      else if (!sh.tu && (i % 2 || sh.dead)) cur.push(sh.x, sh.y);
    }
    killShot(sh);
    trail(cur);
  }
  if (R.shots.some(q => q.dead)) R.shots = R.shots.filter(q => !q.dead);

  // arc web: lightning strung between neighbouring shots (and the tips of fresh beams)
  R.webs = [];
  if (s.arcweb) {
    const nodes = R.shots.map(q => q).concat(R.trails.map(tr => ({ x: tr.pts[tr.pts.length - 2], y: tr.pts[tr.pts.length - 1], pol: tr.pol })));
    const reach = 150 * Math.sqrt(s.arcweb), dmg = s.dmg * 1.5 * s.arcweb * dt;
    for (let i = 0; i < nodes.length && R.webs.length < 240; i++) for (let j = i + 1; j <= i + 2 && j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (hyp(a.x - b.x, a.y - b.y) > reach) continue;
      R.webs.push(a.x, a.y, b.x, b.y, a.pol);
      for (const e of R.enemies) if (!e.dead && e.spawn <= 0 && segDist(e.x, e.y, a.x, a.y, b.x, b.y) < e.r + 5) damageEnemy(e, dmg * polMul(a.pol, e));
    }
  }

  // orbitals: block any bullet, grind anything they touch
  if (s.orbit) {
    const dps = s.dmg * s.rate * .35;
    for (let i = 0; i < s.orbit; i++) {
      const a = R.time * 2.6 + i * TAU / s.orbit, ox = P.x + Math.cos(a) * 48, oy = P.y + Math.sin(a) * 48;
      for (const b of R.bullets) if (!b.dead && hyp(b.x - ox, b.y - oy) < b.r + 9) { b.dead = true; fxParts(b.x, b.y, PAL.pc[b.pol], 2, 90); }
      for (const e of R.enemies) if (!e.dead && e.spawn <= 0 && hyp(e.x - ox, e.y - oy) < e.r + 9) damageEnemy(e, dps * dt * (e.pol !== P.pol ? s.oppMul : s.sameMul));
    }
  }
}

'use strict';
// Every upgrade is a pure function over one flat stat block, and every stat is read
// somewhere in the weapon/player pipeline, so upgrades always stack and never no-op.
function baseStats() {
  return {
    // weapon
    dmg: 10, rate: 4, spd: 640, life: 0.85, size: 5, count: 1, spread: 9, inacc: 2.5, ring: 0,
    pierce: 0, bounce: 0, homing: 0, wave: 0, curve: 0, boom: 0, split: 0, frag: 0, explode: 0, chain: 0,
    burn: 0, slow: 0, crit: 0.05, critMul: 2, knock: 50, back: 0, side: 0, orbit: 0, accel: 0, grow: 0,
    pblank: 0, tether: 0, grav: 0, volley: 0, echo: 0, eraser: 0, dichro: 0, recoil: 0, ricoGrow: 0,
    pierceGrow: 0, kinetic: 0, turret: 0, berserk: 0, oppMul: 2, sameMul: 0, // same-colour hits are deflected unless an upgrade says otherwise
    beam: 0, drone: 0, missile: 0, mine: 0, tesla: 0,
    spinup: 0, blade: 0, rail: 0, orb: 0, flak: 0, convert: 0, ghost: 0, flail: 0, swarm: 0, map: 0,
    // pilot
    maxHp: 4, move: 300, hitR: 5, absorbR: 26, magnet: 90, luck: 0, chargeMax: 100, gain: 1, burstN: 1,
    burstDmg: 1, nova: 0, flipLock: 0, reflect: 0, graze: 0, flipSlow: 0, thorns: 0, shield: 0, vamp: 0,
    greed: 0, inv: 1.1, bulletSpd: 1
  };
}

// tier 0 = plain good, 1 = good with a cost, 2 = situational / synergy, 3 = cursed
const TIER_COL = ['#7dffb0', '#ffd84a', '#b98cff', '#ff5468'];
const TIER_SIDES = [0, 4, 6, 3];
const UPS = [], UP = {};
function U(id, tier, ic, fn, stat, n) { const u = { id, tier, icon: ic, fn, stat, n }; UPS.push(u); UP[id] = u; }

// --- tier 0 ---
U('dmg', 0, 'P5,1,9,5,5,9,1,5;D5,5,1.6', s => { s.dmg *= 1.25; });
U('rate', 0, 'L2,2,5,5,2,8;L5,2,8,5,5,8', s => { s.rate *= 1.2; });
U('vel', 0, 'A1,5,9,5;L1,2.5,4,2.5;L1,7.5,4,7.5', s => { s.spd *= 1.25; s.dmg *= 1.05; });
U('range', 0, 'L1,5,9,5;L1,3,1,7;L9,3,9,7', s => { s.life *= 1.35; });
U('cal', 0, 'C5,5,4;D5,5,2', s => { s.size *= 1.3; s.dmg *= 1.1; });
U('hp', 0, 'P5,1.5,8.5,5,5,8.5,1.5,5;L5,3.5,5,6.5;L3.5,5,6.5,5', s => { s.maxHp += 1; });
U('move', 0, 'L2,8,5,2,8,8;L3.5,8,5,5,6.5,8', s => { s.move *= 1.12; });
U('crit', 0, 'C5,5,3;L5,.5,5,3.5;L5,6.5,5,9.5;L.5,5,3.5,5;L6.5,5,9.5,5', s => { s.crit += 0.1; s.critMul += 0.25; });
U('pierce', 0, 'A1,5,9,5;L4,2,4,8;L6.5,2,6.5,8', s => { s.pierce += 1; });
U('bounce', 0, 'L1,2,5,8,9,2;L1,9,9,9', s => { s.bounce += 1; });
U('homing', 0, 'L1,9,2,5,5,3;A5,3,7,2.6;C8.2,2.2,1.3', s => { s.homing += 1.6; });
U('cap', 0, 'F6,1,2,5.5,5,5.5,4,9,8,4.5,5,4.5', s => { s.gain *= 1.35; });
U('magnet', 0, 'L2,2,2,5.5;L8,2,8,5.5;R5,5.5,3,0,180;L1,2,3,2;L7,2,9,2', s => { s.magnet *= 1.6; s.luck += 1; }, 'shards', 60);
U('small', 0, 'C5,5,4;D5,5,1;A1,1,3,3;A9,9,7,7', s => { s.hitR *= 0.8; s.absorbR *= 1.1; }, 'grazes', 50);
U('shield', 0, 'P5,1,9,3,9,6,5,9,1,6,1,3', s => { s.shield += 1; }, 'nohit', 10);
U('burst', 0, 'D5,5,1.5;A5,5,5,1;A5,5,9,5;A5,5,5,9;A5,5,1,5', s => { s.burstN *= 1.4; s.burstDmg *= 1.2; }, 'bursts', 10);

// --- tier 1 ---
U('multi', 1, 'A2,8,2,2;A5,8,5,2;A8,8,8,2', s => { s.count += 1; s.dmg *= 0.85; });
U('heavy', 1, 'F2.5,2.5,7.5,2.5,7.5,7.5,2.5,7.5', s => { s.dmg *= 1.6; s.rate *= 0.75; s.size *= 1.2; s.knock *= 1.5; });
U('mini', 1, 'D2,5,.8;D4,5,.8;D6,5,.8;D8,5,.8;L1,3,9,3;L1,7,9,7', s => { s.rate *= 1.6; s.dmg *= 0.7; s.inacc += 5; });
U('shotgun', 1, 'A5,9,1,3;A5,9,3.5,1.5;A5,9,6.5,1.5;A5,9,9,3', s => { s.count += 3; s.spread += 4; s.life *= 0.6; s.dmg *= 0.8; });
U('explode', 1, 'P5,.5,6.2,3.5,9.5,3,7.2,5.5,9,8.5,5.8,7,5,9.5,4,7,1,8.5,2.8,5.5,.5,3,3.8,3.5', s => { s.explode += 40; s.rate *= 0.88; });
U('back', 1, 'A5,5,5,1;A5,5,5,9', s => { s.back += 1; });
U('wave', 1, 'L1,5,2,3,3,2.4,4,3,5,5,6,7,7,7.6,8,7,9,5', s => { s.wave += 1; s.size *= 1.2; s.dmg *= 1.15; });
U('glass', 1, 'P5,1,9,5,5,9,1,5;L5,1,4,4,6,6,5,9', s => { s.dmg *= 1.5; s.maxHp = Math.max(1, s.maxHp - 1); }, 'hits', 20);
U('sniper', 1, 'C5,5,3.5;L5,.5,5,9.5;L.5,5,9.5,5;D5,5,.8', s => { s.spd *= 1.6; s.dmg *= 1.3; s.rate *= 0.8; s.inacc *= 0.2; }, 'kills', 150);
U('overclock', 1, 'C5,5,4;L5,5,5,2.2;L5,5,7.2,6;L2,1,3,2;L8,1,7,2', s => { s.rate *= 1.3; s.move *= 1.12; s.hitR *= 1.3; }, 'rooms', 30);
U('boom', 1, 'P2,2,7.5,2.5,8,8,5.5,4.5', s => { s.boom += 1; s.life *= 1.3; s.spd *= 0.9; }, 'runs', 3);
U('split', 1, 'L5,9,5,5;A5,5,2,1.5;A5,5,8,1.5', s => { s.split += 1; s.dmg *= 0.9; }, 'kills', 400);
U('chain', 1, 'L1,2,4,4,3,6,7,5,6,8,9,8;D1,2,.9;D9,8,.9', s => { s.chain += 2; s.rate *= 0.92; }, 'chain', 5);
U('burn', 1, 'P5,1,7.5,5,6.5,8.5,5,9.5,3.5,8.5,2.5,5,4,6,4.2,3.2', s => { s.burn += 1; s.dmg *= 0.92; }, 'bosses', 2);
U('cryo', 1, 'L5,1,5,9;L1.5,3,8.5,7;L1.5,7,8.5,3', s => { s.slow += 1; s.spd *= 0.9; }, 'bosses', 3);
U('side', 1, 'A5,5,1,5;A5,5,9,5;A5,5,5,1', s => { s.side += 1; s.dmg *= 0.95; }, 'taken', 15);
U('orbit', 1, 'C5,5,3.5;D5,5,1.2;D8.5,5,1;D1.5,5,1', s => { s.orbit += 1; }, 'absorbed', 400);
U('grow', 1, 'D1.5,5,.6;D4,5,1.1;D7.5,5,2', s => { s.grow += 1; }, 'stage', 2);
U('pblank', 1, 'D8.5,5,.6;D6,5,1.1;D2.5,5,2', s => { s.pblank += 1; }, 'kills', 800);
U('volley', 1, 'L2,2,4,4,2,6;L4.5,2,6.5,4,4.5,6;L7,2,9,4,7,6;L1,8.5,9,8.5', s => { s.volley += 2; }, 'taken', 30);
U('frag', 1, 'D5,5,1.3;D2,2,.7;D8,2,.7;D2,8,.7;D8,8,.7;D5,1,.5;D5,9,.5', s => { s.frag += 1; s.life *= 0.9; }, 'kills', 1200);
U('battery', 1, 'P2,3,8,3,8,9,2,9;L4,1.5,6,1.5;L4,6,6,6;L5,5,5,7', s => { s.chargeMax *= 1.5; s.burstN *= 1.6; }, 'bursts', 30);
U('nova', 1, 'C5,5,2;C5,5,4.2;D5,5,.8', s => { s.nova += 1; }, 'flips', 150);
U('contrast', 1, 'C5,5,4;F5,1,5,9,3,8.5,1.4,6.8,1,5,1.4,3.2,3,1.5', s => { s.oppMul += 0.6; s.sameMul *= 0.6; }, 'flips', 400);

U('compass', 0, 'C5,5,4;F5,1.8,6.3,5,5,8.2,3.7,5', s => { s.map += 1; s.luck += 1; }, 'rooms', 150);
U('blade', 1, 'R1.5,8.5,7,280,350;R1.5,8.5,4.5,280,350;L1.5,8.5,4,6', s => { s.blade += 1; });
U('spinup', 1, 'R5,4.5,3.3,0,300;L5,4.5,7.4,2.4;L1,9,3,9;L4,9,6.5,9;L7.5,9,9,9', s => { s.spinup += 1; });
U('flak', 1, 'A1,5,4.3,5;C7,5,1.1;C7,5,2.7', s => { s.flak += 1; }, 'secrets', 1);
U('swarm', 1, 'D5,5,1.6;A5,5,1.5,1.5;A5,5,8.5,1.5;A5,5,5,9.4', s => { s.swarm += 1; }, 'kills', 600);
U('rail', 1, 'L1,4,9,4;L1,6,9,6;D5,5,.9;L3,2.5,3,7.5;L7,2.5,7,7.5', s => { s.rail += 1; }, 'bosses', 2);
U('drone', 1, 'P1.5,9,4.5,3,7.5,9;P7,3.5,8.2,1,9.4,3.5', s => { s.drone += 1; });
U('missile', 1, 'A2,8,8,2;L1.5,5.5,1.5,8.5,4.5,8.5;L4,3,7,6', s => { s.missile += 1; }, 'kills', 200);
U('tesla', 1, 'C5,5,4.3;L5.5,1.5,3.5,4.6,6.2,5.2,4.5,8.5', s => { s.tesla += 1; }, 'absorbed', 300);

// --- tier 2 ---
U('flame', 2, 'L1,5,9,1.5;L1,5,9,8.5;R1,5,5,-30,30;R1,5,8,-25,25', s => { s.count += 2; s.rate *= 1.8; s.life *= 0.32; s.spd *= 0.75; s.pierce += 2; s.burn += 1; s.inacc += 11; s.dmg *= 0.42; s.size *= 1.5; });
U('flail', 2, 'L1,9,3,6,4,7.5,6,4.5;P7.5,1,8.4,2.6,10,3,8.6,4,9,5.8,7.5,4.8,6,5.8,6.4,4,5,3,6.6,2.6', s => { s.flail += 1; }, 'minis', 1);
U('ghost', 2, 'P4,2,7,8,1,8;L6,2,9,8;L7.6,2,9.6,6', s => { s.ghost += 1; }, 'runs', 5);
U('convert', 2, 'C2.8,5,1.8;A4.6,5,6.4,5;D8,5,1.8', s => { s.convert += 1; }, 'absorbed', 600);
U('orb', 2, 'D5,5,2;C5,5,3.6;R5,5,4.6,200,300;R5,5,4.6,20,120', s => { s.orb += 1; }, 'stage', 3);
U('beam', 2, 'D1.8,5,1.5;F2,4.2,9.5,4.6,9.5,5.4,2,5.8', s => { s.beam += 1; s.dmg *= 0.8; s.pierce += 1; });
U('mine', 2, 'P5,2.2,7.8,5,5,7.8,2.2,5;D5,5,1;L5,.5,5,2.2;L5,7.8,5,9.5;L.5,5,2.2,5;L7.8,5,9.5,5', s => { s.mine += 1; }, 'rooms', 40);
U('curve', 2, 'R5,5,3.5,0,270;A5,1.5,7,1.5', s => { s.curve += 2.2; s.life *= 1.25; s.dmg *= 1.1; });
U('ring', 2, 'C5,5,1;A5,5,5,.8;A5,5,5,9.2;A5,5,.8,5;A5,5,9.2,5;A5,5,2,2;A5,5,8,8;A5,5,2,8;A5,5,8,2', s => { s.ring += 1; s.count += 5; s.dmg *= 0.75; }, 'bosses', 1);
U('slowshot', 2, 'C5,5,3.5;L5,5,5,3;L5,5,6.5,5;D5,5,.5', s => { s.spd *= 0.5; s.life *= 2.3; s.dmg *= 1.3; }, 'runs', 5);
U('rico', 2, 'L1,1,1,9,9,9;L3,2,6,7,8,4;D8,4,.8', s => { s.bounce += 1; s.ricoGrow += 0.4; }, 'rooms', 60);
U('lance', 2, 'A1,9,9,1;L3,4,6,7;L5,2.5,7.5,5', s => { s.pierce += 1; s.pierceGrow += 0.3; }, 'taken', 50);
U('reflect', 2, 'L7,1,7,9;A1,3,6.5,5;A6.5,5,1,7.5', s => { s.reflect += 1; }, 'absorbed', 800);
U('graze', 2, 'C4,5,2;L8,1,8,9;L6.2,3,6.2,3.6;L6.2,6.4,6.2,7', s => { s.graze += 1; }, 'grazes', 200);
U('eraser', 2, 'C5,5,3.5;L2.5,2.5,7.5,7.5', s => { s.eraser += 1; }, 'absorbed', 2000);
U('dichro', 2, 'C3.5,5,2.5;D6.8,5,2.5', s => { s.dichro += 1; s.oppMul += 0.25; });
U('harmony', 2, 'C3.8,5,2.8;C6.2,5,2.8', s => { s.sameMul += 0.6; }, 'absorbed', 1500);
U('vamp', 2, 'P5,9,1.5,5,3,2,5,3.5,7,2,8.5,5', s => { s.vamp += 1; }, 'hits', 50);
U('kinetic', 2, 'P6,2,9,5,6,8;L1,3.5,4,3.5;L1,5,5,5;L1,6.5,4,6.5', s => { s.kinetic += 1; }, 'rooms', 100);
U('turret', 2, 'P2,9,8,9,7,6,3,6;L5,6,5,1.5;L3.5,3,6.5,3', s => { s.turret += 1; }, 'nohit', 30);
U('berserk', 2, 'P5,9,1.5,5,3,2,5,3.5,7,2,8.5,5;L5,3.5,4,5.5,6,6.5,5,9', s => { s.berserk += 1; }, 'runs', 8);
U('grav', 2, 'D5,5,1.5;R5,5,3,20,160;R5,5,3,200,340;R5,5,4.5,110,250;R5,5,4.5,290,430', s => { s.grav += 1; s.spd *= 0.9; }, 'stage', 3);
U('anchor', 2, 'D1.5,5,.5;L3,5,4,5;L5,5,7,5;A7,5,9.5,5', s => { s.accel += 1; }, 'bosses', 5);
U('fat', 2, 'D5,5,4', s => { s.size *= 1.8; s.spd *= 0.7; s.rate *= 0.9; }, 'taken', 80);
U('tiny', 2, 'D3,3,.7;D7,3,.7;D5,5.5,.7;D3,8,.7;D7,8,.7', s => { s.size *= 0.55; s.rate *= 1.45; s.dmg *= 0.8; s.hitR *= 0.9; }, 'grazes', 500);
U('tether', 2, 'D2,8,1.2;L2,8,8,2;C8,2,1.5', s => { s.tether += 1; s.life *= 1.6; }, 'bosses', 8);
U('echo', 2, 'A1,3,6,3;A3,5,8,5;A5,7,9.5,7', s => { s.echo += 0.2; }, 'wins', 1);
U('flipslow', 2, 'P2,1,8,1,2,9,8,9', s => { s.flipSlow += 0.5; }, 'bursts', 60);
U('thorns', 2, 'C5,5,2;L5,3,5,.5;L5,7,5,9.5;L3,5,.5,5;L7,5,9.5,5;L3.6,3.6,1.8,1.8;L6.4,6.4,8.2,8.2;L3.6,6.4,1.8,8.2;L6.4,3.6,8.2,1.8', s => { s.thorns += 1; s.inv += 0.4; }, 'hits', 100);
U('greed', 2, 'P5,1,8,5,5,9,2,5;P5,3,6.5,5,5,7,3.5,5', s => { s.greed += 1; s.bulletSpd *= 1.12; }, 'shards', 300);
U('lucky', 2, 'C3.3,3.3,2;C6.7,3.3,2;C3.3,6.7,2;C6.7,6.7,2', s => { s.luck += 3; }, 'shards', 800);

// --- tier 3 ---
U('chaos', 3, 'A5,9,2,1;A5,9,8.5,3;A5,9,5.5,2;L1,9,9,9', s => { s.inacc += 24; s.dmg *= 1.35; s.count += 1; });
U('tunnel', 3, 'L1,5,4,5;L4,2,4,8', s => { s.life *= 0.42; s.dmg *= 1.6; });
U('heavycore', 3, 'P1,1,9,1,9,9,1,9;F3,3,7,3,7,7,3,7', s => { s.move *= 0.78; s.hitR *= 1.4; s.maxHp += 2; }, 'runs', 2);
U('pact', 3, 'P5,9,1.5,5,3,2,5,3.5,7,2,8.5,5;L1,1,9,9', s => { s.maxHp = Math.max(1, s.maxHp - 2); s.dmg *= 1.9; }, 'wins', 2);
U('lock', 3, 'P2,5,8,5,8,9,2,9;R5,5,2.2,180,360', s => { s.flipLock += 2.5; s.dmg *= 1.35; s.gain *= 1.5; }, 'flips', 50);
U('recoil', 3, 'A6,5,1,5;P6,2,9,5,6,8', s => { s.recoil += 1; s.dmg *= 1.4; }, 'kills', 250);
U('blind', 3, 'C5,5,1.5;L1,1,9,9;R5,5,4,200,340', s => { s.absorbR *= 0.5; s.rate *= 1.4; }, 'absorbed', 150);
U('drain', 3, 'F6,1,2,5.5,5,5.5,4,9,8,4.5,5,4.5;L1,9,9,1', s => { s.gain *= 0.5; s.burstDmg *= 2.5; }, 'bursts', 20);
U('fragile', 3, 'P5,1,9,3,9,6,5,9,1,6,1,3;L5,1,4,4,6,6,5,9', s => { s.inv *= 0.5; s.move *= 1.2; s.rate *= 1.2; }, 'nohit', 20);
U('swarmshot', 3, 'D2,2,.6;D5,2,.6;D8,2,.6;D2,5,.6;D5,5,.6;D8,5,.6;D2,8,.6;D5,8,.6;D8,8,.6', s => { s.count += 4; s.dmg *= 0.45; s.inacc += 10; }, 'taken', 120);

// the price paid at an altar; never offered, only inflicted
U('scar', 3, 'P5,9,1.5,5,3,2,5,3.5,7,2,8.5,5;L3,3,7,8', s => { s.maxHp = Math.max(1, s.maxHp - 1); });
UP.scar.hidden = true;

// Fusions: owning both halves of a pair switches on an extra effect.
const FUSIONS = [
  ['shock', 'burn', 'cryo'],        // burning + chilled enemies take 50% more damage
  ['halo', 'orbit', 'nova'],        // orbitals fire outward when you flip
  ['sink', 'mine', 'grav'],         // mines drag enemies in
  ['twin', 'drone', 'dichro'],      // the wingman fires the opposite colour
  ['afterburn', 'explode', 'burn'], // explosions ignite everything they touch
  ['rain', 'bounce', 'frag']        // shots shed fragments on every bounce
];
function fusionsOf(ups, extra) {
  const has = new Set(ups), f = {};
  if (extra) has.add(extra);
  for (const [id, a, b] of FUSIONS) if (has.has(a) && has.has(b)) f[id] = true;
  return f;
}

function computeStats(ship, ups, extra) {
  const s = baseStats();
  ship.fn(s);
  for (const id of ups) UP[id].fn(s);
  if (extra) UP[extra].fn(s);
  s.maxHp = Math.max(1, Math.round(s.maxHp));
  s.rate = clamp(s.rate, 0.5, 30);
  s.life = Math.max(0.12, s.life);
  s.count = Math.min(s.count, 40);
  s.inv = Math.max(0.3, s.inv);
  s.hitR = clamp(s.hitR, 2, 14);
  return s;
}

// Stats shown as up/down arrows when inspecting a pedestal: [stat, icon source, higher-is-better]
const STAT_SHOW = [
  ['dmg', 'dmg', 1], ['rate', 'rate', 1], ['spd', 'vel', 1], ['life', 'range', 1], ['size', 'cal', 1],
  ['count', 'multi', 1], ['inacc', 'chaos', -1], ['maxHp', 'hp', 1], ['move', 'move', 1], ['hitR', 'small', -1],
  ['gain', 'cap', 1], ['oppMul', 'contrast', 1], ['sameMul', 'harmony', 1], ['luck', 'lucky', 1], ['inv', 'shield', 1]
];
function statDeltas(a, b) {
  const out = [];
  for (const [k, ic, dir] of STAT_SHOW) {
    if (a[k] === b[k]) continue;
    const r = a[k] ? b[k] / a[k] : 2, m = Math.abs(Math.log(Math.max(r, 0.01)));
    out.push({ icon: UP[ic].icon, good: (r > 1) === (dir > 0), up: r > 1, n: m < 0.2 ? 1 : m < 0.5 ? 2 : 3 });
  }
  return out;
}

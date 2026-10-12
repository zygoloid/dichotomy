'use strict';
// Floor themes. A run visits one theme per depth slot (see SLOTS); haz lists the theme's room
// hazards as probabilities. pc = [light, dark] polarity colours; light always renders solid with a
// white core and dark as a hollow ring, so the two stay readable in any palette.
const STAGES = [
  { pc: ['#5ff4ff', '#ff3d9a'], bg: '#04050d', line: '#1c2f7a', wall: '#3d6bff', bpm: 126, style: 0, boss: ['mono'], mus: 0, depth: 0, haz: {} },
  { pc: ['#b6ff5c', '#b45cff'], bg: '#0a0612', line: '#47226e', wall: '#ff8a3d', bpm: 132, style: 1, boss: ['gem', 'gem'], mus: 1, depth: 1, haz: { gate: .6 } },
  { pc: ['#ffe66b', '#4a7dff'], bg: '#020308', line: '#231a55', wall: '#8b5cff', bpm: 124, style: 2, boss: ['sing'], mus: 2, depth: 2, haz: { well: 1, wellN: 2 } },
  { pc: ['#bfe9ff', '#ff5a36'], bg: '#0c0404', line: '#5a1414', wall: '#ff2d55', bpm: 138, style: 3, boss: ['metro'], mus: 3, depth: 3, haz: { flip: 1 } },
  { pc: ['#7dffd0', '#ff4ae0'], bg: '#000000', line: '#2c2c3a', wall: '#ffffff', bpm: 140, style: 4, boss: ['eclipse'], mus: 4, depth: 4, haz: { well: .4, gate: .3 } },
  // alternates for the first three depths (the second is where teleporters are common)
  { pc: ['#7df9ff', '#ff7a3d'], bg: '#020a0c', line: '#0f4d55', wall: '#22d3c5', bpm: 130, style: 5, boss: ['tide'], mus: 3, depth: 0, haz: { flow: .75 } },
  { pc: ['#fff27d', '#ff4d6d'], bg: '#0b0508', line: '#4d1832', wall: '#e85d9a', bpm: 138, style: 6, boss: ['kalei'], mus: 4, depth: 1, haz: { bounce: 1, tele: 1 } },
  { pc: ['#ffd0a1', '#a66bff'], bg: '#0a0502', line: '#4d2408', wall: '#ff7b1c', bpm: 126, style: 7, boss: ['binary'], mus: 0, depth: 2, haz: { field: .75 } },
  // the last floor: bullets ricochet and every room draws one hazard from the whole set
  { pc: ['#fff6d6', '#ff2e63'], bg: '#070500', line: '#4a3a08', wall: '#ffd23f', bpm: 142, style: 8, boss: ['crown'], mus: 3, depth: 5, haz: { bounce: 1, pick: 1 } }
];
// theme choices per depth, and the unlock that gates each alternate
const SLOTS = [[0, 5], [1, 6], [2, 7], [3], [4], [8]], ALT_UNLOCK = { 5: 'alt1', 6: 'alt2', 7: 'alt3' };
const rollRoute = () => SLOTS.map(o => pick(o.filter(t => !ALT_UNLOCK[t] || META.un[ALT_UNLOCK[t]])));
let PAL = STAGES[0];

const DIRV = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }, OPP = { n: 's', s: 'n', w: 'e', e: 'w' };
const DOOR_POS = { n: [W / 2, BY0], s: [W / 2, BY1], w: [BX0, H / 2], e: [BX1, H / 2] };

// Items never repeat: anything the pilot owns, or that is already sitting on a pedestal on
// this floor, is out of the pool. Only if the pool runs dry do plain stat boosts come back.
function rollUps(n, luck, filter) {
  const own = new Set(R.P.ups), out = [];
  const pool = UPS.filter(u => !u.hidden && isUnlocked(u.id) && !own.has(u.id) && !R.offered.has(u.id) && (!filter || filter(u)));
  const tw = [10, 7, 5 + luck * .6, 2.5 / (1 + luck * .3)];
  while (out.length < n && pool.length) {
    const u = wpick(pool, x => tw[x.tier]);
    pool.splice(pool.indexOf(u), 1); out.push(u.id); R.offered.add(u.id);
  }
  const basic = ['dmg', 'rate', 'vel', 'range', 'cal', 'hp', 'move', 'crit'].filter(id => !out.includes(id));
  while (out.length < n && basic.length) out.push(basic.splice(randi(0, basic.length - 1), 1)[0]);
  return out;
}

// chasers: in a maze only enemies that come looking for you are used, so the room cannot stall
const CHASERS = ['drifter', 'swarm', 'splitter', 'flipper'];
function genWaves(stage, depth, chasersOnly) {
  const pool = Object.keys(ENEMY).filter(k => { const d = ENEMY[k]; return !d.boss && !d.mb && (!chasersOnly || CHASERS.includes(k)) && d.min <= stage && isUnlocked(d.unlock); });
  const budget = 4 + stage * 1.8 + depth * .4 + R.asc;
  const nW = 1 + (chance(.55) ? 1 : 0) + (stage >= 2 && chance(.35) ? 1 : 0), waves = [];
  for (let i = 0; i < nW; i++) {
    let b = budget * (.7 + .2 * i), guard = 0, flip = randi(0, 1); const wave = [];
    // one-colour waves are a stage-1 teaching tool; everything later mixes both
    const mono = stage === 0 && chance(i ? .25 : .5);
    while (b > .5 && guard++ < 50) {
      const k = pick(pool), d = ENEMY[k];
      if (d.cost > b + .5) continue;
      b -= d.cost;
      const pol = mono ? flip : (flip ^= 1);
      for (let j = 0; j < (d.group || 1); j++) wave.push({ type: k, pol });
    }
    waves.push(wave);
  }
  return waves;
}

// ---- room furniture
// A room's obs are solid rectangles; flags give them behaviour:
//   mv {ax,ay,bx,by,per,ph}  slides back and forth      hot    hurts the pilot on touch
//   burst                    only a burst breaks it      crate  may drop a pickup when broken
// Alongside them: gates (solid to the other colour), switches (shoot to swap every gate's colour),
// saws (travelling hazards), holes (wormhole pairs) and wraps (linked stretches of the side walls).
const LAYOUTS = [['open', 2], ['pillars', 3], ['block', 1], ['bars', 2], ['sym', 3],
  ['maze', 3, 'rm:maze'], ['movers', 3, 'rm:movers'], ['danger', 3, 'rm:danger'], ['polar', 3, 'rm:polar'], ['vault', 3, 'rm:vault']];

// Furniture is never scattered at random: every arrangement is either a pattern (mirrored,
// ringed, in rows) or there for a reason (a lane to run, cover to hold, something to reach).
const CX = W / 2, CY = H / 2;
// a rectangle of size w x h centred at (x, y) relative to the room's centre
const rc = (x, y, w, h, props) => Object.assign({ x: CX + x - w / 2, y: CY + y - h / 2, w, h }, props);
// mirror centre-relative specs [x, y, w, h]: 'hv' four ways, 'h' left-right, 'rot' by a half turn
function mirrored(specs, mode, props) {
  const out = [];
  const add = (x, y, w, h) => { if (!out.some(o => Math.abs(o.x - (CX + x - w / 2)) < 1 && Math.abs(o.y - (CY + y - h / 2)) < 1)) out.push(rc(x, y, w, h, typeof props === 'function' ? props(out.length) : props)); };
  for (const [x, y, w, h] of specs) {
    add(x, y, w, h);
    if (mode === 'rot') add(-x, -y, w, h);
    if (mode === 'h' || mode === 'hv') add(-x, y, w, h);
    if (mode === 'hv') { add(x, -y, w, h); add(-x, -y, w, h); }
  }
  return out;
}
const ringOf = (n, rx, ry, size, props) => Array.from({ length: n }, (_, i) => rc(Math.cos(i * TAU / n + TAU / (2 * n)) * rx, Math.sin(i * TAU / n + TAU / (2 * n)) * ry, size, size, props));
const PATTERNS = {
  pillars: [
    () => mirrored([[270, 130, 60, 60]], 'hv'),                         // four posts
    () => ringOf(6, 300, 170, 50),                                      // a ring of six
    () => mirrored([[110, 150, 44, 44], [320, 150, 44, 44]], 'hv'),     // two colonnades
    () => mirrored([[190, 95, 50, 50], [380, 190, 50, 50]], 'hv')       // an X
  ],
  block: [
    () => [rc(0, 0, 160, 100)],
    () => [rc(0, 0, 120, 80)].concat(mirrored([[380, 190, 50, 50]], 'hv')),
    () => mirrored([[0, 0, 90, 90], [200, 0, 40, 40]], 'h')
  ],
  bars: [
    () => mirrored([[-230, -120, 220, 36]], 'rot'),                     // two offset bars
    () => mirrored([[250, 150, 200, 28]], 'hv'),                        // a broken ring
    () => mirrored([[-150, -190, 180, 26], [150, -130, 26, 150]], 'rot'), // a pinwheel
    () => mirrored([[330, 0, 28, 200], [0, 200, 200, 28]], 'hv')        // a box open at the corners
  ],
  sym: [
    () => { // one or two blocks in a quadrant, mirrored four ways
      const specs = [];
      for (let g = 0, n = randi(1, 2); specs.length < n && g < 30; g++) {
        const s = [rand(130, 430), rand(90, 210), rand(50, 110), rand(40, 90)];
        if (!specs.some(q => Math.abs(q[0] - s[0]) < (q[2] + s[2]) / 2 + 40 && Math.abs(q[1] - s[1]) < (q[3] + s[3]) / 2 + 40)) specs.push(s);
      }
      return mirrored(specs, 'hv');
    },
    () => [-2, -1, 1, 2].map(i => rc(i * 190, i * 95, 60, 60)),         // steps down a diagonal
    () => mirrored([[400, 205, 130, 24], [453, 160, 24, 110]], 'hv'),   // brackets in the corners
    () => mirrored([[rand(150, 250), rand(-200, -120), 70, 70], [rand(330, 430), rand(60, 160), 90, 50]], 'h')
  ]
};

function genLayout(r) {
  const lay = wpick(LAYOUTS.filter(l => !l[2] || META.un[l[2]]), l => l[1]), kind = lay[0];
  r.layout = kind; r.rich = !!lay[2]; r.obs = [];
  // add blocks only where they do not crowd what is already there
  const place = list => { for (const o of list) if (!r.obs.concat(r.gates, r.noSpawn).some(q => o.x < q.x + q.w + 16 && o.x + o.w > q.x - 16 && o.y < q.y + q.h + 16 && o.y + o.h > q.y - 16)) r.obs.push(o); };
  const crates = specs => { if (META.un['rm:vault']) place(mirrored(specs, 'h', { burst: true, crate: true })); };
  if (PATTERNS[kind]) { r.obs = pick(PATTERNS[kind])(); if (chance(.3)) crates([[150, 0, 44, 44]]); }
  else if (kind === 'maze') genMaze(r);
  else if (kind === 'movers') {
    // sliders run in parallel lanes, with fixed posts between the lanes to dodge behind
    const hz = chance(.5), n = randi(2, 3), lanes = n === 2 ? [-1, 1] : [-1, 0, 1];
    for (const l of lanes) {
      const per = rand(5, 8), ph = l === 0 ? .5 : (l + 1) / 4;
      if (hz) { const y = CY + l * (n === 2 ? 110 : 190) - 15; r.obs.push({ x: 150, y, w: 150, h: 30, mv: { ax: 150, ay: y, bx: 980, by: y, per, ph } }); }
      else { const x = CX + l * (n === 2 ? 170 : 330) - 15; r.obs.push({ x, y: 110, w: 30, h: 130, mv: { ax: x, ay: 110, bx: x, by: 480, per, ph } }); }
    }
    place(hz ? (n === 2 ? mirrored([[300, 0, 46, 46]], 'h') : mirrored([[300, 95, 46, 46]], 'hv'))
             : (n === 2 ? mirrored([[0, 140, 46, 46]], 'hv') : mirrored([[165, 130, 46, 46]], 'hv')));
  } else if (kind === 'danger') genDanger(r);
  else if (kind === 'polar') genPolar(r);
  else if (kind === 'vault') {
    genVault(r);
    place(mirrored([[270, 130, 60, 60]], 'hv')); // posts everywhere but the vault's own corner
    crates([[150, 0, 44, 44]]);
  }
}

// Spikes and saws, arranged so the saws patrol the lanes the spikes leave open.
function genDanger(r) {
  const hot = { hot: true }, saw = (ax, ay, bx, by, per, ph) => r.saws.push({ ax: CX + ax, ay: CY + ay, bx: CX + bx, by: CY + by, per, ph, r: 20, x: -99, y: -99 });
  const k = randi(0, 2);
  if (k === 0) { r.obs = mirrored([[120, 105, 50, 50], [360, 105, 50, 50]], 'hv', hot); saw(-440, 0, 440, 0, 7, 0); }        // a gauntlet with a saw down the middle
  else if (k === 1) { r.obs = mirrored([[250, 130, 56, 56]], 'hv', hot); saw(-440, 0, 440, 0, 7, 0); saw(0, -200, 0, 200, 4.5, .25); } // four posts, saws on the cross between them
  else { r.obs = ringOf(6, 260, 150, 50, hot); saw(-430, -200, -430, 200, 5, 0); saw(430, 200, 430, -200, 5, 0); }           // a ring of spikes flanked by two saws
}

// Coloured walls with a purpose. A fort: four walls round the middle, open at the corners, that
// shield whoever is inside from one colour on two sides, with the switch that swaps the colours
// in the centre. Or treasure cells: two corner chambers closed by walls of different colours.
function genPolar(r) {
  const a = randi(0, 1), gate = (x, y, w, h, pol) => r.gates.push(rc(x, y, w, h, { pol }));
  r.switches.push({ x: CX, y: CY, cd: 0 });
  if (chance(.5)) {
    gate(0, -120, 260, 14, a); gate(0, 120, 260, 14, a); gate(-170, 0, 14, 180, a ^ 1); gate(170, 0, 14, 180, a ^ 1);
    r.obs = mirrored([[400, 200, 50, 50]], 'hv');
  } else {
    const top = chance(.5);
    for (const left of [true, false]) {
      const ch = chamber(r, left, left ? top : !top), pol = left ? a : a ^ 1;
      r.gates.push(Object.assign(ch.door, { pol }));
      for (let i = 0, n = randi(3, 4); i < n; i++) r.pickups.push({ x: ch.x + ch.w / 2 + rand(-40, 40), y: ch.y + ch.h / 2 + rand(-26, 26), kind: 'shard', t: 0 });
      if (chance(.35)) r.pickups.push({ x: ch.x + ch.w / 2, y: ch.y + ch.h / 2, kind: chance(.5) ? 'cell' : 'heart', t: 0 });
    }
    gate(-150, 0, 56, 56, a); gate(150, 0, 56, 56, a ^ 1); // a coloured post either side of the switch
  }
}

// Mazes. Plain: a spanning tree over an 8x5 grid with a few extra walls knocked out so it loops.
// Polar: the same, but a share of the walls are coloured gates, with a switch in the middle.
// Split: a coarser maze cut in two by an unbroken wall, with one end of a wormhole in a dead
// end on each side, so the wormhole is the only way across.
function genMaze(r) {
  const split = META.un['tele:hole'] && chance(.4), polar = !split && META.un['rm:polar'] && chance(.35);
  const C = split ? 6 : 8, Q = split ? 4 : 5, cw = (BX1 - BX0) / C, ch = (BY1 - BY0) / Q, T = 12, cs = split ? pick([1, 3]) : -1;
  const V = [], Hz = [], seen = new Set(); // V[c][q]: wall right of the cell, Hz[c][q]: wall below it
  for (let c = 0; c < C; c++) { V.push(Array(Q).fill(true)); Hz.push(Array(Q).fill(true)); }
  const carve = (c, q) => {
    seen.add(c + q * C);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - .5)) {
      const nc = c + dx, nq = q + dy;
      if (nc < 0 || nq < 0 || nc >= C || nq >= Q || seen.has(nc + nq * C) || (dx && Math.min(c, nc) === cs)) continue;
      if (dx) V[Math.min(c, nc)][q] = false; else Hz[c][Math.min(q, nq)] = false;
      carve(nc, nq);
    }
  };
  carve(0, randi(0, Q - 1));
  if (split) carve(C - 1, randi(0, Q - 1));
  for (let c = 0; c < C; c++) for (let q = 0; q < Q; q++) { // knock a few more out, but never the dividing wall
    if (c !== cs && V[c][q] && chance(.15)) V[c][q] = false;
    if (Hz[c][q] && chance(.15)) Hz[c][q] = false;
  }
  V[C / 2 - 1][0] = V[C / 2 - 1][Q - 1] = false;              // the top and bottom doors sit on a cell boundary
  if (Q % 2 === 0) Hz[0][Q / 2 - 1] = Hz[C - 1][Q / 2 - 1] = false; // and so do the side doors when there is an even number of rows
  for (let c = 0; c < C; c++) for (let q = 0; q < Q; q++) {
    const wall = (o, n) => { if (polar && chance(.4)) r.gates.push(Object.assign(o, { pol: n & 1 })); else r.obs.push(o); };
    if (c < C - 1 && V[c][q]) wall({ x: BX0 + (c + 1) * cw - T / 2, y: BY0 + q * ch, w: T, h: ch }, c + q);
    if (q < Q - 1 && Hz[c][q]) wall({ x: BX0 + c * cw, y: BY0 + (q + 1) * ch - T / 2, w: cw, h: T }, c + q + 1);
  }
  if (polar) r.switches.push({ x: BX0 + (C / 2 + .5) * cw, y: BY0 + (Q / 2) * ch, cd: 0 });
  if (split) {
    const open = (c, q) => (c > 0 && !V[c - 1][q]) + (c < C - 1 && !V[c][q]) + (q > 0 && !Hz[c][q - 1]) + (q < Q - 1 && !Hz[c][q]);
    const atDoor = (c, q) => ((c === C / 2 - 1 || c === C / 2) && (q === 0 || q === Q - 1)) || ((c === 0 || c === C - 1) && (q === Q / 2 - 1 || q === Q / 2));
    const best = (c0, c1) => { // the most enclosed cell on one side that is not a doorway
      let b = null, bs = 9;
      for (let c = c0; c <= c1; c++) for (let q = 0; q < Q; q++) { const s = open(c, q) + (atDoor(c, q) ? 5 : 0) + Math.random() * .5; if (s < bs) { bs = s; b = [c, q]; } }
      return { x: BX0 + (b[0] + .5) * cw, y: BY0 + (b[1] + .5) * ch, r: 50 };
    };
    r.holes = [Object.assign(best(0, cs), { to: 1 }), Object.assign(best(cs + 1, C - 1), { to: 0 })];
  }
}

// A sealed chamber in a corner: three solid walls and a door facing the middle of the room.
// Returns its bounds and the door, which the caller makes a burst barrier or a coloured gate.
function chamber(r, left, top) {
  const w = 170, h = 120, T = 12, x = left ? BX0 + 34 : BX1 - 34 - w, y = top ? BY0 + 34 : BY1 - 34 - h;
  r.obs.push({ x, y, w, h: T }, { x, y: y + h - T, w, h: T }, { x: left ? x : x + w - T, y, w: T, h });
  r.noSpawn.push({ x: x - 24, y: y - 24, w: w + 48, h: h + 48 });
  return { x, y, w, h, door: { x: left ? x + w - T : x, y: y + T, w: T, h: h - 2 * T } };
}
// A vault: its door only gives way to a burst, and its loot cannot be reached (or magnetised
// out) until it does.
function genVault(r) {
  const ch = chamber(r, chance(.5), chance(.5)), door = Object.assign(ch.door, { burst: true });
  r.obs.push(door);
  const loot = kind => r.pickups.push({ x: ch.x + ch.w / 2 + rand(-40, 40), y: ch.y + ch.h / 2 + rand(-26, 26), kind, t: 0, lock: door });
  for (let i = 0, n = randi(4, 6); i < n; i++) loot('shard');
  if (chance(.45)) loot('heart');
  if (chance(.4)) loot('cell');
}

// Teleporters laid over whatever else the room has. They are a feature of one floor (haz.tele)
// and a rare surprise anywhere else. Some wormholes drift up and down.
function genTeleporters(r) {
  if (r.layout === 'maze') return; // a maze places its own, or none
  const common = !!PAL.haz.tele;
  if (META.un['tele:hole'] && chance(common ? .5 : .06)) for (let g = 0; g < 40; g++) {
    const a = { x: rand(180, 440), y: rand(160, 560), r: 56, to: 1 }, b = { x: rand(840, 1100), y: rand(160, 560), r: 56, to: 0 };
    const hit = (x, y) => r.obs.concat(r.gates, r.noSpawn).some(o => circRect(x, y, 92, o));
    const bad = p => Math.abs(p.y - H / 2) < 110 && (p.x < 290 || p.x > 990) || hit(p.x, p.y);
    if (bad(a) || bad(b)) continue;
    for (const h of [a, b]) if (chance(.3)) { // a drifting ring, if its whole run is clear
      const y0 = clamp(h.y - 140, 160, 560), y1 = clamp(h.y + 140, 160, 560);
      if (![y0, (y0 + y1) / 2, y1].some(y => bad({ x: h.x, y }))) h.mv = { ax: h.x, ay: y0, bx: h.x, by: y1, per: rand(8, 11), ph: rand() };
    }
    r.holes = [a, b]; break;
  }
  if (META.un['tele:wrap'] && chance(common ? .45 : .06)) {
    // A link joins a stretch of the left wall (from l0) to a stretch of the right wall (from r0),
    // both h tall. Straight across at the top, the bottom or both; or diagonally, one or both ways.
    const top = BY0 + 50, bot = BY1 - 190, h = 140, k = randi(0, 4);
    if (k === 0 || k === 2) r.wraps.push({ l0: top, r0: top, h });
    if (k === 1 || k === 2) r.wraps.push({ l0: bot, r0: bot, h });
    if (k >= 3) r.wraps.push({ l0: top, r0: bot, h });
    if (k === 4) r.wraps.push({ l0: bot, r0: top, h });
  }
}

// Polarity gates: only a ship, shot or bullet of the gate's colour passes through.
function genGates() {
  const p = randi(0, 1), q = chance(.5) ? p : p ^ 1;
  return chance(.5)
    ? [{ x: 425, y: BY0, w: 10, h: BY1 - BY0, pol: p }, { x: 845, y: BY0, w: 10, h: BY1 - BY0, pol: q }]
    : [{ x: BX0, y: 235, w: BX1 - BX0, h: 10, pol: p }, { x: BX0, y: 475, w: BX1 - BX0, h: 10, pol: q }];
}

// Colour fields repaint any enemy bullet that drifts into them.
function genFields() { return genWells(2).map((w, i) => ({ x: w.x, y: w.y, r: rand(120, 160), pol: i })); }

function addHazards(r) {
  const hz = PAL.haz;
  let k = { well: chance(hz.well || 0), gate: chance(hz.gate || 0), flow: chance(hz.flow || 0), field: chance(hz.field || 0) };
  if (hz.pick) { k = {}; if (chance(.85)) k[pick(['well', 'gate', 'flow', 'field'])] = true; }
  if (k.gate && !r.rich) { r.obs = []; r.gates = genGates(); }
  if (k.well) r.wells = genWells(randi(1, hz.wellN || 1));
  if (k.flow) r.flow = { ang: pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) };
  if (k.field) r.fields = genFields();
}

function genWells(n) {
  const out = [];
  for (let g = 0; out.length < n && g < 40; g++) {
    const x = rand(260, 1020), y = rand(190, 530);
    if (Math.abs(x - W / 2) < 110 || Math.abs(y - H / 2) < 80) continue;
    if (out.some(w => hyp(w.x - x, w.y - y) < 320)) continue;
    out.push({ x, y, str: 95, r: 260, core: 16 });
  }
  return out;
}

function genFloor(stage) {
  const rooms = [], map = {}, key = (x, y) => x + ',' + y, dirs = Object.values(DIRV);
  const add = (x, y, type) => {
    const r = { gx: x, gy: y, type, doors: {}, cleared: false, visited: false, seen: false, obs: [], gates: [], wells: [], fields: [], flow: null, switches: [], saws: [], holes: [], wraps: [], noSpawn: [], navB: null, layout: 'open', rich: false, hidden: null, mb: null, waves: [], peds: [], pickups: [], portal: null, depth: 0 };
    rooms.push(r); map[key(x, y)] = r; return r;
  };
  const nb = (x, y) => dirs.filter(d => map[key(x + d[0], y + d[1])]).length;
  add(0, 0, 'start');
  const n = 7 + stage * 2 + randi(0, 1);
  for (let g = 0; rooms.length < n && g < 3000; g++) {
    const r = pick(rooms), d = pick(dirs), x = r.gx + d[0], y = r.gy + d[1];
    if (map[key(x, y)] || Math.abs(x) > 4 || Math.abs(y) > 3) continue;
    if (nb(x, y) > 1 && chance(.8)) continue;
    add(x, y, 'fight');
  }
  // a secret room has no door: its neighbour gets a cracked wall that must be shot open
  const link = () => {
    for (const r of rooms) for (const d in DIRV) {
      const o = map[key(r.gx + DIRV[d][0], r.gy + DIRV[d][1])];
      if (!o || r.type === 'secret') continue;
      if (o.type === 'secret') r.hidden = { dir: d, room: o, hp: 70 + 45 * stage, flT: -9 };
      else r.doors[d] = o;
    }
  };
  const bfs = () => {
    for (const r of rooms) r.depth = -1;
    rooms[0].depth = 0; const q = [rooms[0]];
    while (q.length) { const r = q.shift(); for (const d in r.doors) { const o = r.doors[d]; if (o.depth < 0) { o.depth = r.depth + 1; q.push(o); } } }
  };
  link(); bfs();
  // special rooms are always dead ends hanging off a normal room
  // order matters on small floors: dead-end slots can run out, so the essentials go first
  const specials = ['boss', 'treasure', 'secret'];
  if (isUnlocked('treasure2') && META.un.treasure2 && chance(.6)) specials.push('treasure');
  if (META.un.shop) specials.push('shop');
  if (META.un.challenge && chance(.6)) specials.push('challenge');
  if (META.un.altar && chance(.5)) specials.push('altar');
  if (chance(.75)) specials.splice(3, 0, 'mini');
  for (const type of specials) {
    const c = [];
    for (const r of rooms) {
      if (r.type !== 'fight' && r.type !== 'start') continue;
      for (const d of dirs) { const x = r.gx + d[0], y = r.gy + d[1]; if (!map[key(x, y)] && Math.abs(x) <= 5 && Math.abs(y) <= 4 && nb(x, y) === 1) c.push({ x, y, from: r }); }
    }
    if (!c.length) continue;
    let ch = pick(c);
    if (type === 'boss') { const md = Math.max(...c.map(q => q.from.depth)); ch = pick(c.filter(q => q.from.depth === md)); }
    add(ch.x, ch.y, type);
  }
  link(); bfs();

  const luck = 0;
  for (const r of rooms) {
    if (r.type === 'fight') {
      genLayout(r); r.waves = genWaves(stage, r.depth, r.layout === 'maze');
      addHazards(r);
      genTeleporters(r);
    } else if (r.type === 'treasure') {
      const n = 1 + (META.un.tre2 ? 1 : 0) + (META.un.tre3 ? 1 : 0), ups = rollUps(n, luck);
      ups.forEach((u, i) => r.peds.push({ x: W / 2 + (i - (ups.length - 1) / 2) * 190, y: H / 2, up: u, price: 0, group: 1, taken: false }));
      if (META.un.trer) r.peds.push({ x: W / 2, y: H / 2 + 170, reroll: true, price: 0, taken: false });
    } else if (r.type === 'shop') {
      const ups = rollUps(META.un.shop3 ? 2 : 1, luck + 2), items = [{ up: ups[0], price: 15 + stage * 5 }];
      if (META.un.shop2) items.push({ heart: true, price: 8 + stage * 2 });
      if (ups[1]) items.push({ up: ups[1], price: 22 + stage * 5 });
      items.forEach((it, i) => r.peds.push(Object.assign({ x: W / 2 + (i - (items.length - 1) / 2) * 190, y: H / 2, taken: false }, it)));
      if (META.un.shopr) r.peds.push({ x: W / 2, y: H / 2 + 170, reroll: true, price: 0, taken: false });
    } else if (r.type === 'challenge') {
      r.peds.push({ x: W / 2, y: H / 2, up: rollUps(1, 4, u => u.tier > 0)[0], price: 0, taken: false });
      r.waves = genWaves(stage + 1, 4).concat(genWaves(stage + 1, 6)).slice(0, 3);
    } else if (r.type === 'mini') {
      r.mb = pick(['hydra', 'lancer', 'carousel']);
    } else if (r.type === 'secret') {
      // what a secret holds varies: an item, a choice, a bargain, a hoard, a bad idea...
      const ped = (x, up, o) => r.peds.push(Object.assign({ x, y: H / 2, up, price: 0, taken: false }, o));
      const loot = (kind, n) => { for (let i = 0; i < n; i++) r.pickups.push({ x: W / 2 + rand(-170, 170), y: H / 2 + rand(-120, 120), kind, t: 0 }); };
      const kind = wpick(['item', 'choice', 'hoard', 'hearts', 'bargain', 'cursed', 'jackpot'], k => k === 'jackpot' ? 1 : k === 'item' ? 4 : 3);
      if (kind === 'item') { ped(W / 2, rollUps(1, 6)[0]); loot('shard', randi(0, 3)); }
      else if (kind === 'choice') rollUps(3, 4).forEach((u, i) => ped(W / 2 + (i - 1) * 170, u, { group: 4 }));
      else if (kind === 'hoard') loot('shard', randi(9, 14));
      else if (kind === 'hearts') { loot('heart', randi(2, 3)); loot('shard', randi(1, 4)); }
      else if (kind === 'bargain') rollUps(3, 4).forEach((u, i) => ped(W / 2 + (i - 1) * 170, u, { price: 6 + stage * 2 }));
      else if (kind === 'cursed') { rollUps(2, 0, u => u.tier === 3).forEach((u, i) => ped(W / 2 + (i ? 100 : -100), u)); loot('heart', 1); }
      else rollUps(2, 8).forEach((u, i) => ped(W / 2 + (i ? 100 : -100), u));
    } else if (r.type === 'altar') {
      rollUps(2, 6, u => u.tier >= 1).forEach((u, i) => r.peds.push({ x: W / 2 + (i ? 110 : -110), y: H / 2, up: u, price: 0, hpCost: 1, taken: false }));
    } else if (r.type === 'start' && META.un.startped && stage === 0) {
      r.peds.push({ x: W / 2, y: H / 2 - 75, up: rollUps(1, 0)[0], price: 0, group: 1, taken: false });
    }
  }
  return { rooms, start: rooms[0] };
}

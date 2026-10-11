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
  // alternates for the first three depths
  { pc: ['#7df9ff', '#ff7a3d'], bg: '#020a0c', line: '#0f4d55', wall: '#22d3c5', bpm: 130, style: 5, boss: ['tide'], mus: 3, depth: 0, haz: { flow: .75 } },
  { pc: ['#fff27d', '#ff4d6d'], bg: '#0b0508', line: '#4d1832', wall: '#e85d9a', bpm: 138, style: 6, boss: ['kalei'], mus: 4, depth: 1, haz: { bounce: 1 } },
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
const LAYOUTS = [['open', 2], ['pillars', 2], ['block', 1], ['bars', 2], ['scatter', 3],
  ['maze', 3, 'rm:maze'], ['movers', 3, 'rm:movers'], ['danger', 3, 'rm:danger'], ['polar', 3, 'rm:polar'], ['vault', 3, 'rm:vault']];

function genLayout(r) {
  const kind = wpick(LAYOUTS.filter(l => !l[2] || META.un[l[2]]), l => l[1])[0], o = r.obs = [];
  r.layout = kind; r.rich = !!LAYOUTS.find(l => l[0] === kind)[2];
  // drop n rectangles clear of the door lanes and of each other; into is obs or gates
  const scatter = (n, lo, hi, props, into) => {
    for (let i = 0, g = 0; i < n && g < 90; g++) {
      const w = rand(lo, hi), h = rand(lo, hi), x = rand(190, 1090 - w), y = rand(150, 570 - h);
      if ((x < 720 && x + w > 560) || (y < 430 && y + h > 290)) continue;
      if (o.concat(r.gates, r.noSpawn).some(q => x < q.x + q.w + 50 && x + w > q.x - 50 && y < q.y + q.h + 50 && y + h > q.y - 50)) continue;
      (into || o).push(Object.assign({ x, y, w, h }, typeof props === 'function' ? props(i) : props)); i++;
    }
  };
  if (kind === 'pillars') for (const [x, y] of [[340, 200], [880, 200], [340, 460], [880, 460]]) o.push({ x, y, w: 60, h: 60 });
  else if (kind === 'block') o.push({ x: 560, y: 310, w: 160, h: 100 });
  else if (kind === 'bars') o.push({ x: 300, y: 222, w: 220, h: 36 }, { x: 760, y: 462, w: 220, h: 36 });
  else if (kind === 'scatter') { scatter(randi(3, 5), 50, 100); if (META.un['rm:vault'] && chance(.4)) scatter(2, 42, 46, { burst: true, crate: true }); }
  else if (kind === 'maze') genMaze(r);
  else if (kind === 'movers') {
    const hz = chance(.5), n = randi(2, 3);
    for (let i = 0; i < n; i++) {
      const per = rand(5, 8), ph = rand();
      if (hz) { const y = [170, 345, 520][i] - 15; o.push({ x: 150, y, w: 150, h: 30, mv: { ax: 150, ay: y, bx: 980, by: y, per, ph } }); }
      else { const x = [300, 625, 950][i] - 15; o.push({ x, y: 110, w: 30, h: 130, mv: { ax: x, ay: 110, bx: x, by: 480, per, ph } }); }
    }
    scatter(2, 50, 70);
  } else if (kind === 'danger') {
    scatter(randi(3, 4), 46, 60, { hot: true });
    for (let i = 0, n = randi(1, 2); i < n; i++) r.saws.push(chance(.5)
      ? { ax: 160, ay: rand(140, 580), bx: 1120, by: rand(140, 580), per: rand(5, 8), ph: rand(), r: 20, x: -99, y: -99 }
      : { ax: rand(160, 1120), ay: 120, bx: rand(160, 1120), by: 600, per: rand(4, 6), ph: rand(), r: 20, x: -99, y: -99 });
  } else if (kind === 'polar') {
    const i0 = randi(0, 1);
    scatter(randi(4, 6), 64, 90, i => ({ pol: (i + i0) & 1 }), r.gates);
    r.switches.push({ x: W / 2, y: H / 2, cd: 0 });
  } else if (kind === 'vault') { genVault(r); scatter(2, 50, 80); scatter(randi(1, 2), 42, 46, { burst: true, crate: true }); }
}

// A maze: a spanning tree over an 8x5 grid of cells, with a few extra walls knocked out so it loops.
function genMaze(r) {
  const C = 8, Q = 5, cw = (BX1 - BX0) / C, ch = (BY1 - BY0) / Q, T = 12, V = [], Hz = [], seen = new Set();
  for (let c = 0; c < C; c++) { V.push(Array(Q).fill(true)); Hz.push(Array(Q).fill(true)); } // V[c][q]: wall right of the cell, Hz[c][q]: wall below it
  const carve = (c, q) => {
    seen.add(c + q * C);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - .5)) {
      const nc = c + dx, nq = q + dy;
      if (nc < 0 || nq < 0 || nc >= C || nq >= Q || seen.has(nc + nq * C)) continue;
      if (dx) V[Math.min(c, nc)][q] = false; else Hz[c][Math.min(q, nq)] = false;
      carve(nc, nq);
    }
  };
  carve(randi(0, C - 1), randi(0, Q - 1));
  V[3][0] = V[3][Q - 1] = false; // the top and bottom doors sit on a cell boundary: keep it open
  for (let c = 0; c < C; c++) for (let q = 0; q < Q; q++) {
    if (c < C - 1 && V[c][q] && !chance(.15)) r.obs.push({ x: BX0 + (c + 1) * cw - T / 2, y: BY0 + q * ch, w: T, h: ch });
    if (q < Q - 1 && Hz[c][q] && !chance(.15)) r.obs.push({ x: BX0 + c * cw, y: BY0 + (q + 1) * ch - T / 2, w: cw, h: T });
  }
}

// A sealed chamber in a corner: three solid walls, a burst-only barrier, and loot that cannot
// be reached (or magnetised out) until the barrier is gone.
function genVault(r) {
  const left = chance(.5), top = chance(.5), w = 170, h = 120, T = 12;
  const x = left ? BX0 + 34 : BX1 - 34 - w, y = top ? BY0 + 34 : BY1 - 34 - h;
  const door = { x: left ? x + w - T : x, y: y + T, w: T, h: h - 2 * T, burst: true };
  r.obs.push({ x, y, w, h: T }, { x, y: y + h - T, w, h: T }, { x: left ? x : x + w - T, y, w: T, h }, door);
  r.noSpawn.push({ x: x - 24, y: y - 24, w: w + 48, h: h + 48 });
  const loot = kind => r.pickups.push({ x: x + w / 2 + rand(-40, 40), y: y + h / 2 + rand(-26, 26), kind, t: 0, lock: door });
  for (let i = 0, n = randi(4, 6); i < n; i++) loot('shard');
  if (chance(.45)) loot('heart');
  if (chance(.4)) loot('cell');
}

// Teleporters laid over whatever else the room has.
function genTeleporters(r) {
  if (META.un['tele:hole'] && chance(r.layout === 'maze' ? .5 : .25)) for (let g = 0; g < 40; g++) {
    const a = { x: rand(180, 440), y: rand(160, 560), r: 56, to: 1 }, b = { x: rand(840, 1100), y: rand(160, 560), r: 56, to: 0 };
    const bad = p => Math.abs(p.y - H / 2) < 110 && (p.x < 290 || p.x > 990) || r.obs.concat(r.gates, r.noSpawn).some(o => circRect(p.x, p.y, 92, o));
    if (bad(a) || bad(b)) continue;
    r.holes = [a, b]; break;
  }
  if (META.un['tele:wrap'] && chance(.25)) {
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
      const n = META.un.ped3 ? 3 : 2, ups = rollUps(n, luck);
      ups.forEach((u, i) => r.peds.push({ x: W / 2 + (i - (ups.length - 1) / 2) * 190, y: H / 2, up: u, price: 0, group: 1, taken: false }));
    } else if (r.type === 'shop') {
      const ups = rollUps(2, luck + 2);
      r.peds.push({ x: W / 2 - 190, y: H / 2, up: ups[0], price: 15 + stage * 5, taken: false });
      r.peds.push({ x: W / 2, y: H / 2, heart: true, price: 8 + stage * 2, taken: false });
      if (ups[1]) r.peds.push({ x: W / 2 + 190, y: H / 2, up: ups[1], price: 22 + stage * 5, taken: false });
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

'use strict';
// Stage themes. pc = [light, dark] polarity colours; light always renders solid with a
// white core and dark as a hollow ring, so the two stay readable in any palette.
const STAGES = [
  { pc: ['#5ff4ff', '#ff3d9a'], bg: '#04050d', line: '#1c2f7a', wall: '#3d6bff', bpm: 120, style: 0, boss: ['mono'] },
  { pc: ['#b6ff5c', '#b45cff'], bg: '#0a0612', line: '#47226e', wall: '#ff8a3d', bpm: 128, style: 1, boss: ['gem', 'gem'] },
  { pc: ['#ffe66b', '#4a7dff'], bg: '#020308', line: '#231a55', wall: '#8b5cff', bpm: 100, style: 2, boss: ['sing'] },
  { pc: ['#bfe9ff', '#ff5a36'], bg: '#0c0404', line: '#5a1414', wall: '#ff2d55', bpm: 140, style: 3, boss: ['metro'] },
  { pc: ['#7dffd0', '#ff4ae0'], bg: '#000000', line: '#2c2c3a', wall: '#ffffff', bpm: 150, style: 4, boss: ['eclipse'] }
];
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

function genWaves(stage, depth) {
  const pool = Object.keys(ENEMY).filter(k => { const d = ENEMY[k]; return !d.boss && !d.mb && d.min <= stage && isUnlocked(d.unlock); });
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

function genObstacles() {
  const k = randi(0, 5), o = [];
  if (k === 1) for (const [x, y] of [[340, 200], [880, 200], [340, 460], [880, 460]]) o.push({ x, y, w: 60, h: 60 });
  else if (k === 2) o.push({ x: 560, y: 310, w: 160, h: 100 });
  else if (k === 3) o.push({ x: 300, y: 222, w: 220, h: 36 }, { x: 760, y: 462, w: 220, h: 36 });
  else if (k === 4) {
    for (let i = 0, g = 0; i < randi(3, 5) && g < 60; g++) {
      const w = rand(50, 100), h = rand(50, 100), x = rand(190, 1090 - w), y = rand(150, 570 - h);
      if ((x < 720 && x + w > 560) || (y < 430 && y + h > 290)) continue;
      if (o.some(q => x < q.x + q.w + 50 && x + w > q.x - 50 && y < q.y + q.h + 50 && y + h > q.y - 50)) continue;
      o.push({ x, y, w, h }); i++;
    }
  }
  return o;
}

// Polarity gates: only a ship, shot or bullet of the gate's colour passes through.
function genGates() {
  const p = randi(0, 1), q = chance(.5) ? p : p ^ 1;
  return chance(.5)
    ? [{ x: 425, y: BY0, w: 10, h: BY1 - BY0, pol: p }, { x: 845, y: BY0, w: 10, h: BY1 - BY0, pol: q }]
    : [{ x: BX0, y: 235, w: BX1 - BX0, h: 10, pol: p }, { x: BX0, y: 475, w: BX1 - BX0, h: 10, pol: q }];
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
    const r = { gx: x, gy: y, type, doors: {}, cleared: false, visited: false, seen: false, obs: [], gates: [], wells: [], hidden: null, mb: null, waves: [], peds: [], pickups: [], portal: null, depth: 0 };
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
      r.obs = genObstacles(); r.waves = genWaves(stage, r.depth);
      if ((stage === 1 && chance(.6)) || (stage === 4 && chance(.3))) { r.obs = []; r.gates = genGates(); }
      if (stage === 2) r.wells = genWells(randi(1, 2));
      else if (stage === 4 && chance(.4)) r.wells = genWells(1);
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
      r.peds.push({ x: W / 2, y: H / 2 - 20, up: rollUps(1, 6)[0], price: 0, taken: false });
      r.pickups.push({ x: W / 2 - 150, y: H / 2, kind: 'heart', t: 0 });
      for (let i = 0; i < 5; i++) r.pickups.push({ x: W / 2 + 130 + rand(40), y: H / 2 - 20 + rand(40), kind: 'shard', t: 0 });
    } else if (r.type === 'altar') {
      rollUps(2, 6, u => u.tier >= 1).forEach((u, i) => r.peds.push({ x: W / 2 + (i ? 110 : -110), y: H / 2, up: u, price: 0, hpCost: 1, taken: false }));
    } else if (r.type === 'start' && META.un.startped && stage === 0) {
      r.peds.push({ x: W / 2, y: H / 2 - 75, up: rollUps(1, 0)[0], price: 0, group: 1, taken: false });
    }
  }
  return { rooms, start: rooms[0] };
}

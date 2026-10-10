'use strict';
let frames = 0;
function sim(sec, bot, untilClear) {
  for (let t = 0; t < sec && G.state === 'play'; t += 1 / 60) {
    if (untilClear && R.room.cleared) return t;
    if (bot !== false) demoBot();
    frame(1 / 60);
    if (frames++ % 7 === 0) render(CTX);
    IN.end();
  }
}
function unlockAll() { for (const u of UNLOCKS) META.un[u.id] = true; }
function room(type) { return R.floor.rooms.find(r => r.type === type && !r.cleared) || R.floor.rooms.find(r => r.type === type); }

// 1. no upgrade is ever a no-op: on the base ship and on top of random builds
let bad = 0;
for (let trial = 0; trial < 40; trial++) {
  const ship = SHIPS[trial % SHIPS.length], build = trial < 6 ? [] : Array.from({ length: 12 }, () => pick(UPS).id);
  const a = JSON.stringify(computeStats(ship, build));
  for (const u of UPS) if (!u.hidden && JSON.stringify(computeStats(ship, build, u.id)) === a) { bad++; console.log('NO-OP', u.id, 'on', ship.id, build.join(',')); }
}
console.log('no-op check:', bad ? bad + ' failures' : 'ok', '(' + UPS.length + ' upgrades)');

// 2. screens
for (const s of ['title', 'gallery']) { G.state = s; IN.mx = 300; IN.my = 300; frame(1 / 60); render(CTX); }
G.state = 'title';

// 3. fresh-save run: base ship, bot plays until death (or 4 minutes)
G.god = false;
newRun();
let visited = 0;
for (let i = 0; i < 240 && G.state === 'play'; i++) {
  sim(1);
  if (G.state === 'play' && R.room.cleared) { const n = R.floor.rooms.find(r => !r.cleared && r.type === 'fight'); if (n) { enterRoom(n, null); visited++; } else break; }
}
console.log('fresh run:', G.state, 'time', R.time.toFixed(0), 'rooms', R.st.rooms, 'kills', R.st.kills, 'absorbed', R.st.absorbed, 'hp', R.P.hp, 'unlocked', G.newUn.map(u => u.id).join(','));
G.state = 'dead'; G.endT = 2; render(CTX); G.state = 'title';

// 4. every stage, every room type, each boss; with a modest random build
unlockAll(); G.god = true;
for (const ship of SHIPS) {
  META.ship = ship.id; newRun(); R.nStages = 5;
  for (let st = 0; st < 5; st++) {
    if (st) startStage(st);
    for (let i = 0; i < 2; i++) giveUp(pick(UPS).id);
    const types = {}; for (const r of R.floor.rooms) types[r.type] = (types[r.type] || 0) + 1;
    for (const r of R.floor.rooms.filter(r => r.type === 'fight').slice(0, 3)) { enterRoom(r, null); sim(60, true, true); if (!r.cleared) console.log('  room not cleared in 60s', ship.id, st, 'wave', R.wave, JSON.stringify(R.enemies.map(e => [e.type, e.x | 0, e.y | 0, e.hp | 0])), JSON.stringify(r.obs)); }
    for (const t of ['treasure', 'shop', 'challenge']) {
      const r = room(t); if (!r) continue;
      enterRoom(r, null); R.P.shards = 99; R.P.x = r.peds[0].x; R.P.y = r.peds[0].y; sim(.2, false); IN.pressed.KeyE = true; sim(.1, false); if (t === 'challenge') sim(120, true, true);
    }
    enterRoom(room('boss'), null);
    const boss = R.room, t0 = R.time; sim(240, true, true); const maxB = R.bullets.length;
    console.log(ship.id, 'stage', st, JSON.stringify(types), 'ups', R.P.ups.length, 'boss', boss.cleared ? (R.time - t0).toFixed(0) + 's' : 'NOT KILLED', 'dps', (ENEMY[PAL.boss[0]].hp * PAL.boss.length / (R.time - t0)).toFixed(0));
    G.state = 'pause'; render(CTX); G.state = 'play';
  }
  if (!R.room.portal) { console.log('  (bot never killed the last boss; skipping the win check)'); G.state = 'title'; continue; }
  R.P.x = R.room.portal.x; R.P.y = R.room.portal.y; sim(.1, false);
  if (G.state === 'win') { G.endT = 2; render(CTX); }
  if (G.state !== 'win') console.log('expected win, got', G.state, ship.id, R.stage, R.room.type, R.room.cleared, G.hitstop, R.P.x | 0, R.P.y | 0, JSON.stringify(R.room.portal), R.over);
  G.state = 'title';
}

// 5. every upgrade individually, then all at once, in live combat
META.ship = 'tri';
for (const u of UPS) { newRun(); R.nStages = 5; startStage(2); giveUp(u.id); giveUp(u.id); enterRoom(room('fight'), null); sim(6); }
newRun(); R.nStages = 5; startStage(4);
for (const u of UPS) giveUp(u.id);
enterRoom(room('fight'), null); sim(20); enterRoom(room('boss'), null); sim(30);
console.log('all-upgrades build ok; shots', R.shots.length, 'state', G.state, 'frames', frames);

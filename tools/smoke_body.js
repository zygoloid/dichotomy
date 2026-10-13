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
for (let trial = 0; trial < 600; trial++) {
  // builds are drawn without repeats, as in play
  const ship = SHIPS[trial % SHIPS.length], pool = UPS.map(u => u.id), build = [];
  for (let k = 0; trial >= 6 && k < 16; k++) build.push(pool.splice(randi(0, pool.length - 1), 1)[0]);
  const a = JSON.stringify(computeStats(ship, build));
  for (const u of UPS) if (!u.hidden && JSON.stringify(computeStats(ship, build, u.id)) === a) { bad++; console.log('NO-OP', u.id, 'on', ship.id, build.join(',')); }
}
console.log('no-op check:', bad ? bad + ' failures' : 'ok', '(' + UPS.length + ' upgrades)');

// 2. screens
for (const s of ['title', 'gallery', 'profiles']) { G.state = s; IN.mx = 300; IN.my = 300; frame(1 / 60); render(CTX); }
G.state = 'title';

// 2b. profiles: each slot keeps its own progress, settings are shared, a wipe leaves a fresh slot,
// and what is exported comes back the same
{
  const fail = m => console.log('PROFILE FAIL:', m);
  mAdd('kills', 7); META.un.shop = true; META.vol = .5; saveMeta();
  switchSlot(1);
  if (!isFresh(META) || META.un.shop) fail('slot 2 not fresh');
  if (META.vol !== .5) fail('settings not shared');
  mAdd('kills', 3); switchSlot(0);
  if (mGet('kills') !== 7 || !META.un.shop) fail('slot 1 lost progress');
  if (slotData(1).stats.kills !== 3) fail('slot 2 not stored');
  const text = JSON.stringify({ game: 'dichotomy', v: 1, profile: packProfile(slotData(0)) }), back = parseProfile(text);
  if (!back || JSON.stringify(packProfile(back)) !== JSON.stringify(packProfile(META))) fail('export does not round-trip');
  for (const junk of ['', 'null', '[]', '{"game":"dichotomy"}', '{"game":"other","profile":{}}', '"x"']) if (parseProfile(junk)) fail('junk accepted: ' + junk);
  const odd = parseProfile('{"stats":{"kills":"9","runs":2,"x":-1},"un":{"shop":1},"ship":"nope","asc":99}');
  if (!odd || odd.stats.kills || odd.stats.runs !== 2 || odd.un.shop !== true || odd.ship !== 'tri' || odd.asc !== 6) fail('import not cleaned ' + JSON.stringify(odd));
  SLOT = 1; loadMeta(); // a reload comes back to the slot that was in play
  if (SLOT !== 0 || mGet('kills') !== 7) fail('reload');
  deleteSlot(1); deleteSlot(0);
  if (!isFresh(META) || !isFresh(slotData(1)) || META.vol !== .5) fail('wipe');
  // the screen itself: pick the third slot, play it; then hold X on it
  G.state = 'profiles'; G.profSel = 0; IN.mouseIdle = 9;
  IN.pressed.KeyD = true; frame(1 / 60); IN.end(); IN.pressed.KeyD = true; frame(1 / 60); IN.end();
  IN.pressed.Space = true; frame(1 / 60); IN.end();
  if (G.state !== 'title' || SLOT !== 2) fail('choosing a slot: ' + G.state + ' ' + SLOT);
  mAdd('runs'); G.state = 'profiles'; G.profSel = 2; IN.keys.KeyX = true;
  for (let i = 0; i < 60; i++) { frame(1 / 60); render(CTX); IN.end(); }
  if (isFresh(META)) fail('wiped too soon');
  for (let i = 0; i < 40; i++) { frame(1 / 60); render(CTX); IN.end(); }
  IN.keys = {};
  if (!isFresh(META)) fail('hold did not wipe');
  switchSlot(0); G.state = 'title'; META.vol = 1;
  console.log('profiles ok');
}

// 2c. attract mode: starts by itself, plays on a copy, and gives everything back
{
  mAdd('kills', 5); META.un['ship:sq'] = true; META.ship = 'tri';
  const before = JSON.stringify(META), store0 = JSON.stringify(localStorage.getItem(slotKey(SLOT)));
  for (let round = 0; round < 6; round++) {
    G.idle = 0; let n = 0, dead = 0;
    while (!G.attract && n++ < 60 * 25) { frame(1 / 60); IN.end(); }
    if (!G.attract) { console.log('ATTRACT FAIL: never started'); break; }
    for (n = 0; G.attract && n < 60 * 60; n++) { frame(1 / 60); if (n % 7 === 0) render(CTX); if (R.over) dead++; IN.end(); if (round === 5 && n === 200) IN.any = true; }
    console.log('attract', round, 'ran', (n / 60).toFixed(1) + 's', 'ship', R.ship.id, 'stage', R.stage, 'rooms', R.st.rooms, 'kills', R.st.kills, dead ? 'destroyed' : 'alive', G.state);
    if (G.state !== 'title' || JSON.stringify(META) !== before || JSON.stringify(localStorage.getItem(slotKey(SLOT))) !== store0) console.log('ATTRACT FAIL: state leaked', G.state, JSON.stringify(META));
  }
  delete META.stats.kills; delete META.un['ship:sq']; G.toasts = [];
}

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
  META.ship = ship.id; newRun(); R.nStages = 6;
  for (let st = 0; st < 6; st++) {
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
    if (G.state === 'play') { G.state = 'pause'; render(CTX); G.state = 'play'; }
  }
  if (G.state === 'win') { G.endT = 2; render(CTX); G.state = 'title'; continue; } // the bot already flew into the portal
  if (!R.room.portal) { console.log('  (bot never killed the last boss; skipping the win check)'); G.state = 'title'; continue; }
  R.P.x = R.room.portal.x; R.P.y = R.room.portal.y; sim(.1, false);
  if (G.state === 'win') { G.endT = 2; render(CTX); }
  if (G.state !== 'win') console.log('expected win, got', G.state, ship.id, R.stage, R.room.type, R.room.cleared, G.hitstop, R.P.x | 0, R.P.y | 0, JSON.stringify(R.room.portal), R.over);
  G.state = 'title';
}

// 5. every upgrade individually, then all at once, in live combat
META.ship = 'tri';
for (const u of UPS) { newRun(); R.nStages = 6; startStage(2); giveUp(u.id); giveUp(u.id); enterRoom(room('fight'), null); sim(6); }
newRun(); R.nStages = 6; startStage(4);
for (const u of UPS) giveUp(u.id);
enterRoom(room('fight'), null); sim(20); enterRoom(room('boss'), null); sim(30);
console.log('all-upgrades build ok; shots', R.shots.length, 'state', G.state, 'frames', frames);

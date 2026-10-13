'use strict';
// Persistent progression. Everything unlockable is one row in UNLOCKS, gated on a
// lifetime counter, so the gallery and the unlock checks share a single table.
// META is the profile being played (stats, un, ship, asc) plus the settings, which are shared
// by every profile.
const META = { stats: {}, un: {}, ship: 'tri', asc: 0, mute: false, fx: 1, vol: 1 };
const SAVE_KEY = 'dichotomy-1', OLD_SAVE_KEY = 'geometry-bash-1'; // the game's first name; old saves are still read

// ---- profiles
// There are always NSLOTS profiles; one that has never been played is simply fresh. The first
// lives where the only save used to, so saves from before profiles carry straight on.
const NSLOTS = 3, CFG_KEY = 'dichotomy-cfg';
const slotKey = i => i ? SAVE_KEY + '.' + (i + 1) : SAVE_KEY;
let SLOT = 0;
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } },
  json(k) { try { return JSON.parse(this.get(k) || 'null'); } catch (e) { return null; } }
};

// A profile rebuilt from untrusted data (a stored save or an imported file), keeping only what
// a profile can hold. Returns null if d is not an object at all.
function cleanProfile(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const p = { stats: {}, un: {}, ship: 'tri', asc: 0 }, obj = o => o && typeof o === 'object' ? o : {};
  for (const k of Object.keys(obj(d.stats))) if (typeof d.stats[k] === 'number' && isFinite(d.stats[k]) && d.stats[k] > 0) p.stats[k] = d.stats[k];
  for (const k of Object.keys(obj(d.un))) if (d.un[k]) p.un[k] = true;
  if (SHIPS.some(s => s.id === d.ship)) p.ship = d.ship;
  p.asc = clamp(Math.floor(+d.asc) || 0, 0, 6);
  // saves from before the item-room and shop chains keep what they had
  if (p.un.ped3) p.un.tre2 = p.un.tre3 = true;
  if (p.un.reroll) p.un.trer = p.un.shopr = true;
  if (p.un.shop && (p.un.ped3 || p.un.reroll)) p.un.shop2 = p.un.shop3 = true;
  return p;
}
const freshProfile = () => cleanProfile({});
const packProfile = p => ({ stats: p.stats, un: p.un, ship: p.ship, asc: p.asc });
const isFresh = p => !Object.keys(p.stats).some(k => p.stats[k] > 0);
function useProfile(p) { META.stats = p.stats; META.un = p.un; META.ship = p.ship; META.asc = p.asc; }
// what is in a slot: the live profile for the one being played, the stored one for the others
const slotData = i => i === SLOT ? META : (G.fakeSlots && G.fakeSlots[i]) || cleanProfile(LS.json(slotKey(i))) || freshProfile();

function saveMeta() {
  if (G.noSave) return; // the attract mode plays on a copy of the profile
  LS.set(slotKey(SLOT), JSON.stringify(packProfile(META)));
  LS.set(CFG_KEY, JSON.stringify({ slot: SLOT, mute: META.mute, fx: META.fx, vol: META.vol }));
}
function loadMeta() {
  if (!LS.get(SAVE_KEY) && LS.get(OLD_SAVE_KEY)) LS.set(SAVE_KEY, LS.get(OLD_SAVE_KEY));
  const cfg = LS.json(CFG_KEY) || LS.json(SAVE_KEY) || {}; // the settings used to live in the one save
  META.mute = !!cfg.mute;
  if (typeof cfg.fx === 'number') META.fx = clamp(cfg.fx, 0, 1);
  if (typeof cfg.vol === 'number') META.vol = clamp(cfg.vol, 0, 1);
  SLOT = clamp(Math.floor(+cfg.slot) || 0, 0, NSLOTS - 1);
  useProfile(cleanProfile(LS.json(slotKey(SLOT))) || freshProfile());
}
function switchSlot(i) {
  if (i === SLOT) return;
  saveMeta();
  const p = slotData(i);
  SLOT = i; useProfile(p);
  saveMeta();
}
// Wipes a profile for good. Its slot is left fresh.
function deleteSlot(i) {
  LS.del(slotKey(i));
  if (!i) LS.del(OLD_SAVE_KEY); // or the old save would be picked up again
  if (i === SLOT) useProfile(freshProfile());
}

// A profile leaves as a small JSON file and comes back the same way.
function exportProfile(i) {
  if (typeof Blob === 'undefined' || typeof URL === 'undefined') return false;
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([JSON.stringify({ game: 'dichotomy', v: 1, profile: packProfile(slotData(i)) })], { type: 'application/json' }));
  a.href = url; a.download = 'dichotomy-profile-' + (i + 1) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}
// Read a profile out of the text of a file; null if it is not one. A bare save from before
// profiles is accepted too.
function parseProfile(text) {
  try {
    const d = JSON.parse(text);
    return cleanProfile(d && d.game === 'dichotomy' ? d.profile : d && d.stats && d.un ? d : null);
  } catch (e) { return null; }
}
// Asks for a file and loads it into slot i, but only if that slot is still fresh when the file
// arrives: importing never overwrites progress. done(ok) is called once a file has been chosen.
function importProfile(i, done) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    if (f.size > 1 << 20) return done(false);
    const rd = new FileReader();
    rd.onerror = () => done(false);
    rd.onload = () => {
      const p = parseProfile(rd.result);
      if (!p || !isFresh(slotData(i))) return done(false);
      LS.set(slotKey(i), JSON.stringify(packProfile(p)));
      if (i === SLOT) useProfile(p);
      done(true);
    };
    rd.readAsText(f);
  };
  inp.click();
}
// how much of everything a profile has unlocked, 0 to 1
const profFrac = p => UNLOCKS.filter(u => p.un[u.id]).length / UNLOCKS.length;

const mGet = k => META.stats[k] || 0;
function mAdd(k, n) { META.stats[k] = mGet(k) + (n === undefined ? 1 : n); }
function mMax(k, v) { if (v > mGet(k)) META.stats[k] = v; }

// icons for the lifetime counters, shown beside locked items in the gallery
const MSTAT_ICON = {
  kills: 'P2.5,2.5,7.5,2.5,7.5,7.5,2.5,7.5;L1,9,9,1', absorbed: 'C5,5,3.5;A9.5,.5,6.5,3.5', flips: UP.contrast.icon, bursts: UP.burst.icon,
  grazes: UP.graze.icon, shards: UP.greed.icon, rooms: 'P1,1,9,1,9,9,1,9;L4,9,4,6,6,6,6,9', runs: 'P3,2,8,5,3,8',
  wins: 'P1,8,1,3,3.5,5.5,5,2,6.5,5.5,9,3,9,8', bosses: 'P2,2,8,2,9,6,5,9,1,6;D3.8,4.5,.8;D6.2,4.5,.8',
  chain: 'D2,5,1.2;D5,5,1.2;D8,5,1.2', taken: 'C5,3.6,2.4;R5,8.4,3.2,180,360;L1.8,8.4,8.2,8.4', stage: 'L1,9,1,7,4,7,4,5,7,5,7,3,9,3',
  elites: 'P5,.8,6.3,3.8,9.5,3.8,7,6,8,9.3,5,7.4,2,9.3,3,6,.5,3.8,3.7,3.8',
  lattice: 'P5,1,9,5,5,9,1,5;L3,3,7,7;L7,3,3,7', secrets: 'P1,1,9,1,9,9,1,9;L5,1,4,4,6,6,5,9', minis: 'P3,2.5,7,2.5,8.5,6,5,8.5,1.5,6;D4,5,.7;D6,5,.7',
  tItems: 'C5,3.6,2.4;D5,3.6,1;R5,8.4,3.2,180,360;L1.8,8.4,8.2,8.4', sItems: 'P2,4,8,4,7,9,3,9;R5,4,2,180,360',
  hits: UP.berserk.icon, nohit: UP.shield.icon, asc: 'P5,1,9,9,1,9'
};

const SHIPS = [
  { id: 'tri', fn: s => { } },
  { id: 'sq', fn: s => { s.maxHp += 2; s.move *= 0.88; s.hitR *= 1.3; s.dmg *= 1.15; s.knock *= 2; } },
  { id: 'dia', fn: s => { s.maxHp -= 2; s.move *= 1.25; s.rate *= 1.3; s.hitR *= 0.7; } },
  { id: 'hex', fn: s => { s.orbit += 2; s.dmg *= 0.85; } },
  { id: 'circ', fn: s => { s.ring += 1; s.count += 5; s.dmg *= 0.8; s.nova += 1; } },
  { id: 'star', fn: s => { s.maxHp -= 1; s.luck += 2; }, wild: 3 }
];

function shipPath(c, id, x, y, r, a) {
  c.beginPath();
  const pt = (g, d) => c.lineTo(x + Math.cos(a + g) * d, y + Math.sin(a + g) * d);
  switch (id) {
    case 'sq': for (let i = 0; i < 4; i++) pt(Math.PI / 4 + i * Math.PI / 2, r * 1.15); break;
    case 'dia': pt(0, r * 1.5); pt(Math.PI / 2, r * .6); pt(Math.PI, r * .9); pt(-Math.PI / 2, r * .6); break;
    case 'hex': for (let i = 0; i < 6; i++) pt(i * TAU / 6, r * 1.1); break;
    case 'circ': c.arc(x, y, r, 0, TAU); break;
    case 'star': for (let i = 0; i < 10; i++) pt(i * TAU / 10, i % 2 ? r * .55 : r * 1.3); break;
    default: pt(0, r * 1.3); pt(2.5, r); pt(Math.PI, r * .4); pt(-2.5, r);
  }
  c.closePath();
}

const UNLOCKS = [], UN = {};
function UL(id, kind, stat, n, ic) { const u = { id, kind, stat, n, icon: ic }; UNLOCKS.push(u); UN[id] = u; }

for (const u of UPS) if (u.stat) UL(u.id, 'up', u.stat, u.n);
UL('ship:sq', 'ship', 'runs', 4);
UL('ship:dia', 'ship', 'kills', 300);
UL('ship:hex', 'ship', 'absorbed', 1000);
UL('ship:circ', 'ship', 'flips', 500);
UL('ship:star', 'ship', 'wins', 1);
UL('shop', 'room', 'shards', 40, 'P2,4,8,4,7,9,3,9;R5,4,2,180,360');
// Item rooms and shops grow as you use them: each chain is unlocked by taking items from
// that kind of room. An item room starts with a single item, a shop with a single upgrade.
UL('tre2', 'room', 'tItems', 2, 'D3.5,6,1;D6.5,6,1;L1,8,9,8');          // a choice of two
UL('tre3', 'room', 'tItems', 8, 'D2,6,1;D5,6,1;D8,6,1;L1,8,9,8');       // a choice of three
UL('trer', 'room', 'tItems', 16, 'D2.2,7,.9;D4.6,7,.9;L1,8.6,6,8.6;R7,3.6,2.2,40,330;A8.6,1.6,9,3.4'); // and a reroll pedestal
UL('shop2', 'room', 'sItems', 1, 'P2,4,8,4,7,9,3,9;R5,4,2,180,360;D5,6.6,.9');                    // a heart for sale
UL('shop3', 'room', 'sItems', 4, 'P2,4,8,4,7,9,3,9;R5,4,2,180,360;D3.9,6.6,.8;D6.1,6.6,.8');      // a second upgrade
UL('shopr', 'room', 'sItems', 10, 'P1,5,5.6,5,4.9,9,1.7,9;R3.3,5,1.4,180,360;R7.4,3.4,2,40,330;A8.8,1.6,9.2,3.2'); // and a reroll pedestal
UL('challenge', 'room', 'bosses', 2, 'L2,2,8,8;L8,2,2,8;C5,5,4.5');
UL('treasure2', 'room', 'taken', 40, 'C3,4,1.7;L1.3,7.5,4.7,7.5;C7,4,1.7;L5.3,7.5,8.7,7.5');
UL('startped', 'room', 'runs', 6, 'P3,2,8,5,3,8;D2,8,1');
UL('stage4', 'stage', 'wins', 1, 'L1,9,1,7,4,7,4,5,7,5,7,3,9,3;D8,1.2,.8');
UL('stage5', 'stage', 'wins', 2, 'L1,9,1,7,4,7,4,5,7,5,7,3,9,3;D7,1.2,.8;D9,1.2,.8');
UL('alt1', 'stage', 'bosses', 3, 'L1,8,4,8;A4,8,9,4;A4,8,9,9.4;D2,3,.8');
UL('alt2', 'stage', 'bosses', 6, 'L1,8,4,8;A4,8,9,4;A4,8,9,9.4;D2,3,.8;D4.2,3,.8');
UL('alt3', 'stage', 'bosses', 10, 'L1,8,4,8;A4,8,9,4;A4,8,9,9.4;D2,3,.8;D4.2,3,.8;D6.4,3,.8');
UL('stage6', 'stage', 'wins', 3, 'L1,9,1,7,4,7,4,5,7,5,7,3,9,3;D5,1.2,.8;D7,1.2,.8;D9,1.2,.8');
UL('rm:maze', 'room', 'rooms', 10, 'P1,1,9,1,9,9,1,9;L1,4,6,4;L4,7,9,7;L6,4,6,7');
UL('rm:vault', 'room', 'bursts', 8, 'P1,2,9,2,9,8,1,8;D5,5,1.3;L5,2,5,3.5;L5,6.5,5,8');
UL('rm:movers', 'room', 'rooms', 25, 'P1.4,3,5.4,3,5.4,7,1.4,7;L7.82,3.35,9.47,5,7.82,6.65;L5.73,3.35,7.38,5,5.73,6.65');
UL('rm:polar', 'room', 'flips', 60, 'P1,2,4.5,2,4.5,8,1,8;F5.5,2,9,2,9,8,5.5,8');
UL('rm:danger', 'room', 'rooms', 40, 'P3,3,7,3,7,7,3,7;L5,3,5,.8;L5,7,5,9.2;L3,5,.8,5;L7,5,9.2,5');
UL('tele:hole', 'room', 'lattice', 1, // reaching the Lattice floor, where they are at home
   'C2.6,5,2.2;D2.6,5,.8;C7.4,5,2.2;D7.4,5,.8');
UL('tele:wrap', 'room', 'rooms', 75, 'L1,1,1,3.5;L1,6.5,1,9;L9,1,9,3.5;L9,6.5,9,9;A2.5,5,.5,5;A7.5,5,9.5,5');
UL('en:splitter', 'enemy', 'kills', 100);
UL('en:sniper', 'enemy', 'rooms', 15);
UL('en:flipper', 'enemy', 'runs', 2);
UL('en:weaver', 'enemy', 'bosses', 1);
UL('en:bomber', 'enemy', 'rooms', 40);
UL('en:mirror', 'enemy', 'kills', 500);
UL('altar', 'room', 'elites', 5, 'P2,9,8,9,7,6,3,6;P5,5,3.2,3,4,1.5,5,2.2,6,1.5,6.8,3');
for (let i = 1; i <= 6; i++) UL('asc' + i, 'asc', 'asc', i);

const isUnlocked = id => !UN[id] || !!META.un[id];
const maxAsc = () => { let n = 0; while (n < 6 && META.un['asc' + (n + 1)]) n++; return n; };

// Returns newly unlocked rows (and records them).
function checkUnlocks() {
  const out = [];
  for (const u of UNLOCKS) {
    if (META.un[u.id] || mGet(u.stat) < u.n) continue;
    META.un[u.id] = true; out.push(u);
  }
  if (out.length) saveMeta();
  return out;
}

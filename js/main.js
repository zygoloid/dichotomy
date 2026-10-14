'use strict';
// Boot + main loop. URL hash flags: #dbg enables debug keys, #demo auto-plays (used for screenshots;
// see tools/shot.sh for the demo sub-flags).
(function () {
  const view = document.getElementById('view');
  const scene = document.createElement('canvas');
  scene.width = W; scene.height = H;
  const ctx = scene.getContext('2d');
  let usePost = POST.init(view);
  // a transparent layer composited over the post-processed frame; wormholes use it for anything
  // overlapping a ring
  const over = document.createElement('canvas');
  over.width = W; over.height = H;
  G.ov = usePost ? over.getContext('2d') : null;
  if (!usePost) { view.parentNode.replaceChild(scene, view); scene.id = 'view'; }
  IN.init(usePost ? view : scene);
  loadMeta();
  AU.mute = !!META.mute;
  G.shipSel = Math.max(0, SHIPS.findIndex(s => s.id === META.ship));
  const hash = (typeof location !== 'undefined' && location.hash) || '';
  G.debug = hash.includes('dbg');
  G.demo = hash.includes('demo');
  if (G.demo) {
    if (hash.includes('sample')) {
      // made-up profiles for screenshots, never saved: sample0-3 chooses how far the one in play has got
      const mk = (k, ship) => {
        const p = freshProfile(), list = UNLOCKS.slice(0, [0, 12, 46, UNLOCKS.length][k]);
        if (!k) return p;
        for (const u of list) p.un[u.id] = true;
        if (k > 1) for (const id of ['stage4', 'stage5', 'asc1', 'asc2'].concat(k > 2 ? [] : ['ship:' + ship])) p.un[id] = true;
        p.stats = { stage: [0, 1, 5, 6][k], runs: [0, 5, 61, 240][k], bosses: [0, 0, 19, 150][k], wins: [0, 0, 2, 31][k], kills: [0, 96, 4870, 30512][k], rooms: [0, 14, 410, 2204][k], taken: [0, 9, 388, 1987][k] };
        p.ship = ship;
        if (k > 1) UPS.forEach((u, i) => { const v = Math.min(upMax(u.id), k > 2 ? (i % 5 ? 3 : 2) : i % 4 ? 0 : 1); if (v) p.lv[u.id] = v; });
        return p;
      };
      const k = +(/sample(\d)/.exec(hash) || [0, 2])[1];
      G.noSave = true; G.fakeSlots = [mk(k, 'dia'), mk(1, 'tri'), mk(0, 'tri')];
      if (k === 2) { G.fakeSlots[1] = mk(3, 'star'); G.fakeSlots[2] = mk(1, 'tri'); }
      useProfile(G.fakeSlots[0]); G.shipSel = Math.max(0, SHIPS.findIndex(s => s.id === META.ship));
    }
    if (hash.includes('profiles')) { G.state = 'profiles'; G.profSel = +((/sel(\d+)/.exec(hash) || [])[1] || 0); }
    else if (hash.includes('attract')) { startAttract(); IN.mouseIdle = 9; for (let i = 0; i < 60 * +((/-t(\d+)/.exec(hash) || [0, 3])[1]); i++) { frame(1 / 60); IN.end(); } }
    else if (hash.includes('gallery')) { G.state = 'gallery'; G.galSel = +((/sel(d+)/.exec(hash) || [])[1] || 0); }
    else if (!hash.includes('title')) {
      if (hash.includes('unlockall')) for (const u of UNLOCKS) META.un[u.id] = true;
      const lv = /lv(\d)/.exec(hash), av = /asc(\d)/.exec(hash), sac = /sac(\d+)/.exec(hash);
      if (lv) { G.noSave = true; for (const u of UPS) if (Math.min(+lv[1], upMax(u.id))) META.lv[u.id] = Math.min(+lv[1], upMax(u.id)); }
      newRun();
      if (av) R.asc = +av[1];
      const m = /stage(\d)/.exec(hash), ups = /ups(\d+)/.exec(hash);
      const th = /theme(\d)/.exec(hash);
      if (th) { R.nStages = 6; R.route[STAGES[+th[1]].depth] = +th[1]; startStage(STAGES[+th[1]].depth); }
      else if (m) { R.nStages = 6; startStage(+m[1]); }
      for (let i = 0; i < (ups ? +ups[1] : 6); i++) giveUp(pick(UPS).id);
      const w = /with=([a-z,]+)/.exec(hash);
      if (w) for (const id of w[1].split(',')) giveUp(id);
      if (hash.includes('crack')) { const h = R.floor.rooms.find(r => r.hidden); h.waves = []; h.cleared = true; enterRoom(h, null); }
      else if (hash.includes('boss')) enterRoom(R.floor.rooms.find(r => r.type === 'boss'), null);
      else {
        const want = (/room=([a-z]+)/.exec(hash) || [])[1] || (hash.includes('treasure') ? 'treasure' : 'fight');
        const lay = (/layout=([a-z]+)/.exec(hash) || [])[1]; // reroll the floor until it has the requested layout
        for (let i = 0; lay && i < 60 && !R.floor.rooms.some(r => r.layout === lay); i++) startStage(R.stage);
        enterRoom(R.floor.rooms.find(r => r.type === want && (want !== 'fight' || !hash.includes('gates') || r.gates.length) && (!hash.includes('current') || r.flow) && (!/layout=/.test(hash) || r.layout === /layout=([a-z]+)/.exec(hash)[1]) && (!hash.includes('holes') || r.holes.length) && (!hash.includes('gatemaze') || r.gates.length) && (!hash.includes('wraps') || r.wraps.length)) || R.floor.start, null);
      }
      for (let i = 0; sac && i < +sac[1]; i++) sacrifice(R.room.peds[0] || R.P);
      if (hash.includes('slain')) { for (let i = 0; i < 40 && !R.room.cleared; i++) { for (const e of R.enemies.slice()) damageEnemy(e, 1e9); for (let k = 0; k < 30; k++) { frame(1 / 60); IN.end(); } } R.P.x = W / 2 + 200; for (let k = 0; k < 240; k++) { frame(1 / 60); IN.end(); } }
      if (hash.includes('won')) { R.stage = R.nStages - 1; nextStage(); G.endT = 2; }
      G.god = true;
      if (hash.includes('atwall')) { R.room.obs = []; R.room.gates = []; R.room.navB = null; R.room.wraps = [{ l0: 120, r0: 460, h: 140 }]; }
      if (hash.includes('athole')) { R.room.obs = []; R.room.gates = []; R.room.navB = null; R.room.holes = [{ x: 420, y: 330, r: 56, to: 1 }, { x: 860, y: 420, r: 56, to: 0 }]; }
      if (hash.includes('pause')) setTimeout(() => { G.state = 'pause'; }, 300);
      const pre = /-t(\d+)/.exec(hash.replace("title", "").replace("treasure", "").replace("stage", ""));
      for (let i = 0; pre && i < +pre[1] * 60; i++) { demoStep(hash); frame(1 / 60); IN.end(); }
    }
  }

  let last = 0;
  function tick(now) {
    const dt = Math.min(1 / 30, Math.max(0.001, (now - last) / 1000));
    last = now;
    IN.pollPad();
    // show the crosshair only while the mouse is the aiming device and has been touched lately
    IN.mouseIdle += dt;
    const cur = IN.mouseAim && (IN.mouseIdle < 3 || IN.mb[0]) ? 'crosshair' : 'none';
    if (IN.canvas.style.cursor !== cur) IN.canvas.style.cursor = cur;
    if (G.demo && R && G.state === 'play') demoStep(hash);
    frame(dt);
    const o = render(ctx);
    if (usePost) { o.overlay = o.ov ? over : null; o.tube = o.ov ? G.tube : null; POST.draw(scene, o.src, o); }
    IN.end();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// which autopilot a demo URL asks for; used both for the pre-roll and for live frames
function demoStep(hash) {
  if (hash.includes('atwall')) demoAtWall();
  else if (hash.includes('athole')) demoAtHole();
  else if (hash.includes('onped')) demoOnPed();
  else if (!hash.includes('still')) demoBot();
}
// screenshot helper for wall links: the ship straddles the left wall while bullets stream out
// through the right wall and back in beside it
function demoAtWall() {
  R.P.x = BX0 + 4; R.P.y = 190; IN.keys = {}; IN.mb[0] = false; IN.mouseAim = false;
  if (R.time % .3 < .02) for (const k of [0, 1, 2]) eb(BX1 - 200, 480 + k * 40, 0, 120, k & 1, 7);
}
// screenshot helper for wormholes: the ship straddles one ring, an enemy straddles it lower
// down, and three lanes of big bullets stream through the twin so every stage of a crossing
// is on screen at once
function demoAtHole() {
  const h = R.room.holes[0], t = R.room.holes[1], P = R.P;
  if (!h) return;
  P.x = h.x; P.y = h.y - h.r - 3; P.tu = null; IN.keys = {}; IN.mb[0] = false; IN.mouseAim = false;
  if (!R.demoE) { R.demoE = makeEnemy('drifter', 0, 0, 1, 0); R.demoE.def = Object.assign({}, R.demoE.def, { ai() { } }); }
  R.demoE.x = h.x + (h.r + 5) * Math.cos(1.1); R.demoE.y = h.y + (h.r + 5) * Math.sin(1.1); R.demoE.vx = R.demoE.vy = 0; R.demoE.rot = .3; R.demoE.hp = R.demoE.maxHp;
  R.demoE.tu = null;
  if (R.time % .3 < .017) for (const k of [-1, 0, 1]) eb(t.x + 220, t.y + k * 30, Math.PI, 110, (k + 1) & 1, 9, { bn: 0 });
}

// screenshot helper: park on the room's first pedestal and fire
function demoOnPed() {
  const p = R.room.peds[0], t = R.enemies[1];
  if (p) { R.P.x = p.x; R.P.y = p.y; }
  IN.mouseAim = true; IN.mb[0] = !!t;
  if (t) { IN.mx = t.x; IN.my = t.y; }
  if (R.time % 1.5 < .02) IN.pressed.KeyQ = true;
}

// crude autopilot: circle, shoot the nearest enemy; match the colour of any close bullet,
// otherwise take the colour that can hurt the target
function demoBot() {
  const P = R.P, e = nearestEnemy(P.x, P.y, 2000);
  IN.keys = {};
  const a = R.time * 1.3;
  IN.keys[Math.cos(a) > 0 ? 'KeyD' : 'KeyA'] = true; IN.keys[Math.sin(a) > 0 ? 'KeyS' : 'KeyW'] = true;
  if (e) { IN.mx = e.x; IN.my = e.y; }
  IN.mouseAim = true;
  IN.mb[0] = true;
  let nb = null, nd = 160 * 160;
  for (const b of R.bullets) { const d = (b.x - P.x) * (b.x - P.x) + (b.y - P.y) * (b.y - P.y); if (d < nd) { nd = d; nb = b; } }
  if (nb ? nb.pol !== P.pol : e && e.pol === P.pol && P.stats.sameMul <= 0) IN.pressed.Space = true;
  if (P.charge >= chargeCap()) IN.pressed.KeyQ = true;
}

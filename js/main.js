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
    if (hash.includes('gallery')) { G.state = 'gallery'; G.galSel = +((/sel(d+)/.exec(hash) || [])[1] || 0); }
    else if (!hash.includes('title')) {
      if (hash.includes('unlockall')) for (const u of UNLOCKS) META.un[u.id] = true;
      newRun();
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
        enterRoom(R.floor.rooms.find(r => r.type === want && (want !== 'fight' || !hash.includes('gates') || r.gates.length) && (!hash.includes('current') || r.flow) && (!/layout=/.test(hash) || r.layout === /layout=([a-z]+)/.exec(hash)[1]) && (!hash.includes('holes') || r.holes.length) && (!hash.includes('wraps') || r.wraps.length)) || R.floor.start, null);
      }
      G.god = true;
      if (hash.includes('atwall')) { R.room.obs = []; R.room.gates = []; R.room.navB = null; R.room.wraps = [{ l0: 120, r0: 460, h: 140 }]; }
      if (hash.includes('athole')) { R.room.obs = []; R.room.gates = []; R.room.navB = null; R.room.holes = [{ x: 420, y: 330, r: 40, to: 1 }, { x: 860, y: 420, r: 40, to: 0 }]; }
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
    if (usePost) { o.overlay = o.ov ? over : null; POST.draw(scene, o.src, o); }
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
  P.x = h.x - h.r - 3; P.y = h.y; IN.keys = {}; IN.mb[0] = false; IN.mouseAim = false;
  if (!R.demoE) { R.demoE = makeEnemy('drifter', 0, 0, 1, 0); R.demoE.def = Object.assign({}, R.demoE.def, { ai() { } }); }
  R.demoE.x = h.x + (h.r + 5) * Math.cos(1.1); R.demoE.y = h.y + (h.r + 5) * Math.sin(1.1); R.demoE.vx = R.demoE.vy = 0; R.demoE.rot = .3; R.demoE.hp = R.demoE.maxHp;
  if (R.time % .16 < .017) for (const k of [-1, 0, 1]) eb(t.x + 190, t.y + k * 22, Math.PI, 110, (k + 1) & 1, 9, { bn: 0 });
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

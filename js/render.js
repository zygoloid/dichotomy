'use strict';
const GOOD = '#7dffb0', BAD = '#ff5468', HEART = '#ff5a7a', SHARD = '#ffd84a';
const FONT = 'bold 15px "Segoe UI",system-ui,sans-serif';

// light = solid with white edge, dark = hollow ring; shape language, not just hue
function polFill(c, pol, flash, lw) {
  const col = PAL.pc[pol];
  if (flash) { c.fillStyle = '#fff'; c.fill(); return; }
  if (pol === 0) { c.fillStyle = col; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = lw || 2; c.stroke(); }
  else { c.fillStyle = '#000'; c.fill(); c.fillStyle = rgba(col, .2); c.fill(); c.strokeStyle = col; c.lineWidth = (lw || 2) + 1.5; c.stroke(); }
}

function keycap(c, x, y, label, w) {
  w = w || 26;
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.5; c.strokeRect(x - w / 2, y - 13, w, 26);
  c.fillStyle = 'rgba(255,255,255,.85)'; c.font = FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(label, x, y + 1);
}
function mouseGlyph(c, x, y, btn) {
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.5;
  c.beginPath(); c.roundRect(x - 10, y - 15, 20, 30, 9); c.stroke();
  c.beginPath(); c.moveTo(x, y - 15); c.lineTo(x, y - 2); c.moveTo(x - 10, y - 2); c.lineTo(x + 10, y - 2); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(btn ? x + 1 : x - 9, y - 13, 8, 10);
}
function num(c, v, x, y, col, align) {
  c.fillStyle = col || '#fff'; c.font = FONT; c.textAlign = align || 'left'; c.textBaseline = 'middle'; c.fillText(v, x, y + 1);
}

// ---------------------------------------------------------------- background
function drawBG(c, beat) {
  const p = PAL, pulse = Math.pow(1 - (beat % 1), 3);
  c.fillStyle = p.bg; c.fillRect(0, 0, W, H);
  c.strokeStyle = p.line; c.lineWidth = 1.5; c.globalAlpha = .6 + .25 * pulse;
  c.beginPath();
  if (p.style === 0) {
    const o = (G.t * 14) % 48;
    for (let x = o; x < W; x += 48) { c.moveTo(x, 0); c.lineTo(x, H); }
    for (let y = o; y < H; y += 48) { c.moveTo(0, y); c.lineTo(W, y); }
  } else if (p.style === 1) {
    const o = (G.t * 10) % 104;
    for (let y = 0; y < H; y += 90) { c.moveTo(0, y); c.lineTo(W, y); }
    for (let k = -H + o; k < W + H; k += 104) { c.moveTo(k, 0); c.lineTo(k + H * .577, H); c.moveTo(k + H * .577, 0); c.lineTo(k, H); }
  } else if (p.style === 2) {
    for (let i = 0; i < 90; i++) {
      const x = (i * 197.3) % W, y = (i * 113.7 + i * i * 3.1) % H, s = 1 + (i % 3) + Math.sin(G.t * 2 + i) * .8;
      c.rect(x, y, s, s);
    }
    for (let i = 1; i < 6; i++) { c.moveTo(W / 2 + i * 130, H / 2); c.ellipse(W / 2, H / 2, i * 130, i * 62, 0, 0, TAU); }
  } else if (p.style === 3) {
    for (let i = 0; i < 9; i++) { const r = ((beat % 1) + i) * 90; c.moveTo(W / 2 + r, H / 2); c.arc(W / 2, H / 2, r, 0, TAU); }
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16; c.moveTo(W / 2, H / 2); c.lineTo(W / 2 + Math.cos(a) * 900, H / 2 + Math.sin(a) * 900); }
  } else if (p.style === 5) {
    // water lines: they lie along the room's current and ripple downstream at the arrows' speed
    const fl = typeof R !== 'undefined' && R && G.state !== 'title' && G.state !== 'gallery' ? R.flow : null;
    const ang = fl ? Math.atan2(fl.y, fl.x) : 0, ph = fl ? R.flowD : G.t * 60;
    c.save(); c.translate(W / 2, H / 2); c.rotate(ang);
    for (let y = -750; y <= 750; y += 60) for (let x = -800; x <= 800; x += 40) {
      const yy = y + Math.sin((x - ph) * .012 + y) * 12;
      if (x > -800) c.lineTo(x, yy); else c.moveTo(x, yy);
    }
    c.restore();
  } else if (p.style === 6) {
    const o = (G.t * 12) % 90;
    for (let k = -H + o; k < W + H; k += 90) { c.moveTo(k, 0); c.lineTo(k + H, H); c.moveTo(k + H, 0); c.lineTo(k, H); }
  } else if (p.style === 7) {
    for (let y = 60; y < H; y += 120) { c.moveTo(0, y); c.lineTo(W, y); }
    for (let i = 0; i < 70; i++) { const s = 2 + i % 4; c.rect((i * 173.1) % W, H - ((i * 97 + G.t * (20 + i % 5 * 12)) % H), s, s); }
  } else if (p.style === 8) {
    for (let i = 0; i < 9; i++) {
      const r = 60 + i * 80, rot = Math.PI / 4 + G.t * .1 * (i % 2 ? 1 : -1);
      for (let k = 0; k <= 4; k++) { const a = rot + k * TAU / 4, x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r; if (k) c.lineTo(x, y); else c.moveTo(x, y); }
    }
  } else {
    for (let i = 0; i < 9; i++) {
      const r = 50 + i * 85, rot = G.t * .12 * (i % 2 ? 1 : -1);
      for (let k = 0; k <= 6; k++) { const a = rot + k * TAU / 6, x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r; if (k) c.lineTo(x, y); else c.moveTo(x, y); }
    }
  }
  c.stroke();
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------- world
function drawRoomFrame(c) {
  const room = R.room, open = room.cleared;
  c.fillStyle = 'rgba(0,0,0,.6)';
  c.fillRect(0, 0, W, BY0); c.fillRect(0, BY1, W, H - BY1); c.fillRect(0, BY0, BX0, BY1 - BY0); c.fillRect(BX1, BY0, W - BX1, BY1 - BY0);
  c.strokeStyle = PAL.wall; c.lineWidth = 3;
  const g = 40, D = room.doors;
  c.beginPath();
  const side = (x0, y0, x1, y1, d) => {
    if (!D[d]) { c.moveTo(x0, y0); c.lineTo(x1, y1); return; }
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, ux = Math.sign(x1 - x0), uy = Math.sign(y1 - y0);
    c.moveTo(x0, y0); c.lineTo(mx - ux * g, my - uy * g); c.moveTo(mx + ux * g, my + uy * g); c.lineTo(x1, y1);
  };
  side(BX0, BY0, BX1, BY0, 'n'); side(BX1, BY0, BX1, BY1, 'e'); side(BX0, BY1, BX1, BY1, 's'); side(BX0, BY0, BX0, BY1, 'w');
  c.stroke();
  const TC = { boss: BAD, treasure: SHARD, shop: GOOD, challenge: '#b98cff', altar: HEART, mini: '#ff8a3d', secret: '#ffffff' };
  if (room.hidden) {
    // hairline cracks where a secret door can be shot open
    const [x, y] = DOOR_POS[room.hidden.dir], v = DIRV[room.hidden.dir], hot = G.t - room.hidden.flT < .15;
    c.save(); c.translate(x, y); c.rotate(Math.atan2(v[1], v[0]));
    c.scale(.7, .7); c.strokeStyle = hot ? '#fff' : rgba(PAL.wall, .45); c.lineWidth = hot ? 3 : 1.2;
    c.beginPath(); c.moveTo(-1, -26); c.lineTo(-7, -14); c.lineTo(-2, -6); c.lineTo(-10, 4); c.lineTo(-3, 12); c.lineTo(-8, 24);
    c.moveTo(-7, -14); c.lineTo(-14, -18); c.moveTo(-10, 4); c.lineTo(-16, 8); c.stroke();
    c.restore();
  }
  for (const d in D) {
    const [x, y] = DOOR_POS[d], v = DIRV[d], t = D[d], col = TC[t.type] || '#ffffff';
    c.save(); c.translate(x, y); c.rotate(Math.atan2(v[1], v[0]));
    if (!open) { c.strokeStyle = PAL.wall; c.lineWidth = 7; c.beginPath(); c.moveTo(0, -g); c.lineTo(0, g); c.stroke(); }
    else {
      c.strokeStyle = col; c.lineWidth = 3; c.globalAlpha = .6 + .4 * Math.sin(G.t * 5);
      c.beginPath(); c.moveTo(-6, -g); c.lineTo(14, -g); c.moveTo(-6, g); c.lineTo(14, g);
      c.moveTo(8, -9); c.lineTo(18, 0); c.lineTo(8, 9); c.stroke();
    }
    c.restore();
  }
}

function drawTutorial(c) {
  c.save(); c.globalAlpha = .55;
  const y = 560;
  keycap(c, 286, y - 14, 'W'); keycap(c, 258, y + 14, 'A'); keycap(c, 286, y + 14, 'S'); keycap(c, 314, y + 14, 'D');
  icon(c, UP.move.icon, 356, y, 26, '#fff');
  mouseGlyph(c, 500, y, 0); icon(c, UP.dmg.icon, 540, y, 26, '#fff');
  keycap(c, 690, y, 'SPACE', 70); mouseGlyph(c, 748, y, 1); icon(c, UP.contrast.icon, 790, y, 26, '#fff');
  keycap(c, 940, y, 'Q'); icon(c, UP.burst.icon, 980, y, 26, '#fff');
  // The rules, as a flat sign: same colour feeds you and shrugs off your shots; the other
  // colour hurts you and is the only thing your shots can hurt.
  const px = W / 2 - 340, py = 92, pw = 680, ph = 84, cy = py + ph / 2;
  c.globalAlpha = 1;
  c.fillStyle = 'rgba(255,255,255,.04)'; c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.5; c.setLineDash([3, 5]);
  c.beginPath(); c.roundRect(px, py, pw, ph, 8); c.fill(); c.stroke(); c.setLineDash([]);
  c.fillStyle = PAL.bg; c.fillRect(px + 14, py - 9, 22, 18);
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(px + 25, py, 8, 0, TAU); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(px + 24, py - 1, 2, 5); c.fillRect(px + 24, py - 5, 2, 2);
  c.globalAlpha = .5;
  const cell = (i, left, right, ok) => {
    const x = px + 62 + i * 160;
    left(x); icon(c, 'A1,5,9,5', x + 34, cy, 20, '#fff', 1.2); right(x + 68);
    icon(c, ok ? 'L2,5.5,4.2,8,8.5,2.5' : MSTAT_ICON.kills, x + 98, cy, 16, ok ? GOOD : BAD, 1.6);
    if (i < 3) { c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x + 122, py + 16, 1, ph - 32); }
  };
  const ship = x => { shipPath(c, R.ship.id, x, cy, 9, 0); polFill(c, 0, false, 1.5); };
  const shot = pol => x => { c.beginPath(); c.arc(x, cy, 5, 0, TAU); polFill(c, pol, false, 1.5); };
  const foe = pol => x => { polyPath(c, x, cy, 10, 4, Math.PI / 4); polFill(c, pol, false, 1.5); };
  cell(0, shot(0), ship, true); cell(1, shot(1), ship, false);
  cell(2, ship, foe(1), true); cell(3, ship, foe(0), false);
  c.restore();
}

function drawEnemy(c, e) {
  const col = PAL.pc[e.pol], d = e.def, x = e.x, y = e.y, r = e.r;
  if (e.spawn > 0) {
    const k = clamp(1 - e.spawn / .9, 0, 1);
    c.strokeStyle = rgba(col, .25 + .6 * k); c.lineWidth = 2;
    polyPath(c, x, y, r * (2.4 - 1.4 * k), d.sides || 12, e.rot + k * 3); c.stroke();
    return;
  }
  if (e.warn != null) {
    const L = rayLen(x, y, e.warn);
    c.strokeStyle = rgba(col, .5); c.lineWidth = 2; c.setLineDash([10, 8]);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(e.warn) * L, y + Math.sin(e.warn) * L); c.stroke(); c.setLineDash([]);
  }
  const cs = Math.cos(e.rot), sn = Math.sin(e.rot);
  c.beginPath();
  if (d.arrow) {
    c.moveTo(x + cs * r * 1.5, y + sn * r * 1.5); c.lineTo(x - cs * r - sn * r * .9, y - sn * r + cs * r * .9);
    c.lineTo(x - cs * r * .3, y - sn * r * .3); c.lineTo(x - cs * r + sn * r * .9, y - sn * r - cs * r * .9); c.closePath();
  } else if (d.thin) {
    c.moveTo(x + cs * r * 1.5, y + sn * r * 1.5); c.lineTo(x - sn * r * .65, y + cs * r * .65);
    c.lineTo(x - cs * r * 1.5, y - sn * r * 1.5); c.lineTo(x + sn * r * .65, y - cs * r * .65); c.closePath();
  } else if (d.cross) {
    const a = r, b = r * .38, pts = [[b, -a], [b, -b], [a, -b], [a, b], [b, b], [b, a], [-b, a], [-b, b], [-a, b], [-a, -b], [-b, -b], [-b, -a]];
    for (const [px, py] of pts) c.lineTo(x + px * cs - py * sn, y + px * sn + py * cs);
    c.closePath();
  } else polyPath(c, x, y, r, d.sides, e.rot);
  polFill(c, e.pol, e.fl > 0, e.boss ? 3 : 2);
  if (d.half) { c.beginPath(); c.arc(x, y, r * .55, e.rot, e.rot + Math.PI); c.closePath(); c.fillStyle = PAL.pc[e.pol ^ 1]; c.fill(); }
  if (d.hole) {
    c.fillStyle = '#000'; c.beginPath(); c.arc(x, y, r * .8, 0, TAU); c.fill();
    c.strokeStyle = col; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(x, y, r * (1.4 + i * .35), r * (.5 + i * .12), e.rot * (i % 2 ? -1 : 1) + i, 0, TAU); c.stroke(); }
  } else if (e.boss) {
    c.strokeStyle = e.pol ? col : '#fff'; c.lineWidth = 2;
    polyPath(c, x, y, r * .55, d.sides, -e.rot * 1.5); c.stroke();
    c.strokeStyle = rgba(col, .5); polyPath(c, x, y, r * 1.35, d.sides, e.rot * .5); c.stroke();
  } else if (e.pol === 0 && !d.half) {
    c.fillStyle = 'rgba(255,255,255,.8)'; polyPath(c, x, y, r * .35, d.sides, e.rot); c.fill();
  }
  if (d.mirror) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - cs * r * .6, y - sn * r * .6); c.lineTo(x + cs * r * .6, y + sn * r * .6); c.stroke(); }
  if (e.df > 0) { c.strokeStyle = col; c.lineWidth = 3; polyPath(c, x, y, r + 7, 6, G.t * 4); c.stroke(); }
  if (e.elite) {
    c.strokeStyle = SHARD; c.lineWidth = 2;
    polyPath(c, x, y, r + 10, 3, G.t * 2); c.stroke(); polyPath(c, x, y, r + 10, 3, G.t * 2 + Math.PI); c.stroke();
  }
  if (!e.boss && e.hp < e.maxHp) {
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2;
    c.beginPath(); c.arc(x, y, r + 7, -Math.PI / 2, -Math.PI / 2 + TAU * e.hp / e.maxHp); c.stroke();
  }
  if (e.burn > 0) { c.strokeStyle = '#ff9a3c'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r + 3, G.t * 9, G.t * 9 + 2); c.stroke(); }
  if (e.slowT > 0) { c.strokeStyle = '#9fe8ff'; c.lineWidth = 1.5; polyPath(c, x, y, r + 4, 6, 0); c.stroke(); }
}

function drawBeams(c) {
  for (const e of R.enemies) {
    if (!e.beams || e.spawn > 0) continue;
    for (const b of e.beams) {
      if (b.state === 'off') continue;
      const L = rayLen(e.x, e.y, b.ang), x1 = e.x + Math.cos(b.ang) * L, y1 = e.y + Math.sin(b.ang) * L, col = PAL.pc[b.pol];
      c.lineCap = b.state === 'warn' ? 'butt' : 'round';
      c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(x1, y1);
      if (b.state === 'warn') { c.strokeStyle = rgba(col, .45); c.lineWidth = 2; c.setLineDash([6, 10]); c.stroke(); c.setLineDash([]); }
      else {
        const w = 12 + Math.sin(G.t * 40) * 2;
        c.strokeStyle = rgba(col, .35); c.lineWidth = w + 10; c.stroke();
        c.strokeStyle = col; c.lineWidth = w; c.stroke();
        c.strokeStyle = b.pol ? '#000' : '#fff'; c.lineWidth = w * .45; c.stroke();
      }
      c.lineCap = 'butt';
    }
  }
}

function drawBullets(c) {
  const warn = (PAL.haz.flip || R.flipRule) && R.beat % 8 > 7 && Math.sin(G.t * 40) > 0;
  for (let pol = 0; pol < 2; pol++) {
    const col = PAL.pc[warn ? pol ^ 1 : pol];
    c.beginPath();
    for (const b of R.bullets) if (b.pol === pol) { c.moveTo(b.x + b.r, b.y); c.arc(b.x, b.y, b.r, 0, TAU); }
    if (pol === 0) {
      c.fillStyle = col; c.fill();
      c.beginPath();
      for (const b of R.bullets) if (b.pol === 0) { c.moveTo(b.x + b.r * .5, b.y); c.arc(b.x, b.y, b.r * .5, 0, TAU); }
      c.fillStyle = '#fff'; c.fill();
    } else { c.fillStyle = '#000'; c.fill(); c.strokeStyle = col; c.lineWidth = 2.8; c.stroke(); }
  }
}

function drawShots(c) {
  c.globalCompositeOperation = 'lighter';
  for (const sh of R.shots) {
    const col = PAL.pc[sh.pol], cs = Math.cos(sh.ang), sn = Math.sin(sh.ang), l = sh.r * (sh.burst ? 3.2 : 2.4), w = sh.r * .8;
    c.fillStyle = rgba(col, sh.pol ? .75 : .6);
    c.beginPath();
    c.moveTo(sh.x + cs * l, sh.y + sn * l); c.lineTo(sh.x - sn * w, sh.y + cs * w);
    c.lineTo(sh.x - cs * l, sh.y - sn * l); c.lineTo(sh.x + sn * w, sh.y - cs * w);
    c.fill();
    if (sh.pol === 0) { c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(sh.x - 1.5, sh.y - 1.5, 3, 3); }
  }
  c.globalCompositeOperation = 'source-over';
}

function drawPed(c, p, near) {
  const P = R.P, bob = Math.sin(G.t * 3 + p.x) * 4, y = p.y + bob, s = near ? 46 : 34;
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(p.x, p.y + 30, 26, 8, 0, 0, TAU); c.stroke();
  if (p.heart) icon(c, UP.vamp.icon, p.x, y, s, HEART, 1);
  else {
    const u = UP[p.up], col = TIER_COL[u.tier];
    c.strokeStyle = rgba(col, .8); c.lineWidth = 2; c.fillStyle = rgba(col, .1);
    polyPath(c, p.x, y, s * .85, TIER_SIDES[u.tier], u.tier === 3 ? Math.PI / 2 : G.t * .5); c.fill(); c.stroke();
    icon(c, u.icon, p.x, y, s * (u.tier === 3 ? .62 : .8), col, 1);
  }
  if (p.hpCost) icon(c, UP.scar.icon, p.x, p.y + 54, 22, HEART, 1.2);
  if (p.price) {
    const ok = P.shards >= p.price;
    icon(c, UP.dmg.icon, p.x - 14, p.y + 52, 14, SHARD, 1.2); num(c, p.price, p.x - 2, p.y + 52, ok ? SHARD : BAD);
  }
  if (!near) return;
  keycap(c, p.x, p.y + (p.price || p.hpCost ? 82 : 58), 'E');
  if (p.heart) return;
  const dl = statDeltas(computeStats(R.ship, P.ups), P.stats);
  let x = p.x - (dl.length - 1) * 21;
  for (const d of dl) {
    const col = d.good ? GOOD : BAD;
    icon(c, d.icon, x, p.y - 64, 20, '#fff', 1);
    c.fillStyle = col;
    for (let i = 0; i < d.n; i++) {
      const ay = p.y - 84 - i * 7, k = d.up ? -1 : 1;
      c.beginPath(); c.moveTo(x, ay + k * 4); c.lineTo(x - 5, ay - k * 3); c.lineTo(x + 5, ay - k * 3); c.fill();
    }
    x += 42;
  }
}

function drawPlayer(c) {
  const P = R.P, s = P.stats, col = PAL.pc[P.pol];
  c.strokeStyle = rgba(col, .28); c.lineWidth = 1.5;
  c.beginPath(); c.arc(P.x, P.y, s.absorbR, 0, TAU); c.stroke();
  if (s.corona && chgFrac() >= .6) {
    c.strokeStyle = rgba(col, .35 + .2 * Math.sin(G.t * 12)); c.lineWidth = 3; c.setLineDash([6, 9]); c.lineDashOffset = G.t * 60;
    c.beginPath(); c.arc(P.x, P.y, s.absorbR * 2.6, 0, TAU); c.stroke(); c.setLineDash([]);
  }
  for (let i = 1; i < s.rings; i++) if (chgFrac() > i) {
    // reserve rings sit outside the first
    c.strokeStyle = '#fff'; c.lineWidth = 3;
    c.beginPath(); c.arc(P.x, P.y, s.absorbR + 5 + i * 6, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, chgFrac() - i)); c.stroke();
  }
  if (chg() > 0) {
    c.strokeStyle = chg() >= 20 ? '#fff' : rgba(col, .6); c.lineWidth = 3;
    c.beginPath(); c.arc(P.x, P.y, s.absorbR + 5, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, chgFrac())); c.stroke();
  }
  if (P.lockT > 0) { c.strokeStyle = BAD; c.lineWidth = 2; c.beginPath(); c.arc(P.x, P.y, 19, 0, TAU * P.lockT / s.flipLock); c.stroke(); }
  if (s.ghost && P.hist.length) {
    c.globalAlpha = .4; c.setLineDash([4, 4]);
    shipPath(c, R.ship.id, P.hist[0].x, P.hist[0].y, 12, P.face); c.strokeStyle = col; c.lineWidth = 2; c.stroke();
    c.setLineDash([]); c.globalAlpha = 1;
  }
  if (s.flail) {
    const F = P.fl;
    c.strokeStyle = rgba(col, .5); c.lineWidth = 1.5; c.beginPath(); c.moveTo(P.x, P.y); c.lineTo(F.x, F.y); c.stroke();
    c.beginPath();
    for (let i = 0; i < 12; i++) { const a = G.t * 6 + i * TAU / 12, r = i % 2 ? 8 : 14; c.lineTo(F.x + Math.cos(a) * r, F.y + Math.sin(a) * r); }
    c.closePath(); polFill(c, P.pol, false, 1.5);
  }
  for (let i = 0; i < s.orbit; i++) {
    const a = R.time * 2.6 + i * TAU / s.orbit;
    shipPath(c, R.ship.id, P.x + Math.cos(a) * 48, P.y + Math.sin(a) * 48, 6, a + Math.PI / 2); polFill(c, P.pol, false, 1.5);
  }
  for (let i = 0; i < s.drone; i++) { const d = P.drones[i]; if (d) { shipPath(c, R.ship.id, d.x, d.y, 7, d.ang); polFill(c, P.pol, false, 1.5); } }
  if (P.inv > 0 && Math.sin(G.t * 40) > 0) c.globalAlpha = .35;
  shipPath(c, R.ship.id, P.x, P.y, 13, P.face); polFill(c, P.pol);
  c.globalAlpha = 1;
  c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(P.x, P.y, Math.max(2.5, s.hitR * .7), 0, TAU); c.fill(); c.stroke();
  for (let i = 0; i < P.sh; i++) { c.strokeStyle = '#9fe8ff'; c.lineWidth = 2; polyPath(c, P.x, P.y, 20 + i * 4, 6, G.t); c.stroke(); }
}

function drawWorld(c) {
  const room = R.room, P = R.P;
  c.save();
  if (R.shake * META.fx > .5) c.translate(rand(-1, 1) * R.shake * META.fx, rand(-1, 1) * R.shake * META.fx);
  drawBG(c, R.beat);
  if (room.type === 'start' && R.stage === 0) drawTutorial(c);
  if (R.flow) {
    // Chevrons ride the current. They sit on a lattice aligned with it and slide along one axis
    // only, wrapping by exactly one cell, so nothing ever jumps; each fades out near the walls.
    const fx = R.flow.x, fy = R.flow.y, a = Math.atan2(fy, fx), sp = 110, o = R.flowD % sp;
    const dim = R.flow.warn && Math.sin(G.t * 30) > 0 ? .25 : 1;
    c.lineWidth = 2;
    for (let i = -7; i <= 7; i++) for (let j = -7; j <= 7; j++) {
      const u = i * sp + o, v = j * sp, x = W / 2 + fx * u - fy * v, y = H / 2 + fy * u + fx * v;
      const edge = Math.min(x - BX0, BX1 - x, y - BY0, BY1 - y);
      if (edge <= 0) continue;
      c.strokeStyle = rgba(PAL.wall, .34 * dim * Math.min(1, edge / 70));
      c.beginPath(); c.moveTo(x - Math.cos(a - .6) * 13, y - Math.sin(a - .6) * 13); c.lineTo(x, y); c.lineTo(x - Math.cos(a + .6) * 13, y - Math.sin(a + .6) * 13); c.stroke();
    }
  }
  for (const f of room.fields) {
    const col = PAL.pc[f.pol];
    c.fillStyle = rgba(col, f.pol ? .08 : .13); c.beginPath(); c.arc(f.x, f.y, f.r, 0, TAU); c.fill();
    c.strokeStyle = rgba(col, .75); c.lineWidth = 2; c.setLineDash(f.pol ? [14, 8] : []); c.lineDashOffset = G.t * 20; c.stroke(); c.setLineDash([]);
  }
  if (R.line) {
    // the dividing line, edged with the colour bullets take on each side
    const L = R.line, cs = Math.cos(L.ang), sn = Math.sin(L.ang);
    for (const side of [1, -1]) {
      const ox = L.x + sn * 5 * side, oy = L.y - cs * 5 * side;
      c.strokeStyle = rgba(PAL.pc[side > 0 ? 0 : 1], .7); c.lineWidth = 3; c.setLineDash(side > 0 ? [] : [14, 8]);
      c.beginPath(); c.moveTo(ox - cs * 1500, oy - sn * 1500); c.lineTo(ox + cs * 1500, oy + sn * 1500); c.stroke();
    }
    c.setLineDash([]);
  }
  for (const w of room.wells) {
    c.fillStyle = '#000'; c.beginPath(); c.arc(w.x, w.y, w.core + 6, 0, TAU); c.fill();
    c.strokeStyle = PAL.wall; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const r = w.core + 8 + ((i * 60 + 240 - (G.t * 50) % 60) % 240);
      c.globalAlpha = .6 * (1 - r / 260); c.beginPath(); c.arc(w.x, w.y, r, 0, TAU); c.stroke();
    }
    c.globalAlpha = 1;
  }
  drawRoomFrame(c);
  for (const o of room.obs) {
    c.fillStyle = '#000'; c.fillRect(o.x, o.y, o.w, o.h);
    c.fillStyle = rgba(PAL.wall, .14); c.fillRect(o.x, o.y, o.w, o.h);
    c.strokeStyle = PAL.wall; c.lineWidth = 2.5; c.strokeRect(o.x, o.y, o.w, o.h);
    c.strokeStyle = rgba(PAL.wall, .4); c.lineWidth = 1; c.strokeRect(o.x + 7, o.y + 7, o.w - 14, o.h - 14);
  }
  for (const g of room.gates) {
    const col = PAL.pc[g.pol], open = g.pol === P.pol, hz = g.w > g.h;
    c.fillStyle = rgba(col, g.pol ? .1 : .3); c.fillRect(g.x, g.y, g.w, g.h);
    c.strokeStyle = col; c.lineWidth = open ? 1.5 : 3; c.setLineDash(open ? [4, 12] : g.pol ? [16, 8] : []);
    c.lineDashOffset = -G.t * 40;
    c.beginPath();
    if (hz) { c.moveTo(g.x, g.y); c.lineTo(g.x + g.w, g.y); c.moveTo(g.x, g.y + g.h); c.lineTo(g.x + g.w, g.y + g.h); }
    else { c.moveTo(g.x, g.y); c.lineTo(g.x, g.y + g.h); c.moveTo(g.x + g.w, g.y); c.lineTo(g.x + g.w, g.y + g.h); }
    c.stroke(); c.setLineDash([]);
  }
  if (room.portal) {
    const q = room.portal;
    for (let i = 0; i < 5; i++) {
      c.strokeStyle = i % 2 ? PAL.pc[0] : PAL.pc[1]; c.lineWidth = 2.5;
      polyPath(c, q.x, q.y, 10 + i * 8, 3 + i, G.t * (2.5 - i * .4) * (i % 2 ? 1 : -1)); c.stroke();
    }
  }
  for (const p of room.peds) if (!p.taken) drawPed(c, p, p === R.nearPed);
  if (rerollable().length) {
    c.globalAlpha = .8; keycap(c, W / 2 - 34, BY1 - 34, 'R'); icon(c, UN.reroll.icon, W / 2 - 4, BY1 - 34, 22, '#fff', 1);
    c.fillStyle = SHARD; polyPath(c, W / 2 + 22, BY1 - 34, 6, 4, 0); c.fill(); num(c, R.rerollCost, W / 2 + 33, BY1 - 34, P.shards >= R.rerollCost ? SHARD : BAD);
    c.globalAlpha = 1;
  }
  for (const p of R.pickups) {
    if (p.kind === 'shard') {
      c.fillStyle = SHARD; polyPath(c, p.x, p.y, 6, 4, G.t * 4 + p.x); c.fill();
    } else icon(c, UP.vamp.icon, p.x, p.y + Math.sin(G.t * 4) * 3, 24, HEART, 1.4);
  }
  for (const o of R.orbs) {
    const k = o.t / 2.6;
    c.fillStyle = '#000'; c.beginPath(); c.arc(o.x, o.y, 12 + k * 6, 0, TAU); c.fill();
    c.strokeStyle = PAL.pc[P.pol]; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) { c.globalAlpha = .7 - i * .2; c.beginPath(); c.ellipse(o.x, o.y, 22 + i * 12, 9 + i * 5, G.t * 3 * (i % 2 ? -1 : 1) + i, 0, TAU); c.stroke(); }
    c.globalAlpha = 1;
  }
  for (const m of R.mines) { polyPath(c, m.x, m.y, 7, 4, 0); polFill(c, R.P.pol, m.t > .4 && Math.sin(m.t * 14) > .6, 1.5); }
  for (const e of R.enemies) drawEnemy(c, e);
  drawBeams(c);
  drawShots(c);
  if (G.state !== 'dead') drawPlayer(c);
  drawBullets(c);
  c.globalCompositeOperation = 'lighter';
  for (const b of R.booms) { const k = b.t / .25; c.strokeStyle = rgba('#ffb060', 1 - k); c.lineWidth = 6 * (1 - k) + 1; c.beginPath(); c.arc(b.x, b.y, b.r * (.4 + .6 * k), 0, TAU); c.stroke(); }
  for (const sl of R.slashes) {
    const k = 1 - sl.t / .16;
    c.strokeStyle = rgba(PAL.pc[sl.pol], k); c.lineWidth = 14 * k + 2;
    c.beginPath(); c.arc(sl.x, sl.y, 62 + (1 - k) * 22, sl.ang - 1.15, sl.ang + 1.15); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,' + k * .8 + ')'; c.lineWidth = 3 * k; c.stroke();
  }
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const tr of R.trails) {
    // the body at full width, then the last stretch narrowing to a point
    const k = 1 - tr.t / .14, p = tr.pts, n = p.length / 2, tip = Math.min(6, n - 1), col = PAL.pc[tr.pol];
    const pass = (style, w) => {
      c.strokeStyle = style; c.lineWidth = w;
      c.beginPath(); c.moveTo(p[0], p[1]);
      for (let i = 1; i < n - tip; i++) c.lineTo(p[i * 2], p[i * 2 + 1]);
      c.stroke();
      for (let i = Math.max(1, n - tip); i < n; i++) {
        c.lineWidth = Math.max(.6, w * (n - i) / (tip + 1));
        c.beginPath(); c.moveTo(p[i * 2 - 2], p[i * 2 - 1]); c.lineTo(p[i * 2], p[i * 2 + 1]); c.stroke();
      }
    };
    pass(rgba(col, k * .8), tr.w * (1 + k));
    if (tr.pol === 0) pass('rgba(255,255,255,' + k * .7 + ')', tr.w * .4);
  }
  c.lineCap = 'butt';
  for (const a of R.arcs) {
    c.strokeStyle = rgba(PAL.pc[a.pol], 1 - a.t / .18); c.lineWidth = 2.5; c.beginPath(); c.moveTo(a.x0, a.y0);
    for (let i = 1; i < 5; i++) c.lineTo(lerp(a.x0, a.x1, i / 5) + rand(-12, 12), lerp(a.y0, a.y1, i / 5) + rand(-12, 12));
    c.lineTo(a.x1, a.y1); c.stroke();
  }
  for (const p of R.parts) {
    const k = 1 - p.t / p.life, s = p.s * k;
    c.fillStyle = rgba(p.col, k); c.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  c.globalCompositeOperation = 'source-over';
  if (R.flash > 0) { c.fillStyle = 'rgba(255,60,90,' + R.flash * .25 + ')'; c.fillRect(0, 0, W, H); }
  c.restore();
}

// ---------------------------------------------------------------- HUD
function upCounts(ups) { const m = new Map(); for (const id of ups) m.set(id, (m.get(id) || 0) + 1); return m; }

function drawUpRow(c, ups, x0, y, s, maxW) {
  let x = x0, yy = y;
  for (const [id, n] of upCounts(ups)) {
    const u = UP[id];
    icon(c, u.icon, x, yy, s, TIER_COL[u.tier], 1);
    c.fillStyle = TIER_COL[u.tier];
    for (let i = 1; i < n && i < 6; i++) c.fillRect(x - s / 2 + (i - 1) * 4, yy + s / 2 + 2, 2.5, 2.5);
    x += s + 8;
    if (x > x0 + maxW) { x = x0; yy -= s + 12; }
  }
}

function drawMinimap(c) {
  const cx = W - 130, cy = 34, cur = R.room, TC = { boss: BAD, treasure: SHARD, shop: GOOD, challenge: '#b98cff', altar: HEART, mini: '#ff8a3d', secret: '#ffffff' };
  // keep the map on the wall strip: scale so the floor's extent fits
  let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
  const vis = R.floor.rooms.filter(r => r.seen || (R.P.stats.map && TC[r.type] && r.type !== 'secret'));
  for (const r of vis) { x0 = Math.min(x0, r.gx); x1 = Math.max(x1, r.gx); y0 = Math.min(y0, r.gy); y1 = Math.max(y1, r.gy); }
  const cw = 15, ch = 9, ox = cx - (x0 + x1) / 2 * (cw + 3), oy = cy - (y0 + y1) / 2 * (ch + 3);
  c.save();
  const sc = Math.min(1, 56 / ((y1 - y0 + 1) * (ch + 3)));
  c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy);
  for (const r of vis) {
    const x = ox + r.gx * (cw + 3) - cw / 2, y = oy + r.gy * (ch + 3) - ch / 2, col = TC[r.type] || PAL.wall;
    if (r === cur) { c.fillStyle = '#fff'; c.fillRect(x, y, cw, ch); }
    else if (r.visited) { c.fillStyle = rgba(col, .55); c.fillRect(x, y, cw, ch); }
    else { c.strokeStyle = rgba(col, .8); c.lineWidth = 1.2; c.strokeRect(x + .5, y + .5, cw - 1, ch - 1); }
  }
  c.restore();
}

function drawHUD(c) {
  const P = R.P, s = P.stats, col = PAL.pc[P.pol];
  // while trying an upgrade, pips it would add blink green and pips it would cost blink red
  const baseHp = P.preview ? computeStats(R.ship, P.ups).maxHp : s.maxHp;
  for (let i = 0; i < Math.max(s.maxHp, baseHp); i++) {
    const x = 30 + (i % 12) * 24, y = 24 + Math.floor(i / 12) * 22;
    shipPath(c, R.ship.id, x, y, 9.5, -Math.PI / 2);
    if (i >= s.maxHp || i >= baseHp) { if (Math.sin(G.t * 8) > 0) { c.strokeStyle = i >= s.maxHp ? BAD : GOOD; c.lineWidth = 2; c.stroke(); } continue; }
    if (i < P.hp) { c.fillStyle = HEART; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke(); } else { c.strokeStyle = rgba(HEART, .5); c.lineWidth = 1.5; c.stroke(); }
  }
  for (let i = 0; i < P.sh; i++) { c.strokeStyle = '#9fe8ff'; c.lineWidth = 2; polyPath(c, 30 + ((s.maxHp + i) % 12) * 24, 24, 8, 6, 0); c.stroke(); }
  // charge
  const bw = 170 * Math.min(2, s.chargeMax / 100), f = chgFrac();
  for (let i = 0; i < s.rings; i++) {
    // one bar per ring, stacked
    const y = 44.5 + i * 9;
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1; c.strokeRect(20.5, y, bw, 7);
    c.fillStyle = P.preview ? rgba(col, .6 + .4 * Math.sin(G.t * 8)) : chg() >= 20 ? col : rgba(col, .5); c.fillRect(21, y + .5, (bw - 1) * clamp(f - i, 0, 1), 6);
  }
  c.fillStyle = '#fff'; c.fillRect(20 + bw * 20 / s.chargeMax, 43, 1.5, 10);
  // chain pips
  for (let i = 0; i < 3; i++) {
    c.beginPath(); c.arc(bw + 40 + i * 13, 48, 4, 0, TAU);
    if (i < P.seqN) polFill(c, P.seqPol, false, 1); else { c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1; c.stroke(); }
  }
  if (P.chain > 0) num(c, '×' + P.chain, bw + 78, 48, SHARD);
  // shards
  c.fillStyle = SHARD; polyPath(c, 28, 72 + (s.rings - 1) * 9, 7, 4, 0); c.fill(); num(c, P.shards, 42, 72 + (s.rings - 1) * 9, SHARD);
  // stage pips
  for (let i = 0; i < R.nStages; i++) {
    polyPath(c, 960 + i * 18, 24, 6, 4, 0);
    if (i < R.stage) { c.fillStyle = 'rgba(255,255,255,.5)'; c.fill(); }
    else if (i === R.stage) { c.fillStyle = PAL.wall; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); }
    else { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.stroke(); }
  }
  for (let i = 0; i < R.asc; i++) { c.fillStyle = BAD; polyPath(c, 960 + i * 12, 44, 5, 3, -Math.PI / 2); c.fill(); }
  drawMinimap(c);
  drawUpRow(c, P.ups, 30, H - 34, 22, 960);
  // boss bar
  const bosses = R.enemies.filter(e => e.boss);
  if (bosses.length) {
    const tot = R.bossMax, hp = Math.min(tot, bosses.reduce((a, e) => a + Math.max(0, e.hp) + (e.extra || 0), 0));
    const w = 520, x = W / 2 - w / 2, y = 20;
    c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.strokeRect(x - 3.5, y - 3.5, w + 7, 15);
    c.fillStyle = PAL.pc[bosses[0].pol]; c.fillRect(x, y, w * hp / tot, 8);
    c.fillStyle = '#000'; for (let i = 1; i < 10; i++) c.fillRect(x + w * i / 10 - 1, y, 2, 8);
  }
}

function drawUnlockIcon(c, u, x, y, s, col) {
  if (u.kind === 'up') icon(c, UP[u.id].icon, x, y, s, col, 1);
  else if (u.kind === 'ship') { shipPath(c, u.id.slice(5), x, y, s * .36, -Math.PI / 2); c.strokeStyle = col; c.lineWidth = 2; c.stroke(); }
  else if (u.kind === 'enemy') { const d = ENEMY[u.id.slice(3)]; polyPath(c, x, y, s * .4, d.sides, G.t); c.strokeStyle = col; c.lineWidth = 2; c.stroke(); c.beginPath(); c.arc(x, y, 2, 0, TAU); c.fillStyle = col; c.fill(); }
  else if (u.kind === 'asc') { const n = +u.id.slice(3); c.fillStyle = col; for (let i = 0; i < n; i++) { polyPath(c, x + (i % 3 - 1) * 9 * (n > 1 ? 1 : 0), y + (Math.floor(i / 3) - (n > 3 ? .5 : 0)) * 10, 5, 3, -Math.PI / 2); c.fill(); } }
  else icon(c, u.icon, x, y, s, col, 1);
}
const unlockCol = u => u.kind === 'up' ? TIER_COL[UP[u.id].tier] : u.kind === 'asc' || u.kind === 'enemy' ? BAD : u.kind === 'ship' ? '#5ff4ff' : '#ffffff';

function drawToasts(c) {
  if (!G.toasts.length) return;
  const t = G.toasts[0], k = Math.min(1, t.t * 5) * Math.min(1, (2.2 - t.t) * 5), X = W - 150, y = H - 35 + (1 - k) * 40, col = t.f ? '#ffffff' : unlockCol(t.u);
  c.save(); c.globalAlpha = k;
  c.fillStyle = 'rgba(0,0,0,.8)'; c.strokeStyle = col; c.lineWidth = 2;
  c.beginPath(); c.roundRect(X - 56, y - 25, 112, 50, 10); c.fill(); c.stroke();
  if (t.f) {
    // fusion: the two halves joined
    icon(c, UP[t.f[0]].icon, X - 30, y, 28, TIER_COL[UP[t.f[0]].tier], 1); icon(c, UP[t.f[1]].icon, X + 30, y, 28, TIER_COL[UP[t.f[1]].tier], 1);
    icon(c, 'L5,2,5,8;L2,5,8,5', X, y, 16, '#fff', 1.4);
  } else {
    icon(c, 'P2,5,8,5,8,9,2,9;R3.6,5,2.2,180,360', X - 26, y, 26, '#fff', 1);
    drawUnlockIcon(c, t.u, X + 26, y, 30, col);
  }
  c.restore();
}

// ---------------------------------------------------------------- screens
function drawTitle(c) {
  drawBG(c, G.t * 2);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 92px "Segoe UI",system-ui,sans-serif';
  const off = Math.sin(G.t * 2) * 4;
  c.lineWidth = 3; c.strokeStyle = STAGES[0].pc[1]; c.strokeText('GEOMETRY', W / 2 - off, 170); c.strokeStyle = STAGES[0].pc[0]; c.strokeText('GEOMETRY', W / 2 + off, 170);
  c.fillStyle = '#fff'; c.fillText('BASH', W / 2, 262);
  const n = SHIPS.length;
  for (let i = 0; i < n; i++) {
    const sh = SHIPS[i], ok = sh.id === 'tri' || META.un['ship:' + sh.id], sel = i === G.shipSel, x = W / 2 + (i - (n - 1) / 2) * 120, y = 420;
    shipPath(c, sh.id, x, y, sel ? 30 : 20, sel ? G.t * 1.5 : -Math.PI / 2);
    if (ok) polFill(c, Math.floor(G.t * .8) % 2 && sel ? 1 : 0, false, 2.5);
    else {
      c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 2; c.stroke();
      const u = UN['ship:' + sh.id], f = Math.min(1, mGet(u.stat) / u.n);
      c.strokeStyle = '#fff'; c.beginPath(); c.arc(x, y, 40, -Math.PI / 2, -Math.PI / 2 + TAU * f); c.stroke();
      if (sel) { icon(c, MSTAT_ICON[u.stat], x - 22, y + 62, 20, '#fff', 1); num(c, mGet(u.stat) + '/' + u.n, x - 6, y + 62, '#fff'); }
    }
    if (sel) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 12, y + 44); c.lineTo(x, y + 36); c.lineTo(x + 12, y + 44); c.stroke(); }
  }
  const ma = maxAsc();
  if (ma > 0) for (let i = 0; i < ma; i++) {
    polyPath(c, W / 2 + (i - (ma - 1) / 2) * 26, 520, 9, 3, -Math.PI / 2);
    if (i < (META.asc || 0)) { c.fillStyle = BAD; c.fill(); } else { c.strokeStyle = rgba(BAD, .6); c.lineWidth = 1.5; c.stroke(); }
  }
  c.globalAlpha = .8;
  keycap(c, 420, 620, 'A'); keycap(c, 450, 620, 'D'); shipPath(c, 'tri', 490, 620, 9, 0); c.strokeStyle = '#fff'; c.stroke();
  if (ma > 0) { keycap(c, 560, 620, 'W'); keycap(c, 590, 620, 'S'); c.fillStyle = BAD; polyPath(c, 622, 620, 8, 3, -Math.PI / 2); c.fill(); }
  if (Math.sin(G.t * 5) > -.3) { keycap(c, 720, 620, 'SPACE', 70); icon(c, MSTAT_ICON.runs, 776, 620, 22, '#fff', 1); }
  keycap(c, 850, 620, 'TAB', 44); icon(c, 'P1,1,9,1,9,9,1,9;L1,5,9,5;L5,1,5,9', 892, 620, 20, '#fff', 1);
  c.globalAlpha = 1;
}

function drawGallery(c) {
  drawBG(c, G.t * 2);
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, W, H);
  const items = UPS.filter(u => !u.hidden).map(u => ({ id: u.id, kind: 'up', stat: u.stat, n: u.n })).concat(UNLOCKS.filter(u => u.kind !== 'up'));
  const cols = 16, cs = 70, x0 = W / 2 - (cols - 1) * cs / 2, y0 = 90;
  let hov = null, got = 0;
  items.forEach((u, i) => {
    const x = x0 + (i % cols) * cs, y = y0 + Math.floor(i / cols) * cs, ok = !u.stat || META.un[u.id], col = unlockCol(u);
    if (ok) got++;
    if (Math.abs(IN.mx - x) < cs / 2 && Math.abs(IN.my - y) < cs / 2) hov = { u, x, y, ok };
    c.strokeStyle = ok ? rgba(col, .5) : 'rgba(255,255,255,.12)'; c.lineWidth = 1.5; c.strokeRect(x - 28, y - 28, 56, 56);
    drawUnlockIcon(c, u, x, y, 34, ok ? col : 'rgba(255,255,255,.16)');
    if (!ok) {
      c.strokeStyle = '#fff'; c.lineWidth = 2.5;
      c.beginPath(); c.arc(x, y, 24, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, mGet(u.stat) / u.n)); c.stroke();
    }
  });
  // overall progress bar
  c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.strokeRect(W / 2 - 300.5, 28.5, 601, 11);
  c.fillStyle = GOOD; c.fillRect(W / 2 - 300, 29, 600 * got / items.length, 10);
  if (hov) {
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(hov.x - 30, hov.y - 30, 60, 60);
    if (hov.u.stat) {
      const y = H - 60;
      drawUnlockIcon(c, hov.u, W / 2 - 110, y, 40, unlockCol(hov.u));
      icon(c, 'A1,5,9,5', W / 2 - 60, y, 22, '#fff', 1);
      icon(c, MSTAT_ICON[hov.u.stat], W / 2 - 14, y, 34, '#fff', 1);
      num(c, Math.min(mGet(hov.u.stat), hov.u.n) + ' / ' + hov.u.n, W / 2 + 16, y, hov.ok ? GOOD : '#fff');
    }
  }
  keycap(c, 60, H - 40, 'ESC', 44);
}

function drawEnd(c, win) {
  const k = Math.min(1, G.endT);
  c.fillStyle = 'rgba(0,0,0,' + .7 * k + ')'; c.fillRect(0, 0, W, H);
  if (k < 1) return;
  icon(c, win ? MSTAT_ICON.wins : MSTAT_ICON.bosses, W / 2, 170, 120, win ? SHARD : BAD, .7);
  const row = [['kills', R.st.kills], ['absorbed', R.st.absorbed], ['rooms', R.st.rooms], ['shards', R.st.shards], ['stage', R.stage + 1]];
  row.forEach(([ic, v], i) => { const x = W / 2 + (i - 2) * 130; icon(c, MSTAT_ICON[ic], x - 22, 300, 30, '#fff', 1); num(c, v, x, 300, '#fff'); });
  const m = upCounts(R.P.ups);
  drawUpRow(c, R.P.ups, W / 2 - Math.min(m.size, 20) * 17, 380 + Math.floor(m.size / 34) * 40, 26, 1100);
  if (G.newUn.length) {
    const n = Math.min(G.newUn.length, 16);
    for (let i = 0; i < n; i++) {
      const u = G.newUn[i], x = W / 2 + (i - (n - 1) / 2) * 64, y = 500, col = unlockCol(u);
      c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(x - 26, y - 26, 52, 52);
      drawUnlockIcon(c, u, x, y + Math.sin(G.t * 4 + i) * 2, 34, col);
    }
    icon(c, 'P2,5,8,5,8,9,2,9;R3.6,5,2.2,180,360', W / 2 - n * 32 - 40, 500, 30, '#fff', 1);
  }
  if (G.endT > 1.2 && Math.sin(G.t * 5) > -.3) keycap(c, W / 2, 620, 'SPACE', 70);
}

function drawPause(c) {
  c.fillStyle = 'rgba(0,0,0,.75)'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#fff'; c.fillRect(W / 2 - 22, 90, 14, 50); c.fillRect(W / 2 + 8, 90, 14, 50);
  keycap(c, W / 2 - 90, 115, 'ESC', 44); icon(c, MSTAT_ICON.runs, W / 2 - 128, 115, 22, '#fff', 1);
  keycap(c, PAUSE_QUIT.x, PAUSE_QUIT.y, 'X'); icon(c, 'P5,1.5,9,5,7.5,5,7.5,9,2.5,9,2.5,5,1,5', PAUSE_QUIT.x + 34, PAUSE_QUIT.y, 24, BAD, 1);
  const m = upCounts(R.P.ups); let i = 0;
  for (const [id, n] of m) {
    const u = UP[id], x = W / 2 + ((i % 12) - 5.5) * 80, y = 230 + Math.floor(i / 12) * 80, col = TIER_COL[u.tier];
    c.strokeStyle = rgba(col, .6); c.lineWidth = 1.5; polyPath(c, x, y, 30, TIER_SIDES[u.tier], u.tier === 3 ? Math.PI / 2 : 0); c.stroke();
    icon(c, u.icon, x, y, u.tier === 3 ? 24 : 32, col, 1);
    if (n > 1) num(c, '×' + n, x + 22, y + 26, col);
    i++;
  }
  // active fusions
  let fn = 0;
  for (const [id, a, b] of FUSIONS) {
    if (!R.P.fus[id]) continue;
    const x = 200 + fn++ * 150, fy = 540;
    icon(c, UP[a].icon, x - 26, fy, 26, TIER_COL[UP[a].tier], 1); icon(c, UP[b].icon, x + 26, fy, 26, TIER_COL[UP[b].tier], 1);
    icon(c, 'L5,2,5,8;L2,5,8,5', x, fy, 14, '#fff', 1.4);
  }
  // settings: effects intensity and volume
  const pips = (x, n, of) => { for (let i = 0; i < of; i++) { c.fillStyle = i < n ? '#fff' : 'rgba(255,255,255,.25)'; c.fillRect(x + i * 12, 109, 8, 12); } };
  keycap(c, 170, 115, '◄'); keycap(c, 200, 115, '►'); icon(c, UP.explode.icon, 240, 115, 24, '#fff', 1); pips(262, Math.round(META.fx * 2), 2);
  keycap(c, 960, 115, '▲'); keycap(c, 990, 115, '▼'); icon(c, 'F2,4,4,4,7,1.5,7,8.5,4,6,2,6', 1030, 115, 24, AU.mute ? BAD : '#fff', 1); pips(1052, Math.round(META.vol * 4), 4);
  const y = 640;
  keycap(c, 300, y, 'WASD', 60); icon(c, UP.move.icon, 348, y, 22, '#fff');
  mouseGlyph(c, 440, y, 0); icon(c, UP.dmg.icon, 474, y, 22, '#fff');
  keycap(c, 590, y, 'SPACE', 70); mouseGlyph(c, 648, y, 1); icon(c, UP.contrast.icon, 684, y, 22, '#fff');
  keycap(c, 780, y, 'Q'); icon(c, UP.burst.icon, 814, y, 22, '#fff');
  keycap(c, 900, y, 'E'); icon(c, MSTAT_ICON.taken, 934, y, 22, '#fff');
  keycap(c, 1010, y, 'M'); icon(c, 'F2,4,4,4,7,1.5,7,8.5,4,6,2,6', 1044, y, 22, AU.mute ? BAD : '#fff');
}

// Draws the frame and returns the post-process parameters for it.
function render(c) {
  const src = [];
  let ca = .0012, pulse = 0, inv = 0;
  if (G.state === 'title' || G.state === 'gallery') {
    if (G.state === 'title') drawTitle(c); else drawGallery(c);
    src.push([1, W / 2 + Math.cos(G.t * .7) * 380, 215 + Math.sin(G.t * 1.1) * 60, 70, .012]);
  } else {
    drawWorld(c);
    drawHUD(c);
    if (G.state === 'pause') drawPause(c);
    else if (G.state === 'dead' || G.state === 'win') drawEnd(c, G.state === 'win');
    for (const w of R.wells) src.push([1, w.x, w.y, w.vis || w.r * .22, .00016 * w.str]);
    for (const o of R.orbs) src.push([1, o.x, o.y, 55, .03]);
    if (R.room.portal) src.push([1, R.room.portal.x, R.room.portal.y, 46, .02]);
    for (const f of R.fx) src.push([2, f.x, f.y, f.t * f.spd, f.str * (1 - f.t / f.life)]);
    if (R.P.stats.grav) for (let i = 0; i < R.shots.length && src.length < 12; i += 4) src.push([1, R.shots[i].x, R.shots[i].y, 18, .0015 * Math.min(3, R.P.stats.grav)]);
    ca += R.ca + (R.slowT > 0 ? .008 : 0);
    if (R.P.hp <= 1 && R.P.stats.maxHp > 1 && !R.over) pulse = Math.pow(1 - (R.time * 1.6 % 1), 3);
    inv = R.inv;
  }
  drawToasts(c);
  // the effects setting scales every warp; the colour-swap flash stays partly visible because it carries information
  const fx = META.fx;
  for (const s of src) s[4] *= fx;
  return { src, ca: .0012 + (ca - .0012) * fx, pulse: pulse * fx, inv: inv * (.4 + .6 * fx), bloom: .45 + .4 * fx, vig: 1 };
}

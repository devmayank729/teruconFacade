let T, BOX, PLANE, CYL, ICO;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MASS = { residential: [14, 12, 3.3, 3.1, 1.0], commercial: [30, 20, 4.8, 3.8, 1.1], retail: [22, 16, 5.4, 4.0, 1.2], corporate: [26, 20, 4.6, 3.8, 1.2], hospitality: [32, 16, 4.6, 3.3, 1.1], industrial: [42, 26, 7.5, 6.0, 1.5], institutional: [36, 16, 4.2, 3.8, 1.1], other: [22, 16, 4.2, 3.6, 1.1] };
const BAY = { residential: 3.4, retail: 4.4, corporate: 4.0, hospitality: 3.6, commercial: 4.4, institutional: 4.0, industrial: 6.5, other: 4.0 };
const SHOP = { retail: 1, commercial: 1, hospitality: 1, corporate: 1, other: 1 };
const BALC = { residential: 2, hospitality: 1 };
const DEFC = { glass: '#525a5f', acp: '#bab5ad', aluminium: '#3d3f42', metal: '#9a8162', stone: '#c8b68f', pustone: '#8a8278', hpl: '#6e5a48', grc: '#e3ddd1', terracotta: '#b5653d', wood: '#a9744a' };
const FINISHABLE = { acp: 1, hpl: 1, aluminium: 1, metal: 1 };
const PATTERNABLE = { acp: 1, hpl: 1, aluminium: 1 };
const AMBER = '#F5B357';
const SKY = {
  day: { zen: '#5f8fb8', hi: '#9fbdd3', hor: '#e8ebe5', gnd: '#a89e8b', gnd2: '#6d6558', sun: [-38, 36], sunCol: '#fff2dc', sunI: 3.1, hemi: 0.35, sky: '#dfe8ee', gr: '#b3a68c', exp: 1.0, cloud: '255,255,255', ca: 0.55, city: '#93a2ac', fog: '#e2e4de' },
  dusk: { zen: '#11152f', hi: '#343866', hor: '#ef8f57', gnd: '#3a2f28', gnd2: '#1a1512', sun: [118, 3], sunCol: '#ff9a5c', sunI: 0.6, hemi: 0.22, sky: '#4c5383', gr: '#2a2018', exp: 1.08, cloud: '255,168,128', ca: 0.32, city: '#24253a', fog: '#6e5552' } };
function initGeo() { BOX = new T.BoxGeometry(1, 1, 1); PLANE = new T.PlaneGeometry(1, 1); CYL = new T.CylinderGeometry(0.5, 0.5, 1, 20); ICO = new T.IcosahedronGeometry(1, 1); [BOX, PLANE, CYL, ICO].forEach(g => { g.userData.keep = true; }); }

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = seed || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function shade(hex, t) { const c = new T.Color(hex); c.lerp(new T.Color(t < 0 ? 0x000000 : 0xffffff), Math.abs(t)); return '#' + c.getHexString(); }
const jit = (hex, R, a) => shade(hex, (R() - 0.5) * a);
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
function rr(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const sunDir = P => { const a = T.MathUtils.degToRad(P.sun[0]), e = T.MathUtils.degToRad(P.sun[1]); return new T.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)); };

/* ---------- procedural textures: colour + derived normal map ---------- */
function normalFrom(src, strength) {
  const S = src.width, d = src.getContext('2d').getImageData(0, 0, S, S).data, L = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) L[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
  const c = canvas(S), g = c.getContext('2d'), out = g.createImageData(S, S), o = out.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const xl = (x + S - 1) % S, xr = (x + 1) % S, yu = (y + S - 1) % S, yd = (y + 1) % S;
    let nx = -(L[y * S + xr] - L[y * S + xl]) * strength, ny = (L[yd * S + x] - L[yu * S + x]) * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * S + x) * 4; o[i] = (nx * 0.5 + 0.5) * 255; o[i + 1] = (ny * 0.5 + 0.5) * 255; o[i + 2] = (nz * 0.5 + 0.5) * 255; o[i + 3] = 255;
  }
  g.putImageData(out, 0, 0); return c;
}
const TEX = new Map();
function texFrom(c, tile, data) { const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1 / tile, 1 / tile); t.anisotropy = 8; t.colorSpace = data ? T.NoColorSpace : T.SRGBColorSpace; return t; }
function ctex(key, tile, draw, nStrength, data) {
  let t = TEX.get(key); if (t) return t;
  const c = canvas(512), g = c.getContext('2d'); draw(g, 512, rng(hash(key)));
  t = { map: texFrom(c, tile, data), normal: nStrength ? texFrom(normalFrom(c, nStrength), tile, true) : null }; TEX.set(key, t); return t;
}
const fill = (g, S, c) => { g.fillStyle = c; g.fillRect(0, 0, S, S); };
function speckle(g, S, R, n, a) { for (let i = 0; i < n; i++) { g.fillStyle = R() > 0.5 ? `rgba(255,255,255,${a * R()})` : `rgba(0,0,0,${a * R()})`; const s = 1 + R() * 2.2; g.fillRect(R() * S, R() * S, s, s); } }
function brush(g, S, R) { for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${R() > 0.5 ? '255,255,255' : '0,0,0'},${0.03 * R()})`; g.fillRect(R() * S, 0, 1, S); } }
function grain(g, S, R, n, x0 = 0, x1 = S) { for (let i = 0; i < n; i++) { g.strokeStyle = R() > 0.45 ? `rgba(40,22,8,${0.05 + R() * 0.12})` : `rgba(255,240,220,${0.03 + R() * 0.06})`; g.lineWidth = 0.5 + R() * 1.6; const bx = x0 + R() * (x1 - x0), a = 1.5 + R() * 3, f = 1 + Math.floor(R() * 3), ph = R() * 6; g.beginPath(); for (let y = 0; y <= S; y += 8) { const x = bx + Math.sin(y / S * Math.PI * 2 * f + ph) * a; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } }
function grid(g, S, cols, rows, w, base, stagger) {
  const dk = shade(base, -0.5), lt = shade(base, 0.2), ch = S / rows, cw = S / cols;
  for (let r = 0; r <= rows; r++) { const y = r * ch; g.fillStyle = dk; g.fillRect(0, y - w / 2, S, w); g.fillStyle = lt; g.fillRect(0, y + w / 2, S, 1); }
  for (let r = 0; r < rows; r++) { const off = stagger && r % 2 ? cw / 2 : 0; for (let k = -1; k <= cols; k++) { g.fillStyle = dk; g.fillRect(k * cw + off - w / 2, r * ch, w, ch); g.fillStyle = lt; g.fillRect(k * cw + off + w / 2, r * ch, 1, ch); } }
}
function cells(g, S, cols, rows, base, R, amt, stagger) { const ch = S / rows, cw = S / cols; for (let r = 0; r < rows; r++) { const off = stagger && r % 2 ? cw / 2 : 0, cs = Array.from({ length: cols }, () => jit(base, R, amt)); for (let k = -1; k <= cols; k++) { g.fillStyle = cs[((k % cols) + cols) % cols]; g.fillRect(k * cw + off, r * ch, cw + 1, ch + 1); } } }
function diamonds(g, S, n, w, base) { g.strokeStyle = shade(base, -0.5); g.lineWidth = w; for (let i = -n; i <= 2 * n; i++) { const p = i * S / n; g.beginPath(); g.moveTo(p, 0); g.lineTo(p + S, S); g.stroke(); g.beginPath(); g.moveTo(p, S); g.lineTo(p + S, 0); g.stroke(); } }
function veins(g, S, R) { for (let i = 0; i < 9; i++) { g.strokeStyle = `rgba(${R() > 0.5 ? '96,96,100' : '255,255,255'},${0.12 + R() * 0.2})`; g.lineWidth = 0.6 + R() * 2; g.beginPath(); let x = R() * S, y = 0; g.moveTo(x, y); while (y < S) { x += (R() - 0.5) * 40; y += 10 + R() * 30; g.lineTo(x, y); } g.stroke(); } }
function bands(g, S, R) { for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${R() > 0.5 ? '120,90,50' : '255,245,225'},${0.03 + R() * 0.04})`; g.fillRect(0, R() * S, S, 2 + R() * 10); } }
function stones(g, S, R, c, tx) {
  fill(g, S, shade(c, -0.66)); const rh = tx === 'slate' ? [8, 14] : tx === 'split' ? [30, 52] : tx === 'rock' ? [46, 80] : [18, 36];
  let y = 0; while (y < S) { const h = Math.min(rh[0] + R() * (rh[1] - rh[0]), S - y); let x = -R() * 90;
    while (x < S) { const L = (tx === 'rock' ? 70 : tx === 'slate' ? 80 : 45) + R() * (tx === 'rock' ? 80 : 110), gp = tx === 'rock' ? 4 : 3; g.fillStyle = jit(c, R, tx === 'slate' ? 0.3 : 0.24); rr(g, x + gp / 2, y + gp / 2, L - gp, h - gp, tx === 'rock' ? 10 : 3); g.fill(); g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x + gp, y + gp / 2, L - gp * 2, 2); g.fillStyle = 'rgba(0,0,0,.24)'; g.fillRect(x + gp, y + h - gp / 2 - 3, L - gp * 2, 3); x += L; }
    y += h; }
  speckle(g, S, R, 7000, 0.12);
}
function flutes(g, S, c, n) { const w = S / n; for (let i = 0; i < n; i++) { const gr = g.createLinearGradient(i * w, 0, (i + 1) * w, 0); gr.addColorStop(0, shade(c, -0.3)); gr.addColorStop(0.35, shade(c, 0.12)); gr.addColorStop(0.7, c); gr.addColorStop(1, shade(c, -0.34)); g.fillStyle = gr; g.fillRect(i * w, 0, w, S); } }
function relief(g, S, c) { const n = 3, s = S / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = i * s, y = j * s, cx = x + s / 2, cy = y + s / 2; [[x, y, x + s, y, 0.14], [x + s, y, x + s, y + s, -0.1], [x + s, y + s, x, y + s, -0.24], [x, y + s, x, y, 0.04]].forEach(([a, b, d, e, t]) => { g.fillStyle = shade(c, t); g.beginPath(); g.moveTo(a, b); g.lineTo(d, e); g.lineTo(cx, cy); g.closePath(); g.fill(); }); } }
function baguettes(g, S, R, c, n) { fill(g, S, shade(c, -0.62)); const p = S / n, h = p * 0.55; for (let i = 0; i < n; i++) { const y = i * p + (p - h) / 2, gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, shade(c, 0.22)); gr.addColorStop(0.45, c); gr.addColorStop(1, shade(c, -0.34)); g.fillStyle = gr; g.fillRect(0, y, S, h); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, y + h, S, p * 0.08); } speckle(g, S, R, 5000, 0.08); }
function battens(g, S, R, c, n) { fill(g, S, '#1b140e'); const p = S / n, w = p * 0.66; for (let i = 0; i < n; i++) { const x = i * p + (p - w) / 2; g.fillStyle = jit(c, R, 0.14); g.fillRect(x, 0, w, S); grain(g, S, R, 10, x, x + w); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x, 0, 2, S); g.fillStyle = 'rgba(0,0,0,.24)'; g.fillRect(x + w - 3, 0, 3, S); } }
function folds(g, S, c, n) { const w = S / n; for (let i = 0; i < n; i++) { const gr = g.createLinearGradient(i * w, 0, (i + 1) * w, 0); gr.addColorStop(0, shade(c, 0.16)); gr.addColorStop(0.5, shade(c, -0.06)); gr.addColorStop(0.5, shade(c, -0.22)); gr.addColorStop(1, shade(c, 0.04)); g.fillStyle = gr; g.fillRect(i * w, 0, w, S); } }
function perf(pattern, open) {
  return (g, S) => { fill(g, S, '#fff'); g.fillStyle = '#000'; const n = 12, p = S / n;
    if (pattern === 'linear') { const h = p * clamp(open * 1.1, 0.12, 0.7); for (let j = 0; j < n; j++) for (let i = -1; i < n / 2; i++) { rr(g, i * p * 2 + (j % 2 ? p : 0) + p * 0.2, j * p + (p - h) / 2, p * 1.6, h, h / 2); g.fill(); } }
    else if (pattern === 'geometric') { const r = p * Math.sqrt(open / 2) * 0.95; for (let j = 0; j <= n; j++) for (let i = -1; i <= n; i++) { const cx = i * p + (j % 2 ? p / 2 : 0), cy = j * p; g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); g.fill(); } }
    else if (pattern === 'custom') { const m = 18, q = S / m; for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) { const cx = (i + 0.5) * q, cy = (j + 0.5) * q, k = 0.5 + 0.5 * Math.sin(cx / S * Math.PI * 4 + Math.cos(cy / S * Math.PI * 2) * 2), r = q * 0.5 * Math.sqrt(open * 2.2) * (0.25 + 0.75 * k); g.beginPath(); g.arc(cx, cy, clamp(r, 0.5, q * 0.48), 0, 7); g.fill(); } }
    else { const r = Math.min(p * Math.sqrt(open / Math.PI), p * 0.46); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { g.beginPath(); g.arc((i + 0.5) * p, (j + 0.5) * p, r, 0, 7); g.fill(); } } };
}
function jaali(g, S) { fill(g, S, '#fff'); g.fillStyle = '#000'; const n = 4, p = S / n; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const cx = (i + 0.5) * p, cy = (j + 0.5) * p, r = p * 0.3; g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); g.fill(); [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([dx, dy]) => { g.beginPath(); g.arc(i * p + dx * p, j * p + dy * p, p * 0.1, 0, 7); g.fill(); }); [[0.5, 0], [0, 0.5]].forEach(([dx, dy]) => { g.beginPath(); g.arc(i * p + dx * p, j * p + dy * p, p * 0.06, 0, 7); g.fill(); }); } }
function mesh(g, S) { fill(g, S, '#000'); g.strokeStyle = '#fff'; g.lineWidth = S / 42; const n = 6, p = S / n; for (let i = -n; i <= 2 * n; i++) { g.beginPath(); g.moveTo(i * p, 0); g.lineTo(i * p + S / 2, S); g.stroke(); g.beginPath(); g.moveTo(i * p, S); g.lineTo(i * p + S / 2, 0); g.stroke(); } }

function look(sys, sp, c, finish, pattern) {
  sp = sp || {}; const key = [sys, JSON.stringify(sp), c, finish || '', pattern || ''].join('|');
  let tile = 2.4, rough = 0.6, metal = 0, coat = 0, nS = 3, draw, alphaDraw = null, aTile = 1;
  const pat = (cols, rows) => pattern === 'vertical' ? [cols * 2, 1] : pattern === 'horizontal' ? [1, rows * 2] : [cols, rows];
  switch (sys) {
    case 'acp': { const gw = { flush: 2, 10: 4, 20: 7 }[sp.groove] || 4, f = sp.finish || 'solid'; rough = 0.38; metal = f === 'metallic' || f === 'brushed' ? 0.6 : 0.15; coat = 0.6; nS = 6;
      draw = (g, S, R) => { fill(g, S, c); if (f === 'metallic') speckle(g, S, R, 5000, 0.08); if (f === 'brushed') brush(g, S, R); if (f === 'wooden') grain(g, S, R, 140); if (f === 'stone') speckle(g, S, R, 9000, 0.16); if (pattern === 'geometric') diamonds(g, S, 3, gw, c); else { const [a, b] = pat(2, 3); grid(g, S, a, b, gw, c); } }; break; }
    case 'hpl': { const dec = sp.decor || 'wood'; rough = dec === 'metallic' ? 0.36 : 0.5; metal = dec === 'metallic' ? 0.5 : 0; coat = 0.35; nS = 5;
      draw = (g, S, R) => { fill(g, S, c); if (dec === 'wood') grain(g, S, R, 160); if (dec === 'stone') speckle(g, S, R, 9000, 0.15); if (dec === 'metallic') speckle(g, S, R, 4000, 0.07); const [a, b] = pat(2, 2); grid(g, S, a, b, 4, c); }; break; }
    case 'alclad': { tile = 1.2; rough = 0.34; metal = 0.7; coat = 0.3; nS = 6;
      draw = (g, S, R) => { fill(g, S, c); brush(g, S, R); if (pattern === 'horizontal') grid(g, S, 1, 4, 4, c); else for (let i = 0; i <= 4; i++) { const x = i * S / 4; g.fillStyle = shade(c, -0.45); g.fillRect(x - 2, 0, 4, S); g.fillStyle = shade(c, 0.3); g.fillRect(x + 2, 0, 2, S); } }; break; }
    case 'stone': { const fm = sp.format || 'slab', sub = sp.sub || 'natural', [cols, rows] = fm === 'tile' ? [4, 8] : fm === 'custom' ? [2, 2] : [2, 4];
      rough = { polished: 0.16, honed: 0.5, flamed: 0.88, leather: 0.68 }[sp.surface] || 0.5; coat = sp.surface === 'polished' ? 0.5 : 0; nS = sp.surface === 'flamed' ? 7 : 4;
      draw = (g, S, R) => { cells(g, S, cols, rows, c, R, 0.09, true); if (sub === 'granite') speckle(g, S, R, 26000, 0.28); else if (sub === 'marble') veins(g, S, R); else if (sub === 'engineered') speckle(g, S, R, 8000, 0.05); else { bands(g, S, R); speckle(g, S, R, 9000, 0.1); } grid(g, S, cols, rows, 3, shade(c, 0.25), true); }; break; }
    case 'pustone': tile = 1.2; rough = 0.92; nS = 10; draw = (g, S, R) => stones(g, S, R, c, sp.texture || 'stacked'); break;
    case 'grc': { const p = sp.pattern || 'jaali'; rough = 0.82; nS = 6;
      if (p === 'jaali') { tile = 0.9; aTile = 0.9; draw = (g, S, R) => { fill(g, S, c); speckle(g, S, R, 6000, 0.07); }; alphaDraw = jaali; nS = 2; }
      else if (p === 'fluted') { tile = 0.6; nS = 8; draw = (g, S) => flutes(g, S, c, 6); }
      else if (p === 'geometric') { tile = 1.2; nS = 8; draw = (g, S) => relief(g, S, c); }
      else { tile = 1.5; draw = (g, S, R) => { fill(g, S, c); speckle(g, S, R, 8000, 0.07); grid(g, S, 1, 1, 3, c); }; } break; }
    case 'terracotta': { const sub = sp.sub || 'baguettes'; rough = sp.tone === 'glazed' ? 0.3 : 0.78; coat = sp.tone === 'glazed' ? 0.6 : 0; nS = 9;
      if (sub === 'panels') { tile = 1.2; nS = 5; draw = (g, S, R) => { cells(g, S, 4, 8, c, R, 0.14, true); grid(g, S, 4, 8, 3, c, true); }; }
      else { tile = 0.6; const n = Math.max(2, Math.round(600 / (+sp.spacing || 150))); draw = (g, S, R) => baguettes(g, S, R, c, n); } break; }
    case 'wood': tile = 0.6; rough = 0.6; nS = 9; draw = (g, S, R) => battens(g, S, R, c, 8); break;
    case 'metal': { const sub = sp.sub || 'perforated'; metal = 0.75; rough = 0.34; nS = 3;
      if (sub === 'screen' || sub === 'solid') { tile = 1.2; nS = 7; draw = (g, S) => folds(g, S, c, 4); }
      else { tile = aTile = sub === 'expanded' ? 0.5 : 1; draw = (g, S, R) => { fill(g, S, c); speckle(g, S, R, 3000, 0.06); }; alphaDraw = sub === 'expanded' ? mesh : perf(sp.pattern || 'round', (+sp.open || 35) / 100); } break; }
    default: tile = 3; rough = 0.95; nS = 2; draw = (g, S, R) => { fill(g, S, c); speckle(g, S, R, 14000, 0.05); };
  }
  if (finish === 'matte') { rough = Math.max(rough, 0.82); metal *= 0.4; coat = 0; } else if (finish === 'satin') rough = Math.min(rough, 0.45); else if (finish === 'metallic') { metal = Math.max(metal, 0.62); rough = Math.min(rough, 0.3); } else if (finish === 'brushed') { metal = Math.max(metal, 0.55); rough = 0.38; }
  const t = ctex('m:' + key, tile, draw, nS);
  return { map: t.map, normal: t.normal, alpha: alphaDraw ? ctex('a:' + key, aTile, alphaDraw, 0, true).map : null, rough, metal, coat };
}
function boxM(w, h, d) { const g = new T.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); } return g; }
function bandGeo(len, y0, h, holes, ext) {
  const s = new T.Shape(), a = -(ext || 0), b = len + (ext || 0); s.moveTo(a, y0); s.lineTo(b, y0); s.lineTo(b, y0 + h); s.lineTo(a, y0 + h); s.closePath();
  holes.forEach(o => { const x0 = clamp(o.x, 0.02, len - 0.02), x1 = clamp(o.x + o.w, 0.02, len - 0.02), q0 = clamp(o.y, y0 + 0.02, y0 + h - 0.02), q1 = clamp(o.y + o.h, y0 + 0.02, y0 + h - 0.02); if (x1 - x0 < 0.05 || q1 - q0 < 0.05) return; const p = new T.Path(); p.moveTo(x0, q0); p.lineTo(x0, q1); p.lineTo(x1, q1); p.lineTo(x1, q0); p.closePath(); s.holes.push(p); });
  return new T.ShapeGeometry(s);
}
function skyCanvas(m) {
  const P = SKY[m], W = 2048, H = 1024, c = canvas(W, H), g = c.getContext('2d'), R = rng(m === 'day' ? 7 : 11);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, P.zen); gr.addColorStop(0.3, P.hi); gr.addColorStop(0.497, P.hor); gr.addColorStop(0.503, P.gnd); gr.addColorStop(1, P.gnd2); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (m === 'dusk') { const hg = g.createLinearGradient(0, H * 0.36, 0, H * 0.5); hg.addColorStop(0, 'rgba(239,143,87,0)'); hg.addColorStop(1, 'rgba(255,170,110,.55)'); g.fillStyle = hg; g.fillRect(0, H * 0.36, W, H * 0.14); }
  const sd = sunDir(P), sx = (Math.atan2(sd.z, sd.x) / (2 * Math.PI) + 0.5) * W, sy = (1 - (Math.asin(sd.y) / Math.PI + 0.5)) * H;
  const sg = g.createRadialGradient(sx, sy, 0, sx, sy, m === 'day' ? 260 : 560); sg.addColorStop(0, m === 'day' ? 'rgba(255,252,240,1)' : 'rgba(255,196,128,.95)'); sg.addColorStop(0.04, m === 'day' ? 'rgba(255,246,222,.9)' : 'rgba(255,170,110,.7)'); sg.addColorStop(1, 'rgba(255,230,200,0)'); g.fillStyle = sg; g.fillRect(0, 0, W, H / 2);
  for (let i = 0; i < 70; i++) { const cx = R() * W, cy = H * (0.1 + R() * 0.33), rw = 50 + R() * 200, rh = rw * (0.16 + R() * 0.14); for (let k = 0; k < 7; k++) { const x = cx + (R() - 0.5) * rw, y = cy + (R() - 0.5) * rh, r = rh * (0.6 + R()); const cg = g.createRadialGradient(x, y, 0, x, y, r * 2); cg.addColorStop(0, `rgba(${P.cloud},${P.ca * (0.4 + R() * 0.6)})`); cg.addColorStop(1, `rgba(${P.cloud},0)`); g.fillStyle = cg; g.beginPath(); g.ellipse(x, y, r * 2, r * 0.9, 0, 0, 7); g.fill(); } }
  let x = 0; while (x < W) { const bw = 8 + R() * 36, bh = (5 + R() * 26) * (R() < 0.12 ? 2.2 : 1); g.globalAlpha = 0.45 + R() * 0.3; g.fillStyle = P.city; g.fillRect(x, H / 2 - bh, bw, bh + 3); if (m === 'dusk') { g.fillStyle = '#ffd08a'; for (let k = 0; k < bw * bh / 30; k++) if (R() < 0.3) g.fillRect(x + R() * bw, H / 2 - R() * bh, 1.3, 1.3); } x += bw + R() * 5; }
  g.globalAlpha = 1; return c;
}
function softRect(blur) { const c = canvas(256), g = c.getContext('2d'); g.filter = `blur(${blur}px)`; g.fillStyle = '#fff'; g.fillRect(48, 48, 160, 160); const t = new T.CanvasTexture(c); return t; }
function beamTex() { const c = canvas(128, 256), g = c.getContext('2d'), d = g.createImageData(128, 256), o = d.data; for (let y = 0; y < 256; y++) for (let x = 0; x < 128; x++) { const v = 1 - y / 255, u = (x - 64) / 64, spread = 0.18 + 0.82 * (1 - v), a = Math.exp(-(u * u) / (2 * spread * spread * 0.18)) * Math.pow(v, 1.6) + (v > 0.97 ? 0.5 : 0); const i = (y * 128 + x) * 4; o[i] = o[i + 1] = o[i + 2] = 255; o[i + 3] = clamp(a, 0, 1) * 255; } g.putImageData(d, 0, 0); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
function poolTex() { const c = canvas(128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
function hazeTex() { const c = canvas(4, 128), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
function nbTex(seed) { const c = canvas(256), g = c.getContext('2d'), R = rng(seed); fill(g, 256, '#e4dfd5'); speckle(g, 256, R, 2000, 0.04); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { g.fillStyle = R() < 0.25 ? '#7d8790' : '#5d6870'; g.fillRect(i * 64 + 14, j * 64 + 18, 36, 28); g.fillStyle = '#d6d0c5'; g.fillRect(i * 64 + 12, j * 64 + 46, 40, 3); } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }

class Viewer {
  constructor() {
    const low = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4 || Math.min(screen.width, screen.height) < 600;
    this.low = low;
    const r = this.renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.6 : 2)); r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping;
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap; r.shadowMap.autoUpdate = false;
    const cv = this.canvas = r.domElement; cv.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;outline:none;cursor:grab;-webkit-user-select:none;user-select:none;';
    cv.tabIndex = 0; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', '3D model of your building. Drag to turn; arrow keys rotate, plus and minus zoom.');
    this.scene = new T.Scene(); this.scene.fog = new T.Fog('#e2e4de', 100, 400);
    this.camera = new T.PerspectiveCamera(27, 1.5, 0.5, 6000);
    this.hemi = new T.HemisphereLight('#fff', '#888', 0.3); this.sun = new T.DirectionalLight('#fff', 3); this.sun.castShadow = true;
    const sm = low ? 2048 : 4096; this.sun.shadow.mapSize.set(sm, sm); this.sun.shadow.bias = -0.00025; this.sun.shadow.normalBias = 0.025;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.pmrem = new T.PMREMGenerator(r); this.skies = {};
    const S = o => new T.MeshStandardMaterial(o), P = o => new T.MeshPhysicalMaterial(o);
    const pl = (k, c) => { const t = ctex(k, 3, (g, s, R) => { fill(g, s, c); speckle(g, s, R, 16000, 0.05); for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(0,0,0,${0.015 * R()})`; g.fillRect(R() * s, 0, 8 + R() * 30, s); } }, 2); return S({ map: t.map, normalMap: t.normal, normalScale: new T.Vector2(0.6, 0.6), roughness: 0.92 }); };
    const pave = ctex('paving', 1.2, (g, s, R) => { cells(g, s, 2, 4, '#cfc6b6', R, 0.06, true); speckle(g, s, R, 9000, 0.06); grid(g, s, 2, 4, 3, '#cfc6b6', true); }, 4);
    const asphalt = ctex('asphalt', 4, (g, s, R) => { fill(g, s, '#55524d'); speckle(g, s, R, 30000, 0.12); }, 2);
    this.M = { plaster: pl('plaster', '#e4dccf'), plaster2: pl('plaster2', '#d4cabb'), nb: null,
      frame: P({ color: '#2f3134', roughness: 0.35, metalness: 0.7, clearcoat: 0.3 }), sill: S({ color: '#cfc5b5', roughness: 0.7 }),
      win: P({ color: '#3a4752', roughness: 0.03, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.5 }),
      winLit: P({ color: '#3a4752', roughness: 0.03, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.5, emissive: '#ffc784', emissiveIntensity: 0 }),
      winLit2: P({ color: '#3a4752', roughness: 0.03, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.5, emissive: '#ffe6c2', emissiveIntensity: 0 }),
      roof: S({ color: '#b8ae9f', roughness: 0.95 }), tank: S({ color: '#2a2a2b', roughness: 0.55 }), unit: S({ color: '#d7d7d3', roughness: 0.5, metalness: 0.2 }),
      rail: P({ color: '#bcd0d6', transparent: true, opacity: 0.28, roughness: 0.02, metalness: 0.1, clearcoat: 1, depthWrite: false }),
      led: S({ color: '#e9e4da', emissive: '#fff0d2', emissiveIntensity: 0.1, roughness: 0.5 }),
      pave: S({ map: pave.map, normalMap: pave.normal, roughness: 0.85 }), road: S({ map: asphalt.map, normalMap: asphalt.normal, roughness: 0.9 }), kerb: S({ color: '#d9cfbf', roughness: 0.85 }),
      line: S({ color: '#ece6da', roughness: 0.7 }), trunk: S({ color: '#6b5a48', roughness: 0.9 }), leaf: S({ color: '#7d8c5c', roughness: 0.85, flatShading: true }), leaf2: S({ color: '#6c7c50', roughness: 0.85, flatShading: true }),
      pole: S({ color: '#3a3c3f', roughness: 0.5, metalness: 0.6 }), lamp: S({ color: '#f2efe8', emissive: '#ffd9a0', emissiveIntensity: 0 }),
      contact: new T.MeshBasicMaterial({ color: '#1b1209', alphaMap: softRect(26), transparent: true, opacity: 0.5, depthWrite: false }),
      beam: new T.MeshBasicMaterial({ map: beamTex(), color: '#ffbb6b', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }),
      pool: new T.MeshBasicMaterial({ map: poolTex(), color: '#ffb766', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }),
      glow: new T.MeshBasicMaterial({ map: hazeTex(), color: '#ffe2b8', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }) };
    this.mcache = new Map();
    this.ground = new T.Mesh(new T.PlaneGeometry(6000, 6000), S({ color: '#c3b8a5', roughness: 0.95 })); this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true; this.scene.add(this.ground);
    this.street = new T.Group(); this.root = new T.Group(); this.scene.add(this.street, this.root);
    this.target = new T.Vector3(0, 6, 0); this.goalT = new T.Vector3(0, 6, 0); this.homeT = new T.Vector3(0, 6, 0);
    this.home = { yaw: 0.6, pitch: 0.1, zoom: 1 }; this.cur = { yaw: 1.1, pitch: 0.2, zoom: 1.25 }; this.goal = { ...this.home }; this.baseDist = 50; this.rad = 20;
    this.handlers = {}; this.active = false; this.dirty = true; this.sk = ''; this.hover = null; this.mode = null; this.pFloors = []; this.pZones = []; this.labels = []; this.signMats = []; this.labs = {};
    this.ray = new T.Raycaster(); this.ptr = new T.Vector2(); this.pointers = new Map();
    this.loop = this.loop.bind(this); this.bindInput();
    this.ro = new ResizeObserver(() => this.resize());
    this.setMood('day', 'none');
  }
  on(ev, fn) { this.handlers[ev] = fn; }
  emit(ev, x) { const f = this.handlers[ev]; if (f) { try { f(x); } catch (e) { console.warn(e); } } }
  attach(el) { if (!el) return; if (this.el === el && this.canvas.parentNode === el) return; if (this.el) this.ro.unobserve(this.el); this.el = el; el.appendChild(this.canvas); this.ro.observe(el); this.resize(); }
  setActive(on) { on = !!on; if (on === this.active) return; this.active = on; if (on) { this.dirty = true; this.kick(); } }
  kick() { if (this.active && !this.raf) this.raf = requestAnimationFrame(this.loop); }
  loop(t) { this.raf = 0; if (!this.active) return; const dt = Math.min(0.05, (t - (this.last || t)) / 1000); this.last = t; const moving = this.stepCam(dt); if (moving || this.dirty) { this.renderer.render(this.scene, this.camera); this.dirty = false; } if (moving) this.kick(); else this.last = 0; }
  snapshot() { Object.assign(this.cur, this.home); Object.assign(this.goal, this.home); this.target.copy(this.homeT); this.goalT.copy(this.homeT); this.place(); this.renderer.render(this.scene, this.camera); return this.canvas.toDataURL('image/jpeg', 0.9); }
  zoomBy(f) { this.goal.zoom = clamp(this.goal.zoom * f, 0.3, 2.4); this.kick(); }
  reset() { Object.assign(this.goal, this.home); this.goalT.copy(this.homeT); this.kick(); }
  frame(key) {
    if (!key) { this.reset(); return; }
    this.root.updateMatrixWorld(true);
    const list = key === 'sign' ? (this.signObj ? [this.signObj] : []) : this.pZones.filter(p => p.userData.id === key); if (!list.length) return;
    const b = new T.Box3(); list.forEach(o => b.expandByObject(o)); const c = b.getCenter(new T.Vector3()), r = b.getSize(new T.Vector3()).length() / 2;
    this.goalT.copy(c); this.goal.zoom = clamp((r * 1.6 + 5) / this.rad, 0.3, 1); this.kick();
  }
  dispose() { this.active = false; this.ro.disconnect(); this.clear(this.root); this.clear(this.street); this.renderer.dispose(); this.canvas.remove(); }
  resize() { const el = this.el; if (!el) return; const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.fit(true); this.place(); this.dirty = true; this.kick(); }
  stepCam(dt) {
    const k = 1 - Math.exp(-(dt || 0.016) * 7); let moving = false;
    for (const p of ['yaw', 'pitch', 'zoom']) { const d = this.goal[p] - this.cur[p]; if (Math.abs(d) > 1e-4) { this.cur[p] += d * k; moving = true; } else this.cur[p] = this.goal[p]; }
    if (this.target.distanceToSquared(this.goalT) > 1e-6) { this.target.lerp(this.goalT, k); moving = true; } else this.target.copy(this.goalT);
    this.place(); return moving;
  }
  place() { const c = this.cur, dist = this.baseDist * c.zoom, cp = Math.cos(c.pitch), t = this.target; this.camera.position.set(t.x + dist * cp * Math.sin(c.yaw), Math.max(1.4, t.y + dist * Math.sin(c.pitch)), t.z + dist * cp * Math.cos(c.yaw)); this.camera.lookAt(t); }
  fit(keepTarget) {
    const D = this.dim || { w: 20, d: 16, H: 15 }, r = this.rad = Math.hypot(D.w, D.H, D.d) / 2 + 1.5, vf = T.MathUtils.degToRad(this.camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    this.baseDist = r / Math.sin(Math.min(vf, hf) / 2) * 0.84; this.homeT.set(0, D.H * 0.42, 1.5); if (!keepTarget) { this.goalT.copy(this.homeT); if (!this.fitted) this.target.copy(this.homeT); } this.fitted = true;
    this.scene.fog.near = this.baseDist * 2.5; this.scene.fog.far = this.baseDist * 12;
    const sc = this.sun.shadow.camera, sr = r + 14; sc.left = sc.bottom = -sr; sc.right = sc.top = sr; sc.near = 0.5; sc.far = sr * 5; sc.updateProjectionMatrix(); this.placeSun();
  }
  placeSun() { const v = sunDir(SKY[this.mood || 'day']); if (this.mood === 'dusk') v.y = Math.max(v.y, 0.35); v.normalize().multiplyScalar((this.rad + 14) * 2.4); this.sun.position.copy(this.homeT).add(v); this.sun.target.position.copy(this.homeT); this.sun.target.updateMatrixWorld(); this.renderer.shadowMap.needsUpdate = true; }
  sky(m) { if (this.skies[m]) return this.skies[m]; const t = new T.CanvasTexture(skyCanvas(m)); t.mapping = T.EquirectangularReflectionMapping; t.colorSpace = T.SRGBColorSpace; const env = this.pmrem.fromEquirectangular(t).texture; return (this.skies[m] = { bg: t, env }); }
  setMood(m, lighting) {
    const key = m + '|' + lighting; if (key === this.moodKey) return; this.moodKey = key; this.mood = m; const P = SKY[m], dusk = m === 'dusk', sk = this.sky(m);
    this.scene.background = sk.bg; this.scene.environment = sk.env; this.scene.fog.color.set(P.fog);
    this.hemi.color.set(P.sky); this.hemi.groundColor.set(P.gr); this.hemi.intensity = P.hemi; this.sun.color.set(P.sunCol); this.sun.intensity = P.sunI; this.renderer.toneMappingExposure = P.exp;
    this.M.winLit.emissiveIntensity = dusk ? 1.15 : 0; this.M.winLit2.emissiveIntensity = dusk ? 0.8 : 0; this.M.led.emissiveIntensity = dusk ? 3 : 0.12; this.M.lamp.emissiveIntensity = dusk ? 2.2 : 0;
    this.M.beam.opacity = dusk ? 0.85 : 0; this.M.pool.opacity = dusk ? 0.55 : 0; this.M.glow.opacity = dusk ? 0.5 : 0;
    this.signMats.forEach(x => { if (x.userData.halo) x.opacity = dusk ? 0.9 : 0; else x.emissiveIntensity = dusk && x.userData.lit ? 1.1 : 0; });
    this.placeSun(); this.dirty = true; this.kick();
  }
  mat(sys, sp, colour, finish, pattern) {
    const k = [sys, JSON.stringify(sp || {}), colour, finish || '', pattern || ''].join('|'); let m = this.mcache.get(k); if (m) return m;
    const L = look(sys, sp, colour, finish, pattern);
    m = new T.MeshPhysicalMaterial({ map: L.map, normalMap: L.normal, normalScale: new T.Vector2(1, 1), alphaMap: L.alpha, alphaTest: L.alpha ? 0.5 : 0, side: L.alpha ? T.DoubleSide : T.FrontSide, roughness: L.rough, metalness: L.metal, clearcoat: L.coat, clearcoatRoughness: 0.25, envMapIntensity: 1 });
    m.userData.screen = !!L.alpha; this.mcache.set(k, m); return m;
  }
  solid(c, metal, rough) { const k = 'solid|' + c + '|' + metal + '|' + rough; let m = this.mcache.get(k); if (!m) { m = new T.MeshPhysicalMaterial({ color: c, metalness: metal, roughness: rough, clearcoat: metal > 0.3 ? 0.4 : 0, clearcoatRoughness: 0.3 }); this.mcache.set(k, m); } return m; }
  glass(sp, tint, dark) {
    const app = (sp && sp.appearance) || 'tinted', k = 'glass|' + app + '|' + tint + '|' + !!dark; let m = this.mcache.get(k); if (m) return m;
    const p = { clear: [0.18, 0.28], tinted: [0.5, 0], reflective: [0.88, -0.05] }[app] || [0.5, 0];
    m = new T.MeshPhysicalMaterial({ color: shade(tint, dark ? -0.55 : p[1]), metalness: dark ? 0.35 : p[0], roughness: dark ? 0.12 : 0.025, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 }); this.mcache.set(k, m); return m;
  }
  clear(gp) { for (let i = gp.children.length - 1; i >= 0; i--) { const o = gp.children[i]; gp.remove(o); o.traverse(n => { if (n.isInstancedMesh) n.dispose(); if (n.geometry && !n.geometry.userData.keep) n.geometry.dispose(); const mt = n.material; if (mt && mt.userData && mt.userData.own) { if (mt.userData.ownMaps) [mt.map, mt.emissiveMap].forEach(t => t && t.dispose()); mt.dispose(); } }); } }
  update(cfg) {
    cfg = cfg || {};
    const sk = JSON.stringify([cfg.type, cfg.floors, cfg.width, cfg.height, cfg.owned, cfg.areas, cfg.systems, cfg.assign, cfg.spec, cfg.sysColour, cfg.accent, cfg.finish, cfg.pattern, cfg.hlEntrance, cfg.hlTop, cfg.glassPref, cfg.lighting, cfg.sign, cfg.brandName, cfg.faces, cfg.context]);
    if (sk !== this.sk) { this.sk = sk; const prev = this.dim ? [this.dim.w, this.dim.d, this.dim.H].join() : ''; this.rebuild(cfg); if ([this.dim.w, this.dim.d, this.dim.H].join() !== prev) { this.fit(false); this.place(); } this.moodKey = ''; this.renderer.shadowMap.needsUpdate = true; }
    this.setMood(cfg.dusk ? 'dusk' : 'day', cfg.lighting || 'none');
    this.pickCfg = { mode: cfg.floorPick ? 'floor' : cfg.pick ? 'zone' : null, owned: new Set(cfg.owned || []), hl: new Set(cfg.highlight || []), pz: new Set(cfg.pickZones || []) };
    this.mode = this.pickCfg.mode; if (!this.mode && this.hover) { this.hover = null; this.canvas.style.cursor = 'grab'; this.emit('hover', null); }
    this.applyPick(); this.dirty = true; this.kick();
  }
  rebuild(cfg) {
    this.clear(this.root); this.clear(this.street); this.pFloors = []; this.pZones = []; this.labels = []; this.signMats = []; this.entrance = null; this.signObj = null;
    const type = MASS[cfg.type] ? cfg.type : 'commercial', m = MASS[type], N = clamp(Math.round(+cfg.floors || 1), 1, 60);
    let w = +cfg.width > 0 ? clamp(+cfg.width, 4, 200) : m[0], d = m[1], gh = m[2], fh = m[3], par = m[4];
    if (+cfg.height > 0) { const s = clamp(+cfg.height / (gh + (N - 1) * fh + par), 0.4, 3); gh *= s; fh *= s; par *= s; }
    const plinth = type === 'industrial' ? 0.15 : 0.45, Hb = gh + (N - 1) * fh, H = Hb + par; this.dim = { w, d, H, Hb, gh, fh, par, N };
    const sys = (cfg.systems || []).filter(Boolean), primary = sys[0] || null, A = cfg.assign || {}, spec = cfg.spec || {}, accent = cfg.accent || '#9c7b52', fin = cfg.finish, pat = cfg.pattern;
    const colourOf = k => (cfg.sysColour || {})[k] || DEFC[k] || '#bab5ad';
    const sysFor = z => (A[z] && sys.includes(A[z])) ? A[z] : (z === 'balcony' && A.upper && sys.includes(A.upper) ? A.upper : primary);
    const areas = cfg.areas && cfg.areas.length ? cfg.areas : ['entire'], ent = areas.includes('entire'), faceSel = ['front', 'side', 'rear'].filter(a => areas.includes(a)), partSel = ['ground', 'upper', 'balcony', 'columns', 'entrance', 'parapet'].filter(a => areas.includes(a));
    const owned = Array.isArray(cfg.owned) ? new Set(cfg.owned) : null, vis = new Set(cfg.faces && cfg.faces.length ? cfg.faces : ['front']);
    const scope = (face, part, f) => { if (!primary || !vis.has(face)) return false; if (owned && !owned.has(f === 'top' ? N - 1 : f)) return false; if (ent) return true; const fk = face === 'front' ? 'front' : face === 'rear' ? 'rear' : 'side'; if (faceSel.length && !faceSel.includes(fk)) return false; if (partSel.length && !partSel.includes(part)) return false; return true; };
    const alclad = () => this.mat('alclad', spec.aluminium || {}, colourOf('aluminium'), fin, pat);
    const surf = s => !s ? this.M.plaster : s === 'glass' ? this.M.frame : s === 'aluminium' ? alclad() : this.mat(s, spec[s] || {}, colourOf(s), FINISHABLE[s] ? fin : null, PATTERNABLE[s] ? pat : null);
    const revCol = s => !s ? '#d6ccbd' : s === 'glass' ? '#2f3134' : shade(s === 'aluminium' ? colourOf('aluminium') : colourOf(s), -0.12);
    const accentM = this.solid(accent, 0.6, 0.32);
    const add = (p, geo, mat, x, y, z, cast) => { const o = new T.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = !!cast; o.receiveShadow = true; p.add(o); return o; };
    const box = (p, mat, sx, sy, sz, x, y, z, cast = true) => add(p, boxM(sx, sy, sz), mat, x, y, z, cast);
    const R = rng(hash(type + N + w)), ins = 0.3;
    box(this.root, this.M.plaster2, w - ins * 2, Hb, d - ins * 2, 0, Hb / 2, 0);
    box(this.root, this.M.roof, w - 0.05, 0.24, d - 0.05, 0, Hb - 0.12, 0, false);
    const bayW = BAY[type] || 4, shop = SHOP[type], balc = BALC[type], gp = cfg.glassPref || 'balanced', gr = { min: 0.42, balanced: 0.58, max: 0.78 }[gp] || 0.58, hr = { min: 0.4, balanced: 0.5, max: 0.68 }[gp] || 0.5;
    const FACES = [{ k: 'front', len: w, x: -w / 2, z: d / 2, r: 0 }, { k: 'right', len: d, x: w / 2, z: d / 2, r: Math.PI / 2 }, { k: 'rear', len: w, x: w / 2, z: -d / 2, r: Math.PI }, { k: 'left', len: d, x: -w / 2, z: -d / 2, r: -Math.PI / 2 }];
    const proxy = (parent, kind, id, sx, sy, sz, x, y, z) => { const mt = new T.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0, depthWrite: false }); mt.userData.own = true; const o = new T.Mesh(BOX, mt); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.renderOrder = 10; o.visible = false; o.userData = { kind, id }; parent.add(o); (kind === 'floor' ? this.pFloors : this.pZones).push(o); return o; };
    FACES.forEach(F => {
      const g = new T.Group(); g.position.set(F.x, 0, F.z); g.rotation.y = F.r; this.root.add(g);
      const nb = Math.max(1, Math.round(F.len / bayW)), bay = F.len / nb, front = F.k === 'front', eb = Math.floor(nb / 2), lit = vis.has(F.k);
      const B = { frame: [], pane: [], lit: [], lit2: [], mull: [], led: [], fins: {}, louv: {}, rev: {}, sill: [] }; let door = null;
      const push = (k, c, a) => { (B[k][c] = B[k][c] || []).push(a); };
      const balcBay = b => front && balc && (balc === 1 || b % 2 === 0);
      for (let f = 0; f < N; f++) {
        const y0 = f ? gh + (f - 1) * fh : 0, bh = f ? fh : gh, part = f ? 'upper' : 'ground', s = scope(F.k, part, f) ? sysFor(part) : null, sp = s ? (spec[s] || {}) : {}, holes = [];
        for (let b = 0; b < nb; b++) {
          const cx = (b + 0.5) * bay; let ww, wh, wy, isDoor = false;
          if (f === 0 && front && b === eb) { ww = Math.min(bay * 0.62, 2.8); wh = Math.min(bh * 0.68, 2.9); wy = plinth; isDoor = true; door = { cx, w: ww, h: wh, y: plinth }; }
          else if (f === 0 && type === 'industrial') { ww = bay * 0.7; wh = 1.3; wy = bh - 2.1; }
          else if (f === 0 && shop && front) { ww = bay * 0.84; wh = bh * 0.62; wy = plinth + 0.15; }
          else if (f > 0 && balcBay(b)) { ww = bay * 0.5; wh = bh * 0.72; wy = 0.12; }
          else { ww = bay * (f === 0 ? gr * 0.9 : gr); wh = Math.min(bh * hr, bh - 0.75); wy = Math.max(f === 0 ? plinth + 0.5 : 0, (bh - wh) * 0.6); }
          holes.push({ x: cx - ww / 2, y: y0 + wy, w: ww, h: wh, door: isDoor });
        }
        if (s === 'glass') {
          const tint = colourOf('glass'), sub = sp.sub || 'curtain', zg = 0.08;
          add(g, PLANE, this.glass(sp, tint), F.len / 2, y0 + bh / 2, zg).scale.set(F.len + 0.16, bh, 1);
          if (f) add(g, PLANE, this.glass(sp, tint, true), F.len / 2, y0 + 0.5, zg + 0.003).scale.set(F.len + 0.16, 1.0, 1);
          if (sub === 'spider') { const n = Math.max(1, Math.round(F.len / 1.8)); for (let i = 0; i <= n; i++) [y0 + 0.15, y0 + bh - 0.15].forEach(y => B.mull.push([i * F.len / n, y, zg + 0.05, 0.16, 0.16, 0.1])); }
          else { const n = Math.max(1, Math.round(F.len / 1.5)), mw = sub === 'structural' ? 0.02 : 0.065, md = sub === 'structural' ? 0.02 : 0.14; for (let i = 0; i <= n; i++) B.mull.push([i * F.len / n, y0 + bh / 2, zg + md / 2, mw, bh, md]); B.mull.push([F.len / 2, y0 + 0.03, zg + md / 2, F.len + 0.16, sub === 'structural' ? 0.02 : 0.09, md]); if (f) B.mull.push([F.len / 2, y0 + 1.0, zg + md / 2, F.len + 0.16, sub === 'structural' ? 0.02 : 0.07, md]); }
          if (f === 0 && door) B.frame.push([door.cx, door.y + door.h / 2, zg + 0.06, 0.07, door.h, 0.08], [door.cx, door.y + door.h + 0.03, zg + 0.06, door.w, 0.07, 0.08]);
        } else {
          const finBase = s === 'aluminium' && (sp.sub || 'fins') !== 'cladding', mt = finBase ? this.M.plaster : surf(s), screen = mt.userData.screen, zf = screen ? 0.34 : s ? 0.07 : 0;
          const geo = bandGeo(F.len, y0, bh, holes, screen ? 0 : zf);
          add(g, geo, mt, 0, 0, zf, !screen); if (screen) add(g, geo, this.M.plaster2, 0, 0, 0);
          const zb = screen ? 0 : zf, rc = revCol(finBase ? null : s), zg = -0.17, rd = zb - zg, zc = (zb + zg) / 2;
          holes.forEach(h => {
            const cx = h.x + h.w / 2, cy = h.y + h.h / 2;
            push('rev', rc, [h.x + 0.012, cy, zc, 0.024, h.h, rd]); push('rev', rc, [h.x + h.w - 0.012, cy, zc, 0.024, h.h, rd]); push('rev', rc, [cx, h.y + h.h - 0.012, zc, h.w, 0.024, rd]);
            if (!h.door) B.sill.push([cx, h.y + 0.03, zc + 0.04, h.w + 0.14, 0.06, rd + 0.08]); else push('rev', rc, [cx, h.y + 0.012, zc, h.w, 0.024, rd]);
            const fz = zg + 0.03; B.frame.push([h.x + 0.04, cy, fz, 0.07, h.h, 0.07], [h.x + h.w - 0.04, cy, fz, 0.07, h.h, 0.07], [cx, h.y + h.h - 0.04, fz, h.w, 0.07, 0.07], [cx, h.y + 0.04, fz, h.w, 0.07, 0.07]);
            if (h.w > 1.3) B.frame.push([cx, cy, fz, 0.06, h.h, 0.06]); if (h.h > 1.7 && !h.door) B.frame.push([cx, h.y + h.h * 0.74, fz, h.w, 0.055, 0.06]); if (h.door) B.frame.push([cx, h.y + h.h * 0.82, fz, h.w, 0.06, 0.06]);
            const q = R(); (h.door ? B.pane : q < 0.22 ? B.lit : q < 0.36 ? B.lit2 : B.pane).push([cx, cy, zg, h.w, h.h, 1, 0.82 + R() * 0.3]);
          });
          if (!s && f > 0) box(g, this.M.plaster2, F.len + 0.06, 0.22, 0.05, F.len / 2, y0 + 0.02, 0.025, false);
          if (s === 'aluminium') { const sub = sp.sub || 'fins', c = colourOf('aluminium');
            if (sub === 'fins') { const step = clamp((+sp.spacing || 600) / 1000, 0.3, 2), dep = clamp((+sp.depth || 300) / 1000, 0.1, 0.6), n = Math.min(90, Math.floor(F.len / step)), off = (F.len - (n - 1) * step) / 2; for (let i = 0; i < n; i++) push('fins', c, [off + i * step, y0 + bh / 2, dep / 2 + 0.02, 0.055, bh, dep]); }
            else if (sub === 'louvers') { for (let y = y0 + 0.2; y < y0 + bh - 0.1; y += 0.34) push('louv', c, [F.len / 2, y, 0.2, F.len, 0.035, 0.24]); } }
          if (pat === 'fins' && s && s !== 'aluminium') { const n = Math.floor(F.len / 1.2), off = (F.len - (n - 1) * 1.2) / 2; for (let i = 0; i < n; i++) push('fins', accent, [off + i * 1.2, y0 + bh / 2, zf + 0.13, 0.055, bh, 0.24]); }
          if (f === 0 && !s && shop && front && type !== 'industrial') { const cy = holes[0].y + holes[0].h + 0.35; box(g, this.M.frame, F.len * 0.94, 0.12, 1.3, F.len / 2, cy, 0.65); }
        }
        if (lit && cfg.lighting === 'integrated' && f > 0) { B.led.push([F.len / 2, y0, 0.16, F.len + 0.2, 0.045, 0.05]); add(g, PLANE, this.M.glow, F.len / 2, y0 + 0.25, 0.17, false).scale.set(F.len + 0.2, 0.5, 1); }
      }
      // plinth
      if (type !== 'industrial') { const pz = 0.12, segs = front && door ? [[0, door.cx - door.w / 2 - 0.5], [door.cx + door.w / 2 + 0.5, F.len]] : [[-0.12, F.len + 0.12]]; segs.forEach(([a, b]) => { if (b - a > 0.1) box(g, this.M.plaster2, b - a, plinth, pz * 2 + 0.1, (a + b) / 2, plinth / 2, pz, true); }); }
      // parapet
      const ps = scope(F.k, 'parapet', 'top') ? sysFor('parapet') : null, pm = surf(ps);
      box(g, this.M.plaster, F.len, par, 0.25, F.len / 2, Hb + par / 2, -0.125);
      if (ps) add(g, bandGeo(F.len, Hb, par, [], pm.userData.screen ? 0 : 0.07), pm, 0, 0, 0.07, true);
      box(g, ps && ps !== 'glass' && FINISHABLE[ps] ? this.M.frame : this.M.plaster2, F.len + 0.2, 0.09, 0.52, F.len / 2, H + 0.045, -0.06);
      if (cfg.hlTop && lit) box(g, accentM, F.len + 0.26, 0.32, 0.18, F.len / 2, H - 0.2, 0.2);
      if (lit && cfg.lighting === 'integrated') { B.led.push([F.len / 2, H - 0.06, 0.24, F.len + 0.3, 0.045, 0.05]); add(g, PLANE, this.M.glow, F.len / 2, H - 0.4, 0.25, false).scale.set(F.len + 0.3, 0.7, 1); }
      if (lit && cfg.lighting === 'facade') { const hU = Math.min(H * 0.75, 10); for (let b = 0; b <= nb; b++) { const x = clamp(b * bay, 0.3, F.len - 0.3); add(g, PLANE, this.M.beam, x, hU / 2, 0.5, false).scale.set(2.2, hU, 1); box(g, this.M.frame, 0.28, 0.12, 0.22, x, 0.18, 0.75, false); const pl = add(g, PLANE, this.M.pool, x, 0.13, 1.2, false); pl.rotation.x = -Math.PI / 2; pl.scale.set(2.6, 2.2, 1); } }
      if (front) {
        const xs = [0.25, F.len - 0.25]; if (nb >= 4) for (let b = 2; b < nb - 1; b += 2) if (b !== eb && b !== eb + 1) xs.push(b * bay);
        xs.forEach(x => { for (let f = 0; f < N; f++) { const y0 = f ? gh + (f - 1) * fh : 0, bh = (f ? fh : gh) + (f === N - 1 ? par : 0), cs = scope('front', 'columns', f) ? sysFor('columns') : null; box(g, cs ? surf(cs) : this.M.plaster2, 0.52, bh, 0.42, x, y0 + bh / 2, 0.21); proxy(g, 'zone', 'columns', 0.68, bh + 0.02, 0.6, x, y0 + bh / 2, 0.22); } });
        if (door) { const es = scope('front', 'entrance', 0) ? sysFor('entrance') : null, em = cfg.hlEntrance ? accentM : es ? surf(es) : this.M.plaster2, jw = 0.45, top = door.y + door.h + 0.6, x0 = door.cx - door.w / 2 - jw, x1 = door.cx + door.w / 2 + jw;
          box(g, em, jw, top, 0.62, x0 + jw / 2, top / 2, 0.31); box(g, em, jw, top, 0.62, x1 - jw / 2, top / 2, 0.31); box(g, em, x1 - x0, 0.6, 0.62, door.cx, top - 0.3, 0.31);
          if (cfg.hlEntrance) box(g, accentM, x1 - x0 + 1.4, 0.18, 2.1, door.cx, top + 0.09, 1.05);
          for (let k = 0; k < 3; k++) { const sh = door.y / 3; box(g, this.M.sill, door.w + 1.4 - k * 0.2, sh, 1.4 - k * 0.4, door.cx, sh * (k + 0.5), (1.4 - k * 0.4) / 2, true); }
          this.entrance = { x: door.cx, top: top + (cfg.hlEntrance ? 0.18 : 0), width: x1 - x0 };
          proxy(g, 'zone', 'entrance', x1 - x0 + 0.3, top + 0.3, 1.0, door.cx, top / 2, 0.5); }
        if (balc) for (let f = 1; f < N; f++) for (let b = 0; b < nb; b++) { if (!balcBay(b)) continue; const cx = (b + 0.5) * bay, bw = bay * 0.8, y0 = gh + (f - 1) * fh, bs = scope('front', 'balcony', f) ? sysFor('balcony') : null;
          box(g, this.M.plaster2, bw, 0.18, 1.4, cx, y0 + 0.09, 0.7);
          if (!bs || bs === 'glass') { add(g, PLANE, this.M.rail, cx, y0 + 0.7, 1.36).scale.set(bw - 0.08, 0.92, 1); box(g, this.M.frame, bw, 0.05, 0.07, cx, y0 + 1.18, 1.36, false); box(g, this.M.frame, bw, 0.06, 0.08, cx, y0 + 0.21, 1.36, false); [-1, 1].forEach(sg => box(g, this.M.frame, 0.05, 1.0, 0.05, cx + sg * (bw / 2 - 0.03), y0 + 0.68, 1.36, false)); }
          else { box(g, surf(bs), bw, 1.0, 0.1, cx, y0 + 0.68, 1.35); box(g, this.M.plaster2, bw + 0.04, 0.06, 0.16, cx, y0 + 1.21, 1.35, false); }
          proxy(g, 'zone', 'balcony', bw + 0.24, 1.4, 1.7, cx, y0 + 0.62, 0.8); }
        if (cfg.sign) this.buildSign(cfg, g, F.len);
      }
      const inst = (list, mt, geo, cast, q, tint) => { if (!list.length) return; const im = new T.InstancedMesh(geo, mt, list.length), m4 = new T.Matrix4(), p = new T.Vector3(), sc = new T.Vector3(), col = new T.Color(); q = q || new T.Quaternion(); list.forEach((a, i) => { p.set(a[0], a[1], a[2]); sc.set(a[3], a[4], a[5]); m4.compose(p, q, sc); im.setMatrixAt(i, m4); if (tint) im.setColorAt(i, col.setScalar(a[6] || 1)); }); im.castShadow = !!cast; im.receiveShadow = true; im.frustumCulled = false; g.add(im); };
      inst(B.frame, this.M.frame, BOX, false); inst(B.sill, this.M.sill, BOX, true); inst(B.pane, this.M.win, PLANE, false, null, true); inst(B.lit, this.M.winLit, PLANE, false, null, true); inst(B.lit2, this.M.winLit2, PLANE, false, null, true); inst(B.mull, this.M.frame, BOX, true); inst(B.led, this.M.led, BOX);
      Object.keys(B.rev).forEach(c => inst(B.rev[c], this.solid(c, 0, 0.8), BOX, false));
      Object.keys(B.fins).forEach(c => inst(B.fins[c], this.solid(c, 0.65, 0.32), BOX, true));
      const tilt = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -0.35); Object.keys(B.louv).forEach(c => inst(B.louv[c], this.solid(c, 0.65, 0.32), BOX, true, tilt));
    });
    // rooftop
    if (type !== 'industrial') { const rx = w / 2 - 2.4, rz = -d / 4; box(this.root, this.M.plaster, 3.4, 2.8, 3.8, rx, Hb + 1.4, rz); box(this.root, this.M.plaster2, 3.6, 0.12, 4.0, rx, Hb + 2.86, rz, false); box(this.root, this.M.frame, 1.0, 2.0, 0.06, rx - 0.6, Hb + 1.0, rz + 1.92, false);
      const tx = -w / 2 + 2.6; box(this.root, this.M.frame, 3.4, 0.6, 1.6, tx, Hb + 0.3, rz, false); [-0.8, 0.8].forEach(o => { const c = add(this.root, CYL, this.M.tank, tx + o, Hb + 1.2, rz, true); c.scale.set(1.3, 1.2, 1.3); });
      for (let i = 0; i < Math.min(4, Math.floor(w / 6)); i++) box(this.root, this.M.unit, 0.95, 0.65, 0.4, -w / 2 + 6 + i * 1.6, Hb + 0.33, d / 2 - 2.2, true); }
    // floor proxies + labels
    const deep = balc ? 1.7 : 0;
    for (let f = 0; f < N; f++) { const y0 = f ? gh + (f - 1) * fh : 0, bh = (f ? fh : gh) + (f === N - 1 ? par : 0), p = proxy(this.root, 'floor', f, w + 0.7, bh - 0.05, d + 0.7 + deep, 0, y0 + bh / 2, deep / 2);
      const e = new T.LineSegments(new T.EdgesGeometry(BOX), new T.LineBasicMaterial({ color: AMBER })); e.material.userData.own = true; e.visible = false; p.add(e);
      const lab = f === 0 ? 'G' : String(f), sm = new T.SpriteMaterial({ map: this.labelTex(lab, false), depthTest: false, transparent: true }); sm.userData.own = true; const spr = new T.Sprite(sm); const s = clamp(bh * 0.42, 0.9, 1.8); spr.scale.set(s, s, 1); spr.position.set(-w / 2 - 1.6, y0 + bh / 2, d / 2 + 0.4); spr.renderOrder = 20; spr.visible = false; spr.userData = { id: f, text: lab }; this.root.add(spr); this.labels.push(spr); }
    proxy(this.root, 'zone', 'parapet', w + 0.8, par + 0.3, d + 0.8, 0, Hb + par / 2 + 0.05, 0);
    proxy(this.root, 'zone', 'ground', w + 0.6, gh, d + 0.6, 0, gh / 2, 0); if (N > 1) proxy(this.root, 'zone', 'upper', w + 0.6, Hb - gh, d + 0.6, 0, gh + (Hb - gh) / 2, 0);
    // site
    const cs = add(this.street, PLANE, this.M.contact, 0, 0.126, 0, false); cs.rotation.x = -Math.PI / 2; cs.scale.set((w + 3) * 1.6, (d + 3) * 1.6, 1);
    const sw = 5.2, zk = d / 2 + sw, zr = zk + 4.2;
    const pv = add(this.street, boxM(w + 60, 0.12, d + sw + 16), this.M.pave, 0, 0.06, -8 + sw / 2, false); pv.receiveShadow = true;
    box(this.street, this.M.kerb, w + 60, 0.18, 0.3, 0, 0.09, zk, false);
    const rd = add(this.street, boxM(1400, 0.04, 8.4), this.M.road, 0, 0.02, zr, false); rd.receiveShadow = true;
    for (let x = -300; x <= 300; x += 6) box(this.street, this.M.line, 2.8, 0.01, 0.14, x, 0.045, zr, false);
    [-1, 1].forEach(sg => box(this.street, this.M.line, 1400, 0.01, 0.1, 0, 0.045, zr + sg * 3.9, false));
    const TR = rng(hash('trees' + w)), trees = [];
    for (let x = -w / 2 - 6; x <= w / 2 + 6; x += 7 + TR() * 3) { if (this.entrance && Math.abs(x - (-w / 2 + this.entrance.x)) < 3.4) continue; trees.push(x); }
    trees.forEach(x => { const z = zk - 1.2, hT = 2.4 + TR() * 0.8; add(this.street, CYL, this.M.trunk, x, hT / 2, z, true).scale.set(0.22, hT, 0.22); for (let k = 0; k < 4; k++) { const s = 1.1 + TR() * 0.9, l = add(this.street, ICO, TR() < 0.5 ? this.M.leaf : this.M.leaf2, x + (TR() - 0.5) * 1.6, hT + 0.6 + TR() * 1.2, z + (TR() - 0.5) * 1.4, true); l.scale.set(s, s * 0.85, s); l.rotation.set(TR() * 3, TR() * 3, 0); } });
    [-w / 2 - 2, w / 2 + 2].forEach(x => { const z = zk - 0.4; add(this.street, CYL, this.M.pole, x, 3.5, z, true).scale.set(0.12, 7, 0.12); box(this.street, this.M.pole, 0.1, 0.1, 1.4, x, 7, z + 0.7, false); box(this.street, this.M.lamp, 0.35, 0.1, 0.6, x, 6.93, z + 1.3, false); const pl = add(this.street, PLANE, this.M.pool, x, 0.13, z + 1.3, false); pl.rotation.x = -Math.PI / 2; pl.scale.set(7, 7, 1); });
    if (cfg.context !== false) { const NR = rng(hash('nb' + w + d)); [-1, 1].forEach(sg => { const nw = 12 + NR() * 10, nh = clamp(H * (0.55 + NR() * 0.55), 6, H * 1.2 + 4), nd = d * (0.85 + NR() * 0.3), gap = 4.5 + NR() * 2; const tx = nbTex(Math.floor(NR() * 1e6)); tx.repeat.set(nw / 14, nh / 13); const mt = new T.MeshStandardMaterial({ map: tx, roughness: 0.9 }); mt.userData = { own: true, ownMaps: true }; const o = add(this.street, new T.BoxGeometry(nw, nh, nd), mt, sg * (w / 2 + gap + nw / 2), nh / 2, d / 2 - nd / 2 - 0.6, false); o.receiveShadow = true; box(this.street, this.M.plaster2, nw + 0.2, 0.3, nd + 0.2, o.position.x, nh + 0.15, o.position.z, false); }); }
  }
  buildSign(cfg, g, len) {
    const sg = cfg.sign, D = this.dim, name = String(cfg.brandName || '').trim() || 'Your brand', l2 = String(sg.line2 || '').trim(), board = sg.type !== 'letters', px = 140;
    const font = (wt, s) => `${wt} ${s}px Switzer, "Helvetica Neue", Arial, sans-serif`, txt = board ? name : name.toUpperCase();
    const m0 = canvas(8).getContext('2d'); m0.font = font(600, px); const tw = m0.measureText(txt).width; m0.font = font(500, px * 0.4); const tw2 = l2 ? m0.measureText(l2).width : 0;
    const pad = board ? px * 0.5 : px * 0.14, logo = sg.type === 'logo' ? px * 1.35 : 0, W = Math.ceil(Math.max(tw, tw2) + pad * 2 + logo), Hc = Math.ceil(px * 1.1 + (l2 ? px * 0.62 : 0) + pad * (board ? 1.2 : 0.5));
    const draw = (mode) => { const c = canvas(W, Hc), x = c.getContext('2d'); if (mode === 'blur') x.filter = 'blur(12px)';
      if (board && mode === 'full') { x.fillStyle = sg.board || '#24211f'; rr(x, 0, 0, W, Hc, px * 0.1); x.fill(); }
      if (logo) { x.fillStyle = sg.colour || '#f4f1ea'; x.beginPath(); x.arc(pad + px * 0.55, Hc / 2, px * 0.5, 0, 7); x.fill(); if (mode === 'full') { x.fillStyle = sg.board || '#24211f'; x.font = font(600, px * 0.5); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name.charAt(0).toUpperCase(), pad + px * 0.55, Hc / 2 + 2); } }
      x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillStyle = mode === 'blur' ? '#ffd7a0' : (sg.colour || '#f4f1ea'); x.font = font(600, px); const tx = pad + logo, by = l2 ? Hc / 2 + px * 0.05 : Hc / 2 + px * 0.36; x.fillText(txt, tx, by);
      if (l2) { x.font = font(500, px * 0.4); x.fillText(l2, tx, by + px * 0.5); }
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t; };
    let sw = W * clamp((+sg.height || 600) / 1000, 0.2, 1.4) * (sg.pos === 'top' ? 1.6 : 1) / (px * 0.72), sh = sw * Hc / W;
    const maxW = sg.pos === 'entrance' ? Math.max(2.5, (this.entrance ? this.entrance.width : 4) * 1.2) : len * 0.7, maxH = sg.pos === 'front' ? D.gh * 0.3 : 99, k = Math.min(1, maxW / sw, maxH / sh); sw *= k; sh *= k;
    const metal = sg.finish === 'steel' || sg.finish === 'gold' ? 0.85 : 0, map = draw('full');
    const mt = new T.MeshPhysicalMaterial({ map, transparent: true, alphaTest: 0.02, roughness: metal ? 0.28 : 0.55, metalness: metal, clearcoat: 0.5, emissive: '#ffffff', emissiveMap: board ? draw('letters') : map, emissiveIntensity: 0 });
    mt.userData = { own: true, ownMaps: true, lit: sg.light === 'front' || sg.light === 'halo' }; this.signMats.push(mt);
    let x = len / 2, y, z; if (sg.pos === 'entrance' && this.entrance) { x = this.entrance.x; y = this.entrance.top + 0.25 + sh / 2; z = 0.7; } else if (sg.pos === 'top') { y = D.H + 0.35 + sh / 2; z = -0.5; box3(g, this.M.frame, sw * 0.9, 0.35, 0.12, x, D.H + 0.17, z - 0.08); } else { y = D.gh - 0.35 - sh / 2; z = 0.56; }
    const grp = new T.Group(); grp.position.set(x, y, z); g.add(grp); this.signObj = grp;
    const face = new T.Mesh(PLANE, mt); face.scale.set(sw, sh, 1); face.renderOrder = 3; face.position.z = board ? 0.061 : 0; grp.add(face);
    if (board) { const bx = new T.Mesh(boxM(sw, sh, 0.12), this.solid(sg.board || '#24211f', 0.3, 0.5)); bx.castShadow = true; grp.add(bx); }
    else { const em = new T.MeshBasicMaterial({ map, color: '#1c1812', transparent: true, alphaTest: 0.3 }); em.userData.own = true; for (let i = 1; i <= 5; i++) { const l = new T.Mesh(PLANE, em); l.scale.set(sw, sh, 1); l.position.z = -i * 0.012; grp.add(l); } const sd = new T.MeshBasicMaterial({ map, color: '#000', transparent: true, opacity: 0.3, depthWrite: false }); sd.userData.own = true; const sh2 = new T.Mesh(PLANE, sd); sh2.scale.set(sw, sh, 1); sh2.position.set(0.05, -0.06, -0.09); grp.add(sh2); }
    if (sg.light === 'halo') { const hm = new T.MeshBasicMaterial({ map: draw('blur'), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }); hm.userData = { own: true, ownMaps: true, halo: true }; this.signMats.push(hm); const ho = new T.Mesh(PLANE, hm); ho.scale.set(sw * 1.1, sh * 1.25, 1); ho.position.z = -0.1; grp.add(ho); }
    function box3(p, m, a, b, c, px2, py, pz) { const o = new T.Mesh(boxM(a, b, c), m); o.position.set(px2, py, pz); p.add(o); }
  }
  labelTex(text, on) { const k = text + '|' + (on ? 1 : 0); if (this.labs[k]) return this.labs[k]; const c = canvas(96), g = c.getContext('2d'); g.fillStyle = on ? AMBER : 'rgba(31,21,10,.86)'; g.beginPath(); g.arc(48, 48, 44, 0, 7); g.fill(); g.fillStyle = on ? '#1F150A' : '#F4ECE0'; g.font = '600 40px Switzer, "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 48, 51); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return (this.labs[k] = t); }
  applyPick() {
    const pc = this.pickCfg || { mode: null, owned: new Set(), hl: new Set(), pz: new Set() }, h = this.hover;
    this.pFloors.forEach(p => { const id = p.userData.id, on = pc.owned.has(id), hv = !!h && h.kind === 'floor' && h.id === id, op = (on ? 0.26 : 0) + (hv ? 0.2 : 0); p.material.opacity = op; p.visible = pc.mode === 'floor' && op > 0; if (p.children[0]) p.children[0].visible = on; });
    this.labels.forEach(s => { s.visible = pc.mode === 'floor'; s.material.map = this.labelTex(s.userData.text, pc.owned.has(s.userData.id)); });
    this.pZones.forEach(p => { const id = p.userData.id, ok = pc.mode === 'zone' && pc.pz.has(id), op = (pc.hl.has(id) ? 0.34 : 0) + (h && h.kind === 'zone' && h.id === id ? 0.22 : 0); p.userData.pickable = ok; p.material.opacity = op; p.visible = ok && op > 0; });
    this.dirty = true; this.kick();
  }
  pickAt(e) {
    const list = this.mode === 'floor' ? this.pFloors : this.mode === 'zone' ? this.pZones.filter(p => p.userData.pickable) : []; if (!list.length) return null;
    const r = this.canvas.getBoundingClientRect(); this.ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); this.ray.setFromCamera(this.ptr, this.camera);
    const hit = this.ray.intersectObjects(list, false)[0]; return hit ? { kind: hit.object.userData.kind, id: hit.object.userData.id } : null;
  }
  setHover(h) { const a = this.hover; if ((!a && !h) || (a && h && a.kind === h.kind && a.id === h.id)) return; this.hover = h; this.canvas.style.cursor = h ? 'pointer' : 'grab'; this.applyPick(); this.emit('hover', h ? (h.kind === 'floor' ? { kind: 'floor', floor: h.id } : { kind: 'zone', zone: h.id }) : null); }
  hoverAt(e) { if (!this.mode) return; this.hq = { clientX: e.clientX, clientY: e.clientY }; if (this.hraf) return; this.hraf = requestAnimationFrame(() => { this.hraf = 0; this.setHover(this.pickAt(this.hq)); }); }
  pdist() { const p = [...this.pointers.values()]; return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }
  bindInput() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', e => { try { cv.focus({ preventScroll: true }); cv.setPointerCapture(e.pointerId); } catch (x) {} this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) this.drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false }; else if (this.pointers.size === 2) { this.drag = null; this.pinch = { d: this.pdist(), z: this.goal.zoom }; } });
    cv.addEventListener('pointermove', e => { const p = this.pointers.get(e.pointerId); if (!p) { if (e.pointerType === 'mouse') this.hoverAt(e); return; } p.x = e.clientX; p.y = e.clientY;
      if (this.pinch && this.pointers.size === 2) { const dd = this.pdist(); if (dd > 0 && this.pinch.d > 0) this.goal.zoom = clamp(this.pinch.z * this.pinch.d / dd, 0.3, 2.4); this.kick(); return; }
      const dr = this.drag; if (!dr) return; const dx = e.clientX - dr.x, dy = e.clientY - dr.y; dr.x = e.clientX; dr.y = e.clientY;
      if (!dr.moved && Math.hypot(e.clientX - dr.sx, e.clientY - dr.sy) > 6) { dr.moved = true; cv.style.cursor = 'grabbing'; if (this.hover) this.setHover(null); }
      if (dr.moved) { this.goal.yaw -= dx * 0.0085; this.goal.pitch = clamp(this.goal.pitch + dy * 0.006, -0.02, 1.25); this.kick(); } });
    const end = e => { if (!this.pointers.delete(e.pointerId)) return; const dr = this.drag; if (this.pointers.size < 2) this.pinch = null;
      if (dr && !dr.moved && e.type === 'pointerup' && performance.now() - dr.t < 500) { const h = this.pickAt(e); if (h) this.emit('pick', h.kind === 'floor' ? { kind: 'floor', floor: h.id } : { kind: 'zone', zone: h.id }); }
      if (!this.pointers.size) { this.drag = null; cv.style.cursor = this.hover ? 'pointer' : 'grab'; } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !this.pointers.size) this.setHover(null); });
    cv.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); this.zoomBy(Math.exp(e.deltaY * 0.004)); }, { passive: false });
    cv.addEventListener('keydown', e => { const k = e.key, G = this.goal; if (k === 'ArrowLeft') G.yaw += 0.2; else if (k === 'ArrowRight') G.yaw -= 0.2; else if (k === 'ArrowUp') G.pitch = clamp(G.pitch + 0.1, -0.02, 1.25); else if (k === 'ArrowDown') G.pitch = clamp(G.pitch - 0.1, -0.02, 1.25); else if (k === '+' || k === '=') G.zoom = clamp(G.zoom * 0.8, 0.3, 2.4); else if (k === '-') G.zoom = clamp(G.zoom * 1.25, 0.3, 2.4); else if (k === '0') { this.reset(); return; } else return; e.preventDefault(); this.kick(); });
  }
}
export async function createViewer(threeUrl) { if (!T) { T = await import(threeUrl || new URL('three.module.js', import.meta.url).href); initGeo(); } return new Viewer(); }

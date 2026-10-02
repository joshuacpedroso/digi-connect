// Kit de construção 3D: materiais, texturas procedurais e primitivas "fofinhas" (cantos arredondados).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const k = String(color) + '|' + Object.keys(opts).sort().map((key) => { const v = opts[key]; return key + ':' + (v?.isTexture ? v.uuid : v?.isColor ? v.getHexString() : String(v)); }).join(',');
  if (!matCache.has(k)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...opts });
    matCache.set(k, m);
  }
  return matCache.get(k);
}

const geoCache = new Map();
function rgeo(w, h, d, r) {
  const k = [w, h, d, r].map((v) => v.toFixed(3)).join('|');
  if (!geoCache.has(k)) {
    const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    geoCache.set(k, rr > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d));
  }
  return geoCache.get(k);
}

function finish(mesh, parent, shadow = true) {
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent?.add(mesh);
  return mesh;
}

// Caixa arredondada posicionada pela base (y = chão do objeto).
export function rbox(parent, w, h, d, material, x = 0, y = 0, z = 0, r = 0.04, shadow = true) {
  const m = new THREE.Mesh(rgeo(w, h, d, r), material);
  m.position.set(x, y + h / 2, z);
  return finish(m, parent, shadow);
}

export function cyl(parent, rt, rb, h, material, x = 0, y = 0, z = 0, seg = 24, shadow = true) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y + h / 2, z);
  return finish(m, parent, shadow);
}

export function sphere(parent, r, material, x = 0, y = 0, z = 0, seg = 20, shadow = true) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), material);
  m.position.set(x, y, z);
  return finish(m, parent, shadow);
}

export function group(parent, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent?.add(g);
  return g;
}

// ------------------------------------------------------------- texturas
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function woodTexture(base = [222, 186, 142], repeat = [6, 4]) {
  return canvasTex(1024, 1024, (ctx, w, h) => {
    const rand = rng(7);
    const plankW = 1024 / 8;
    for (let i = 0; i < 8; i++) {
      let y = -rand() * 400;
      while (y < h) {
        const len = 260 + rand() * 360;
        const v = (rand() - 0.5) * 26;
        ctx.fillStyle = `rgb(${base[0] + v},${base[1] + v * 0.9},${base[2] + v * 0.8})`;
        ctx.fillRect(i * plankW, y, plankW, len);
        // veios
        ctx.globalAlpha = 0.09;
        for (let g = 0; g < 9; g++) {
          ctx.strokeStyle = rand() > 0.5 ? '#7a5532' : '#fff3e0';
          ctx.lineWidth = 1 + rand() * 2;
          ctx.beginPath();
          const gx = i * plankW + rand() * plankW;
          ctx.moveTo(gx, y);
          ctx.bezierCurveTo(gx + (rand() - 0.5) * 18, y + len * 0.3, gx + (rand() - 0.5) * 18, y + len * 0.7, gx + (rand() - 0.5) * 10, y + len);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(90,60,35,.35)';
        ctx.fillRect(i * plankW, y + len - 2, plankW, 2);
        y += len;
      }
      ctx.fillStyle = 'rgba(90,60,35,.32)';
      ctx.fillRect(i * plankW, 0, 2, h);
    }
  }, repeat);
}

export function tileTexture(a = '#f4f1ec', b = '#e6e1d8', repeat = [4, 3]) {
  return canvasTex(512, 512, (ctx, w, h) => {
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 ? a : b;
      ctx.fillRect(i * s, j * s, s, s);
    }
    ctx.strokeStyle = 'rgba(0,0,0,.06)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, h); ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); ctx.stroke(); }
  }, repeat);
}

export function carpetTexture(color = '#3c4a66', repeat = [3, 2]) {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    const rand = rng(3);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)';
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
  }, repeat);
}

export function rugTexture(c1, c2, pattern = 'stripes') {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = c2;
    if (pattern === 'stripes') {
      for (let i = 0; i < 10; i++) ctx.fillRect(0, i * 52 + 14, w, 14);
    } else if (pattern === 'circles') {
      for (let r = 240; r > 20; r -= 44) { ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.lineWidth = 12; ctx.strokeStyle = c2; ctx.stroke(); }
    } else if (pattern === 'welcome') {
      ctx.fillStyle = c2;
      ctx.beginPath(); ctx.roundRect(36, 36, w - 72, h - 72, 40); ctx.fill();
      ctx.fillStyle = c1;
      ctx.font = '800 64px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('BEM-VINDO', w / 2, h / 2 - 34);
      ctx.font = '700 34px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('à DIGI ✦', w / 2, h / 2 + 36);
    } else {
      for (let i = -w; i < w * 2; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.lineWidth = 14; ctx.strokeStyle = c2; ctx.stroke(); }
    }
    ctx.strokeStyle = 'rgba(255,255,255,.45)';
    ctx.lineWidth = 10;
    ctx.strokeRect(18, 18, w - 36, h - 36);
  });
}

export function signTexture(title, subtitle) {
  return canvasTex(1024, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#0d1b33'); g.addColorStop(1, '#14284d');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(0, 0, w, h, 40); ctx.fill();
    ctx.font = '800 112px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(80,160,255,.9)'; ctx.shadowBlur = 30;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('DIGI', 70, h / 2 - (subtitle ? 18 : 0));
    const dw = ctx.measureText('DIGI ').width;
    ctx.fillStyle = '#5aa8ff';
    ctx.fillText(title, 70 + dw, h / 2 - (subtitle ? 18 : 0));
    if (subtitle) {
      ctx.shadowBlur = 0;
      ctx.font = '600 34px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(200,220,255,.75)';
      ctx.fillText(subtitle, 74, h / 2 + 72);
    }
  }, [1, 1]);
}

export function artTexture(seed, palette) {
  return canvasTex(256, 320, (ctx, w, h) => {
    const rand = rng(seed);
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = palette[1 + (i % (palette.length - 1))];
      ctx.globalAlpha = 0.85;
      const kind = rand();
      ctx.beginPath();
      if (kind < 0.4) ctx.arc(rand() * w, rand() * h, 30 + rand() * 70, 0, Math.PI * 2);
      else if (kind < 0.7) ctx.rect(rand() * w * 0.7, rand() * h * 0.7, 50 + rand() * 90, 30 + rand() * 120);
      else { ctx.moveTo(rand() * w, rand() * h); ctx.lineTo(rand() * w, rand() * h); ctx.lineTo(rand() * w, rand() * h); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [1, 1]);
}

export function screenTexture(kind = 'code') {
  return canvasTex(256, 160, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#0f1f3d'); g.addColorStop(1, '#1b3f7a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const rand = rng(kind.length * 17 + 3);
    if (kind === 'code') {
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = ['#5aa8ff', '#7ee0c3', '#ffd479', '#ff8fa3', '#c4b5fd'][i % 5];
        ctx.fillRect(14 + (i % 3) * 12, 12 + i * 11.5, 30 + rand() * 140, 5);
      }
    } else if (kind === 'chart') {
      for (let i = 0; i < 9; i++) {
        const bh = 20 + rand() * 100;
        ctx.fillStyle = i % 2 ? '#5aa8ff' : '#7ee0c3';
        ctx.fillRect(20 + i * 24, h - 16 - bh, 14, bh);
      }
    } else {
      ctx.fillStyle = '#ffffff22';
      ctx.fillRect(16, 16, w - 32, 40);
      ctx.fillStyle = '#5aa8ff';
      ctx.beginPath(); ctx.arc(60, 105, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffffaa';
      ctx.fillRect(110, 85, 110, 8); ctx.fillRect(110, 105, 80, 8);
    }
  }, [1, 1]);
}

export function blobShadowTexture() {
  return canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function windowSkyTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#9fd3ff'); g.addColorStop(0.7, '#d9f0ff'); g.addColorStop(1, '#ffe9d1');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    [[60, 70, 26], [90, 64, 34], [124, 72, 24], [190, 120, 18], [214, 116, 24]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = 'rgba(120,170,140,.55)';
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(i * 32, h - 20, 26, 0, Math.PI * 2); ctx.fill(); }
  }, [1, 1]);
}

export function noiseTexture(base = '#888888', amount = 0.06, size = 256, repeat = [2, 2]) {
  return canvasTex(size, size, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const rand = rng(11);
    for (let i = 0; i < w * h * 0.25; i++) {
      ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${amount})` : `rgba(0,0,0,${amount})`;
      ctx.fillRect(rand() * w, rand() * h, 1.5, 1.5);
    }
  }, repeat);
}

export function labelTexture(text, { bg = '#ffffff', fg = '#1b2a4a', w = 512, h = 128, font = 700 } = {}) {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(0, 0, w, h, h * 0.25); ctx.fill();
    ctx.fillStyle = fg; ctx.font = `${font} ${Math.round(h * 0.42)}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  }, [1, 1]);
}

export function gameScreenTexture(seed = 1) {
  return canvasTex(128, 160, (ctx, w, h) => {
    ctx.fillStyle = '#0b0b2a'; ctx.fillRect(0, 0, w, h);
    const rand = rng(seed * 13);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(rand() * w, rand() * h, 1, 1); }
    const cols = ['#ff4fd8', '#4fe3ff', '#ffe94f', '#6bff4f'];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { ctx.fillStyle = cols[r]; ctx.fillRect(10 + c * 18, 18 + r * 16, 10, 8); }
    ctx.fillStyle = '#4fe3ff'; ctx.beginPath(); ctx.moveTo(64, 130); ctx.lineTo(54, 148); ctx.lineTo(74, 148); ctx.fill();
    ctx.fillStyle = '#ffe94f'; ctx.font = 'bold 12px monospace'; ctx.fillText('SCORE 4200', 8, 12);
  }, [1, 1]);
}

export function snackTexture() {
  return canvasTex(128, 192, (ctx, w, h) => {
    ctx.fillStyle = '#1b2033'; ctx.fillRect(0, 0, w, h);
    const cols = ['#ff5d6e', '#ffd479', '#5aa8ff', '#7ee0c3', '#c4b5fd', '#ff9f43'];
    for (let r = 0; r < 5; r++) {
      ctx.fillStyle = '#3a4058'; ctx.fillRect(4, 30 + r * 34, w - 8, 3);
      for (let c = 0; c < 4; c++) { ctx.fillStyle = cols[(r + c) % cols.length]; ctx.fillRect(10 + c * 28, 10 + r * 34, 18, 20); }
    }
  }, [1, 1]);
}

// Junta malhas estáticas em poucas malhas (1 por material). Ignora o que tiver userData.dynamic/kind.
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map();
  const remove = [];
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.userData.kind) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}`;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.morphAttributes = {};
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder, geos: [] });
    buckets.get(key).geos.push(g);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geos, false);
    b.geos.forEach((g) => g.dispose());
    if (!geo) continue;
    const m = new THREE.Mesh(geo, b.mat);
    m.castShadow = b.cast;
    m.receiveShadow = b.receive;
    m.renderOrder = b.order;
    m.matrixAutoUpdate = false;
    root.add(m);
  }
  root.updateMatrixWorld(true);
}

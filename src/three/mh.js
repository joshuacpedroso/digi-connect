// Monta personagens do MakeHuman (CC0) no navegador: aplica os morphs do criador,
// encaixa cabelo/roupas/olhos no corpo, calcula o esqueleto e cria as malhas com skinning.
// Os dados vêm de public/mh/ (gerados por tools/bake-mh.mjs).
import * as THREE from 'three';
import { targetWeights } from '../../shared/avatar.js';

const BASE = '/mh/';
const view = (buf, s, T) => new T(buf, s.o, s.n);
const getBin = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.arrayBuffer(); });

let dataP = null;
export function loadHumanData() {
  dataP ||= Promise.all([
    fetch(`${BASE}human.json`).then((r) => { if (!r.ok) throw new Error('human.json'); return r.json(); }),
    getBin(`${BASE}human.bin`),
  ]).then(([meta, buf]) => {
    const S = meta.sections;
    const H = {
      meta, N: meta.N,
      base: view(buf, S.base, Float32Array),
      bodyOrig: view(buf, S.bodyOrig, Uint16Array),
      bodyUv: view(buf, S.bodyUv, Float32Array),
      bodyTris: view(buf, S.bodyTris, Uint16Array),
      skinI: view(buf, S.skinI, Uint8Array),
      skinW: view(buf, S.skinW, Uint8Array),
      jointVerts: view(buf, S.jointVerts, Uint16Array),
      tailVerts: view(buf, S.tailVerts, Uint16Array),
      targets: {},
      boneIndex: new Map(meta.bones.map((b, i) => [b.name, i])),
    };
    for (const [k, t] of Object.entries(meta.targets)) {
      H.targets[k] = { idx: t.i ? view(buf, t.i, Uint16Array) : null, d: view(buf, t.d, t.b === 8 ? Int8Array : Int16Array), q: t.q };
    }
    H.bodyTrisOrig = new Uint16Array(H.bodyTris.length);
    for (let i = 0; i < H.bodyTris.length; i++) H.bodyTrisOrig[i] = H.bodyOrig[H.bodyTris[i]];
    // vértices da cabeça (para medir o rosto: óculos, headphone)
    const head = new Set(['head', 'jaw', 'eye.L', 'eye.R', 'orbicularis03.L', 'orbicularis03.R', 'orbicularis04.L', 'orbicularis04.R'].map((n) => H.boneIndex.get(n)));
    const hv = [];
    for (let v = 0; v < 13380; v++) if (head.has(H.skinI[v * 4]) && H.skinW[v * 4] > 128) hv.push(v);
    H.headVerts = Uint16Array.from(hv);
    return H;
  });
  return dataP;
}

const proxyCache = new Map();
export function loadProxy(name) {
  if (!proxyCache.has(name)) {
    proxyCache.set(name, Promise.all([loadHumanData(), getBin(`${BASE}p/${name}.bin`)]).then(([H, buf]) => {
      const m = H.meta.proxies[name];
      if (!m) throw new Error(`proxy ${name}`);
      const S = m.S;
      const p = {
        name, meta: m,
        ref: view(buf, S.ref, Uint16Array), w: view(buf, S.w, Float32Array), off: view(buf, S.off, Float32Array),
        orig: view(buf, S.orig, Uint16Array), uv: view(buf, S.uv, Float32Array),
        tris: view(buf, S.tris, m.M > 65535 ? Uint32Array : Uint16Array),
        skinI: view(buf, S.skinI, Uint8Array), skinW: view(buf, S.skinW, Uint8Array), del: view(buf, S.del, Uint16Array),
      };
      p.trisOrig = new Uint32Array(p.tris.length);
      for (let i = 0; i < p.tris.length; i++) p.trisOrig[i] = p.orig[p.tris[i]];
      return p;
    }));
    proxyCache.get(name).catch(() => proxyCache.delete(name));
  }
  return proxyCache.get(name);
}

// ---------- texturas ----------
const texLoader = new THREE.TextureLoader();
const texCache = new Map();
export function loadTex(path, { srgb = true } = {}) {
  if (!texCache.has(path)) {
    texCache.set(path, texLoader.loadAsync(BASE + path).then((t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 4;
      return t;
    }));
  }
  return texCache.get(path);
}

// ---------- geometria ----------
export function computeShape(H, cfg) {
  const pos = H.base.slice();
  for (const [k, w] of targetWeights(cfg)) {
    const t = H.targets[k];
    if (!t || !w) continue;
    const s = w * 1e-4 * t.q, d = t.d, idx = t.idx;
    if (idx) {
      for (let j = 0; j < idx.length; j++) { const v = idx[j] * 3, o = j * 3; pos[v] += d[o] * s; pos[v + 1] += d[o + 1] * s; pos[v + 2] += d[o + 2] * s; }
    } else {
      for (let i = 0; i < d.length; i++) pos[i] += d[i] * s;
    }
  }
  return pos;
}

function fitProxy(p, pos) {
  const P = p.meta.P, out = new Float32Array(P * 3), ref = p.ref, w = p.w, off = p.off;
  for (let i = 0; i < P; i++) {
    const a = ref[i * 3] * 3, b = ref[i * 3 + 1] * 3, c = ref[i * 3 + 2] * 3;
    const wa = w[i * 3], wb = w[i * 3 + 1], wc = w[i * 3 + 2];
    for (let k = 0; k < 3; k++) out[i * 3 + k] = pos[a + k] * wa + pos[b + k] * wb + pos[c + k] * wc + off[i * 3 + k];
  }
  return out;
}

function vertexNormals(pos, count, tris) {
  const n = new Float32Array(count * 3);
  for (let i = 0; i < tris.length; i += 3) {
    const a = tris[i] * 3, b = tris[i + 1] * 3, c = tris[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    n[a] += nx; n[a + 1] += ny; n[a + 2] += nz; n[b] += nx; n[b + 1] += ny; n[b + 2] += nz; n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

// Expande dados por vértice original para os vértices separados por UV.
function buildGeometry(pos, nrm, orig, uv, index, skinI, skinW) {
  const M = orig.length;
  const P = new Float32Array(M * 3), Nn = new Float32Array(M * 3), SI = new Uint8Array(M * 4), SW = new Uint8Array(M * 4);
  for (let i = 0; i < M; i++) {
    const o = orig[i];
    P[i * 3] = pos[o * 3]; P[i * 3 + 1] = pos[o * 3 + 1]; P[i * 3 + 2] = pos[o * 3 + 2];
    Nn[i * 3] = nrm[o * 3]; Nn[i * 3 + 1] = nrm[o * 3 + 1]; Nn[i * 3 + 2] = nrm[o * 3 + 2];
    for (let k = 0; k < 4; k++) { SI[i * 4 + k] = skinI[o * 4 + k]; SW[i * 4 + k] = skinW[o * 4 + k]; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4, true));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  return g;
}

export function partsOf(cfg) {
  const parts = ['HighPolyEyes', 'Eyelashes01', 'Teeth_Base', 'tongue01', cfg.brows];
  if (cfg.hair !== 'none') parts.push(cfg.hair);
  if (cfg.beard !== 'none') parts.push(cfg.beard);
  parts.push(cfg.top);
  if (cfg.bottom) parts.push(cfg.bottom);
  parts.push(cfg.shoes);
  if (cfg.hat !== 'none') parts.push(cfg.hat);
  if (cfg.acc === 'glasses' || cfg.acc === 'sunglasses') parts.push('glasses');
  return parts;
}

// Materiais
const SKIN_AVG = new THREE.Color().setRGB(205 / 255, 154 / 255, 127 / 255, THREE.SRGBColorSpace);
function skinColor(hex) {
  const c = new THREE.Color(hex);
  return new THREE.Color(Math.min(1.12, c.r / SKIN_AVG.r), Math.min(1.12, c.g / SKIN_AVG.g), Math.min(1.12, c.b / SKIN_AVG.b)).multiplyScalar(0.92);
}
// pelos: textura em tons de cinza com média 0,5 → cor * 2
const hairTint = (hex, k = 1.6) => new THREE.Color(hex).multiplyScalar(k);

async function materialFor(kind, p, cfg) {
  const m = p.meta;
  if (kind === 'eyes') {
    // a córnea fica na parte transparente da textura → descartada; o brilho vem do clearcoat
    return new THREE.MeshPhysicalMaterial({ map: await loadTex(m.maps[cfg.eyes] || m.maps.brown), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, alphaTest: 0.5 });
  }
  const map = m.map ? await loadTex(m.map) : null;
  const normalMap = m.normalMap ? await loadTex(m.normalMap, { srgb: false }) : null;
  if (kind === 'hair' || kind === 'beard' || kind === 'eyebrows' || kind === 'eyelashes') {
    const color = kind === 'eyelashes' ? hairTint('#120d0a', 1.2) : hairTint(cfg.hairColor, kind === 'hair' ? 1.7 : 1.4);
    const mat = new THREE.MeshStandardMaterial({ map, color, roughness: kind === 'hair' ? 0.55 : 0.85, metalness: 0, side: THREE.DoubleSide });
    if (kind === 'hair') {
      mat.alphaTest = 0.5; // passada opaca; uma segunda passada translúcida suaviza as pontas
      mat.userData.mask = true;
    } else {
      Object.assign(mat, { transparent: true, depthWrite: false, alphaTest: 0.04, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
      mat.userData.blend = true;
    }
    return mat;
  }
  if (kind === 'teeth' || kind === 'tongue') return new THREE.MeshStandardMaterial({ map, roughness: 0.35, alphaTest: 0.5 });
  const mat = new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.82, side: THREE.DoubleSide, alphaTest: m.alpha ? 0.5 : 0 });
  if (p.name === 'glasses') {
    mat.roughness = 0.25; mat.metalness = 0.3;
    if (cfg.acc === 'sunglasses') mat.color.set('#5a5f66');
  }
  return mat;
}

let skinTexP = null;
export function skinTexture() {
  skinTexP ||= loadHumanData().then((H) => Promise.all([loadTex(H.meta.skin), loadTex(H.meta.skinNormal, { srgb: false }), loadTex(H.meta.lipsMask, { srgb: false })]));
  return skinTexP;
}

// Pele: textura + cor do tom escolhido, detalhe de poros (normal map) e batom (máscara dos lábios).
function skinMaterial([map, normalMap, lipsMask], cfg) {
  const m = new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(0.55, 0.55), color: skinColor(cfg.skin), roughness: 0.56, metalness: 0 });
  const lip = cfg.lips && cfg.lips !== 'none' ? new THREE.Color(cfg.lips) : null;
  m.userData.skin = true;
  if (!lip) return m;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.lipsMask = { value: lipsMask };
    sh.uniforms.lipColor = { value: lip };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D lipsMask;\nuniform vec3 lipColor;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float lipK = smoothstep(0.08, 0.6, texture2D(lipsMask, vMapUv).r);
        float lipL = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(diffuseColor.rgb, lipColor * (0.55 + 0.9 * lipL), lipK * 0.85);`);
  };
  m.customProgramCacheKey = () => 'skin-lips';
  return m;
}

export async function buildHuman(cfg) {
  const H = await loadHumanData();
  const names = partsOf(cfg);
  const [proxies, skinMap] = await Promise.all([Promise.all(names.map(loadProxy)), skinTexture()]);
  const pos = computeShape(H, cfg);
  const meta = H.meta;

  // esqueleto: cada osso na média dos vértices da sua junta, sem rotação de repouso
  const J = meta.joints.map(([o, c]) => {
    const v = new THREE.Vector3();
    for (let k = 0; k < c; k++) { const i = H.jointVerts[o + k] * 3; v.x += pos[i]; v.y += pos[i + 1]; v.z += pos[i + 2]; }
    return v.multiplyScalar(1 / c);
  });
  const tail = (n) => {
    const [o, c] = meta.tails[n]; const v = new THREE.Vector3();
    for (let k = 0; k < c; k++) { const i = H.tailVerts[o + k] * 3; v.x += pos[i]; v.y += pos[i + 1]; v.z += pos[i + 2]; }
    return v.multiplyScalar(1 / c);
  };
  const bones = meta.bones.map((b, i) => {
    const bone = new THREE.Bone();
    bone.name = b.name;
    bone.position.copy(J[i]);
    if (b.parent >= 0) bone.position.sub(J[b.parent]);
    return bone;
  });
  meta.bones.forEach((b, i) => { if (b.parent >= 0) bones[b.parent].add(bones[i]); });

  const group = new THREE.Group();
  group.add(bones[0]);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const materials = [];
  const meshes = [];
  const add = (geo, mat, order = 0) => {
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.bind(skeleton);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    group.add(mesh);
    meshes.push(mesh);
    materials.push(mat);
    return mesh;
  };

  // corpo (sem as faces cobertas pelas roupas)
  const hidden = new Uint8Array(H.N);
  for (const p of proxies) for (let i = 0; i < p.del.length; i++) hidden[p.del[i]] = 1;
  const keep = [];
  const T = H.bodyTrisOrig;
  for (let i = 0; i < T.length; i += 3) if (!(hidden[T[i]] && hidden[T[i + 1]] && hidden[T[i + 2]])) keep.push(H.bodyTris[i], H.bodyTris[i + 1], H.bodyTris[i + 2]);
  const bodyNormals = vertexNormals(pos, H.N, H.bodyTrisOrig);
  const bodyGeo = buildGeometry(pos, bodyNormals, H.bodyOrig, H.bodyUv, Uint16Array.from(keep), H.skinI, H.skinW);
  add(bodyGeo, skinMaterial(skinMap, cfg));

  let minY = Infinity;
  for (let i = 1; i < pos.length && i < 13380 * 3; i += 3) minY = Math.min(minY, pos[i]);
  for (const p of proxies) {
    const kind = p.meta.kind;
    const pp = fitProxy(p, pos);
    const nrm = vertexNormals(pp, p.meta.P, p.trisOrig);
    const geo = buildGeometry(pp, nrm, p.orig, p.uv, p.tris, p.skinI, p.skinW);
    const mat = await materialFor(kind, p, cfg);
    const order = kind === 'hair' ? 3 : kind === 'eyebrows' || kind === 'eyelashes' || kind === 'beard' ? 2 : 1;
    const mesh = add(geo, mat, order);
    mesh.userData.part = p.name;
    if (mat.userData.mask) {
      // cabelo: pontas translúcidas por cima da passada recortada
      const soft = mat.clone();
      Object.assign(soft, { alphaTest: 0.02, transparent: true, depthWrite: false });
      soft.userData = { blend: true };
      const m2 = add(geo, soft, order + 1);
      m2.castShadow = false;
    }
    if (kind === 'eyes' || kind === 'teeth' || kind === 'tongue' || kind === 'eyelashes') mesh.castShadow = false;
    if (/^shoes|Boots/.test(p.name)) for (let i = 1; i < pp.length; i += 3) minY = Math.min(minY, pp[i]);
  }

  // medidas usadas pela animação e pelos acessórios
  const P = (n) => J[H.boneIndex.get(n)].clone();
  const headBox = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const i of H.headVerts) headBox.expandByPoint(v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
  const info = {
    minY, hipY: (P('upperleg01.L').y + P('upperleg01.R').y) / 2, headTop: tail('head').y,
    head: headBox, eyes: { l: P('eye.L'), r: P('eye.R') },
    joints: P,
  };
  return { group, bones, skeleton, meshes, materials, info };
}

export function disposeHuman(h) {
  for (const m of h.meshes) { m.geometry.dispose(); m.material.dispose(); }
  h.skeleton.dispose?.();
}

// Converte os dados do MakeHuman (CC0) para o formato leve usado em src/three/mh/.
// Uso: MH_DATA=<pasta do pacote npm makehuman-data> MH_EXTRA=<pasta com texturas 2048> node tools/bake-mh.mjs
// Requer `sharp` instalado globalmente ou no NODE_PATH (não é dependência do app).
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const DATA = process.env.MH_DATA;
const EXTRA = process.env.MH_EXTRA || '';
const OUT = process.env.MH_OUT || path.resolve('public/mh');
if (!DATA) throw new Error('defina MH_DATA');
const PUB = path.join(DATA, 'public/data');
const SC = 0.1; // decímetros → metros
const N = 19158;
fs.mkdirSync(path.join(OUT, 'p'), { recursive: true });
fs.mkdirSync(path.join(OUT, 't'), { recursive: true });

const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const base = readJSON(path.join(PUB, 'models/human_full_size.json'));
const rig = readJSON(path.join(DATA, 'src/json/rigs/default.json'));
const targetList = Object.keys(readJSON(path.join(DATA, 'src/json/targets/target-list.json')).targets).sort();
const tbuf = fs.readFileSync(path.join(PUB, 'targets/targets.bin'));
const T16 = new Int16Array(tbuf.buffer, tbuf.byteOffset, tbuf.byteLength / 2);

// ---------- escrita binária ----------
class Bin {
  constructor() { this.parts = []; this.len = 0; }
  push(typed) {
    const pad = (4 - (this.len % 4)) % 4;
    if (pad) { this.parts.push(Buffer.alloc(pad)); this.len += pad; }
    const off = this.len;
    const b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    this.parts.push(Buffer.from(b));
    this.len += b.length;
    return { o: off, n: typed.length };
  }
  save(f) { fs.writeFileSync(f, Buffer.concat(this.parts)); return this.len; }
}

// ---------- faces (three.js JSON v3) ----------
function parseFaces(m) {
  const F = m.faces; const out = []; let i = 0; const nUv = m.uvs.length;
  while (i < F.length) {
    const t = F[i++]; const nv = t & 1 ? 4 : 3;
    const vs = F.slice(i, i + nv); i += nv;
    let mat = 0; if (t & 2) mat = F[i++];
    if (t & 4) i += nUv;
    let uvs = null; if (t & 8) { uvs = F.slice(i, i + nv); i += nv * nUv; }
    if (t & 16) i++; if (t & 32) i += nv; if (t & 64) i++; if (t & 128) i += nv;
    out.push({ vs, mat, uvs });
  }
  return out;
}

// Malha renderizável: separa vértices por UV e triangula os quads.
function splitMesh(faces, uvArr, keep = () => true) {
  const map = new Map(); const orig = []; const uv = []; const tris = [];
  const idx = (v, t) => {
    const k = v * 100000 + t;
    let s = map.get(k);
    if (s === undefined) { s = orig.length; map.set(k, s); orig.push(v); uv.push(uvArr[t * 2], uvArr[t * 2 + 1]); }
    return s;
  };
  for (const f of faces) {
    if (!keep(f)) continue;
    const s = f.vs.map((v, j) => idx(v, f.uvs ? f.uvs[j] : 0));
    tris.push(s[0], s[1], s[2]);
    if (s.length === 4) tris.push(s[0], s[2], s[3]);
  }
  return { orig, uv, tris };
}

// ---------- esqueleto reduzido ----------
const KEEP = new Set([
  'root', 'spine05', 'spine04', 'spine03', 'spine02', 'spine01', 'neck01', 'neck02', 'neck03', 'head', 'jaw',
  'eye.L', 'eye.R', 'orbicularis03.L', 'orbicularis03.R', 'orbicularis04.L', 'orbicularis04.R',
]);
for (const s of ['L', 'R']) {
  ['clavicle', 'shoulder01', 'upperarm01', 'upperarm02', 'lowerarm01', 'lowerarm02', 'wrist',
    'pelvis', 'upperleg01', 'upperleg02', 'lowerleg01', 'lowerleg02', 'foot'].forEach((b) => KEEP.add(`${b}.${s}`));
  for (let f = 1; f <= 5; f++) for (let j = 1; j <= 3; j++) KEEP.add(`finger${f}-${j}.${s}`);
}
const RB = rig.bones;
const keptOf = (name) => { let n = name; while (n && !KEEP.has(n)) n = RB[n]?.parent; return n || 'root'; };
// ordem: pais antes dos filhos
const order = []; const seen = new Set();
const visit = (n) => { if (seen.has(n)) return; const p = RB[n].parent; if (p) visit(p); seen.add(n); if (KEEP.has(n)) order.push(n); };
Object.keys(RB).forEach(visit);
const boneIndex = new Map(order.map((n, i) => [n, i]));
const bones = order.map((n) => ({ name: n, parent: RB[n].parent ? boneIndex.get(keptOf(RB[n].parent)) : -1 }));

// pesos por vértice original (até 4)
const vWeights = [];
for (let v = 0; v < N; v++) {
  const acc = new Map();
  for (let k = 0; k < 4; k++) {
    const w = base.skinWeights[v * 4 + k]; if (!(w > 0)) continue;
    const nm = base.bones[base.skinIndices[v * 4 + k]].name.replace(/____(head|tail)$/, '');
    const b = boneIndex.get(keptOf(nm));
    acc.set(b, (acc.get(b) || 0) + w);
  }
  vWeights.push(acc);
}
function packWeights(list) {
  const I = new Uint8Array(list.length * 4); const W = new Uint8Array(list.length * 4);
  list.forEach((acc, i) => {
    const top = [...acc.entries()].filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, e) => s + e[1], 0) || 1;
    const q = top.map(([, w]) => Math.round((w / sum) * 255));
    q[0] += 255 - q.reduce((s, x) => s + x, 0); // soma exata 255 (o maior absorve o arredondamento)
    top.forEach(([b], k) => { I[i * 4 + k] = b; W[i * 4 + k] = q[k]; });
    if (!top.length) { I[i * 4] = boneIndex.get('head'); W[i * 4] = 255; }
  });
  return { I, W };
}

// ---------- base ----------
const bin = new Bin();
const meta = { version: 1, N, scale: SC, bones, sections: {}, targets: {}, joints: [] };
const basePos = new Float32Array(N * 3);
for (let i = 0; i < N * 3; i++) basePos[i] = base.vertices[i] * SC;
meta.sections.base = bin.push(basePos);

const faces = parseFaces(base);
const body = splitMesh(faces, base.uvs[0], (f) => f.mat === 0);
meta.sections.bodyOrig = bin.push(Uint16Array.from(body.orig));
meta.sections.bodyUv = bin.push(Float32Array.from(body.uv));
meta.sections.bodyTris = bin.push(Uint16Array.from(body.tris));
const bw = packWeights(vWeights);
meta.sections.skinI = bin.push(bw.I);
meta.sections.skinW = bin.push(bw.W);
meta.bodyVerts = body.orig.length;

// juntas: média dos vértices (cabeça de cada osso mantido)
const jointVerts = [];
const jointsMeta = order.map((n) => {
  const list = rig.joints[RB[n].head];
  const o = jointVerts.length; jointVerts.push(...list);
  return [o, list.length];
});
meta.joints = jointsMeta;
meta.sections.jointVerts = bin.push(Uint16Array.from(jointVerts));
// pontas úteis (topo da cabeça, ponta dos dedos do pé) para medidas em tempo de execução
const tailOf = (n) => rig.joints[RB[n].tail];
meta.tails = {};
const tailVerts = [];
for (const n of ['head', 'foot.L', 'foot.R', 'eye.L', 'eye.R', 'wrist.L', 'wrist.R', 'finger3-3.L', 'finger3-3.R']) {
  const l = tailOf(n); meta.tails[n] = [tailVerts.length, l.length]; tailVerts.push(...l);
}
meta.sections.tailVerts = bin.push(Uint16Array.from(tailVerts));

// ---------- alvos (morphs) ----------
// Cada alvo: índices (omitidos se denso) + deltas em 1e-4 m (Int8 quando cabem, com passo `q`).
const rowOf = (name) => {
  const i = targetList.indexOf(`data/targets/${name}.target`);
  return i < 0 ? null : T16.subarray(i * N * 3, (i + 1) * N * 3);
};
function addTarget(name, key = name, row = rowOf(name), robust = false) {
  if (!row) { console.warn('alvo ausente', name); return false; }
  const o = 0; const idx = []; const d = [];
  const T16 = row;
  for (let v = 0; v < N; v++) {
    const x = T16[o + v * 3], y = T16[o + v * 3 + 1], z = T16[o + v * 3 + 2];
    if (x || y || z) { idx.push(v); d.push(x, y, z); }
  }
  if (!idx.length) return false;
  if (robust) {
    // alguns alvos do pacote têm lixo (deltas enormes em vértices soltos): descarta outliers
    const mag = idx.map((_, k) => Math.hypot(d[k * 3], d[k * 3 + 1], d[k * 3 + 2]));
    const sorted = [...mag].sort((a, b) => a - b);
    const lim = Math.min(800, Math.max(150, sorted[Math.floor(sorted.length * 0.5)] * 12)); // ≤ 8 cm
    const keepK = mag.map((m, k) => (m <= lim ? k : -1)).filter((k) => k >= 0);
    if (keepK.length < idx.length) console.log('  outliers removidos', key, idx.length - keepK.length);
    const i2 = keepK.map((k) => idx[k]); const d2 = keepK.flatMap((k) => [d[k * 3], d[k * 3 + 1], d[k * 3 + 2]]);
    idx.length = 0; idx.push(...i2); d.length = 0; d.push(...d2);
  }
  const max = d.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  const dense = idx.length > N * 0.85;
  const t = {};
  if (dense) { const full = new Array(N * 3).fill(0); idx.forEach((v, k) => { full[v * 3] = d[k * 3]; full[v * 3 + 1] = d[k * 3 + 1]; full[v * 3 + 2] = d[k * 3 + 2]; }); d.length = 0; d.push(...full); }
  else t.i = bin.push(Uint16Array.from(idx));
  if (max <= 127) { t.d = bin.push(Int8Array.from(d)); t.q = 1; t.b = 8; }
  else if (max <= 127 * 4) { t.d = bin.push(Int8Array.from(d.map((x) => Math.round(x / 4)))); t.q = 4; t.b = 8; }
  else { t.d = bin.push(Int16Array.from(d)); t.q = 1; t.b = 16; }
  meta.targets[key] = t;
  return true;
}
// macro: músculo/peso só na faixa jovem; o envelhecimento usa o canto médio (aproximação aditiva)
for (const g of ['female', 'male']) {
  for (const m of ['min', 'average', 'max']) for (const w of ['min', 'average', 'max']) addTarget(`macrodetails/universal-${g}-young-${m}muscle-${w}weight`, `u-${g}-young-${m}-${w}`);
  addTarget(`macrodetails/universal-${g}-old-averagemuscle-averageweight`, `u-${g}-old-average-average`);
}
for (const r of ['african', 'asian', 'caucasian']) for (const g of ['female', 'male']) addTarget(`macrodetails/${r}-${g}-young`, `r-${r}-${g}`);
// envelhecimento: média (entre etnias) de old − young
for (const g of ['female', 'male']) {
  const acc = new Int16Array(N * 3);
  const rows = ['african', 'asian', 'caucasian'].map((r) => [rowOf(`macrodetails/${r}-${g}-old`), rowOf(`macrodetails/${r}-${g}-young`)]);
  for (let k = 0; k < N * 3; k++) {
    let s = 0;
    for (const [o, y] of rows) s += o[k] - y[k];
    acc[k] = Math.round(s / 3);
  }
  addTarget(null, `age-${g}`, acc);
}
for (const c of ['mincup', 'maxcup']) addTarget(`breast/female-young-averagemuscle-averageweight-${c}-averagefirmness`, `breast-${c}`);
const LOCAL = [
  'nose/nose-scale-horiz-decr', 'nose/nose-scale-horiz-incr', 'nose/nose-scale-vert-decr', 'nose/nose-scale-vert-incr',
  'nose/nose-scale-depth-decr', 'nose/nose-scale-depth-incr', 'nose/nose-hump-lesshump', 'nose/nose-hump-morehump',
  'nose/nose-point-width-less', 'nose/nose-point-width-more',
  'nose/nose-trans-vert-down', 'nose/nose-trans-vert-up', 'nose/nose-volume-point', 'nose/nose-volume-potato',
  'eyebrows/eyebrows-trans-vert-less', 'eyebrows/eyebrows-trans-vert-more', 'eyebrows/eyebrows-angle-down', 'eyebrows/eyebrows-angle-up',
  'eyebrows/eyebrows-trans-depth-less', 'eyebrows/eyebrows-trans-depth-more',
  'cheek/l-cheek-bones-in', 'cheek/l-cheek-bones-out', 'cheek/r-cheek-bones-in', 'cheek/r-cheek-bones-out',
  'cheek/l-cheek-volume-deflate', 'cheek/l-cheek-volume-inflate', 'cheek/r-cheek-volume-deflate', 'cheek/r-cheek-volume-inflate',
  'mouth/mouth-scale-horiz-decr', 'mouth/mouth-scale-horiz-incr', 'mouth/mouth-lowerlip-volume-deflate', 'mouth/mouth-lowerlip-volume-inflate',
  'mouth/mouth-upperlip-volume-deflate', 'mouth/mouth-upperlip-volume-inflate', 'mouth/mouth-angles-down', 'mouth/mouth-angles-up',
  'chin/chin-prominent-less', 'chin/chin-prominent-more', 'chin/chin-width-min', 'chin/chin-width-max', 'chin/chin-height-min', 'chin/chin-height-max',
  'chin/chin-bones-in', 'chin/chin-bones-out', 'chin/chin-cleft-in', 'chin/chin-cleft-out',
  'head/head-fat', 'head/head-oval', 'head/head-round', 'head/head-square', 'head/head-triangular', 'head/head-age-less', 'head/head-age-more',
  'head/head-scale-horiz-less', 'head/head-scale-horiz-more', 'head/head-scale-vert-less', 'head/head-scale-vert-more',
  'forehead/forehead-scale-vert-less', 'forehead/forehead-scale-vert-more',
  'neck/neck-scale-horiz-less', 'neck/neck-scale-horiz-more', 'neck/neck-double-less', 'neck/neck-double-more',
  'stomach/stomach-pregnant-decr', 'stomach/stomach-pregnant-incr', 'torso/torso-vshape-less', 'torso/torso-vshape-more',
  'hip/hip-scale-horiz-decr', 'hip/hip-scale-horiz-incr', 'buttocks/buttocks-volume-decr', 'buttocks/buttocks-volume-incr',
];
for (const s of ['l', 'r']) {
  for (const t of ['size-small', 'size-big', 'height2-min', 'height2-max', 'move-in', 'move-out', 'corner1-down', 'corner1-up', 'bag-min', 'bag-max']) LOCAL.push(`eyes/${s}-eye-${t}`);
  for (const t of ['size-small', 'size-big', 'flap-in', 'flap-out']) LOCAL.push(`ears/${s}-ear-${t}`);
}
for (const t of LOCAL) addTarget(t, t.split('/')[1], rowOf(t), true);

// ---------- texturas ----------
async function tex(src, name, { gray = false, size = 512, normal = false, q = 80, alphaBoost = 1, contrast = 1 } = {}) {
  const out = path.join(OUT, 't', `${name}.webp`);
  let img = sharp(src);
  const md = await img.metadata();
  const w = Math.min(size, md.width);
  if (gray) {
    // cabelos/pelos: luminância normalizada (média ≈ 0,5) + alfa; a cor vem do material
    const { data, info } = await sharp(src).ensureAlpha().resize(w, w).raw().toBuffer({ resolveWithObject: true });
    let sum = 0, cnt = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) { sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; cnt++; }
    const mean = sum / Math.max(1, cnt) || 1;
    for (let i = 0; i < data.length; i += 4) {
      const L = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      const g = Math.max(0, Math.min(255, 128 * (1 + (L / mean - 1) * contrast)));
      data[i] = data[i + 1] = data[i + 2] = g;
      data[i + 3] = Math.min(255, data[i + 3] * alphaBoost);
    }
    await sharp(data, { raw: info }).webp({ quality: q, alphaQuality: 90 }).toFile(out);
  } else {
    img = img.resize(w, w);
    await img.webp({ quality: normal ? 90 : q }).toFile(out);
  }
  return `t/${name}.webp`;
}

// ---------- proxies ----------
const PROXIES = {
  hair: ['short01', 'short02', 'short03', 'short04', 'bob01', 'bob02', 'long01', 'ponytail01', 'afro01', 'Braid01', 'curly', 'Wig_bun_blonde'],
  beard: ['Full_beard', 'Moustache'],
  eyebrows: ['eyebrow001', 'eyebrow003', 'eyebrow006', 'eyebrow009', 'eyebrow010', 'eyebrow012'],
  eyelashes: ['Eyelashes01'],
  eyes: ['HighPolyEyes'],
  teeth: ['Teeth_Base'],
  tongue: ['tongue01'],
  clothes: [
    'male_casualsuit01', 'male_casualsuit02', 'male_casualsuit03', 'male_casualsuit04', 'male_casualsuit05', 'male_casualsuit06',
    'male_elegantsuit01', 'male_worksuit01', 'female_casualsuit01', 'female_casualsuit02', 'female_elegantsuit01', 'female_sportsuit01',
    'VNeckTop', 'Sleeveless', 'Tank_Top_01', 'short_tail_camo_tee', 'spaghetti-top',
    'Tightjeans', 'ShortJeans', 'JeansSkirt', 'miniskirt',
    'F_Dress_01', 'F_Dress_02', 'F_Dress_03', 'F_Dress_04', 'Cocktaildress', 'TubeDress', 'Coat',
    'shoes01', 'shoes02', 'shoes03', 'shoes04', 'shoes05', 'shoes06', 'WinterBoots', 'fedora', 'glasses',
  ],
};
const GRAY = new Set(['hair', 'beard', 'eyebrows', 'eyelashes']);
const BIG = { ponytail01: 'ponytail01_diffuse.png', female_casualsuit01: 'female_casualsuit01_diffuse.png' };
meta.proxies = {};
let total = 0;
for (const [kind, names] of Object.entries(PROXIES)) {
  for (const name of names) {
    const dir = path.join(PUB, 'proxies', kind === 'beard' ? 'hair' : kind, name);
    const file = fs.readdirSync(dir).find((f) => f.endsWith('.json'));
    const p = readJSON(path.join(dir, file));
    const md = p.metadata;
    const P = md.ref_vIdxs.length;
    const pf = parseFaces(p);
    const mesh = splitMesh(pf, p.uvs[0]);
    const pb = new Bin();
    const S = {};
    S.ref = pb.push(Uint16Array.from(md.ref_vIdxs.flat()));
    S.w = pb.push(Float32Array.from(md.weights.flat()));
    S.off = pb.push(Float32Array.from(md.offsets.flat().map((x) => x * SC)));
    S.orig = pb.push(Uint16Array.from(mesh.orig));
    S.uv = pb.push(Float32Array.from(mesh.uv));
    S.tris = pb.push(mesh.orig.length > 65535 ? Uint32Array.from(mesh.tris) : Uint16Array.from(mesh.tris));
    // pesos herdados do corpo (combinação dos 3 vértices de referência)
    const pw = md.ref_vIdxs.map((r, i) => {
      const acc = new Map();
      r.forEach((v, k) => { const wk = Math.max(0, md.weights[i][k]); for (const [b, w] of vWeights[v]) acc.set(b, (acc.get(b) || 0) + w * wk); });
      return acc;
    });
    const pk = packWeights(pw);
    S.skinI = pb.push(pk.I); S.skinW = pb.push(pk.W);
    const del = []; (md.deleteVerts || []).forEach((d, v) => { if (d) del.push(v); });
    S.del = pb.push(Uint16Array.from(del));
    const size = pb.save(path.join(OUT, 'p', `${name}.bin`));
    total += size;
    // texturas
    const mat = p.materials[0] || {};
    const texDir = dir;
    let map = null, normalMap = null, maps = null;
    if (kind === 'eyes') {
      maps = {};
      for (const m of p.materials) { const c = path.basename(m.mapDiffuse).replace('_eye.png', ''); maps[c] = await tex(path.join(texDir, m.mapDiffuse), `eye-${c}`, { size: 256 }); }
    } else if (mat.mapDiffuse) {
      const big = BIG[name] && EXTRA && path.join(EXTRA, BIG[name]);
      const src = big && fs.existsSync(big) ? big : path.join(texDir, mat.mapDiffuse);
      map = await tex(src, name, { gray: GRAY.has(kind), size: big ? 1024 : 512, alphaBoost: kind === 'eyebrows' ? 2.2 : kind === 'beard' ? 1.4 : 1, contrast: kind === 'hair' ? 0.6 : 1 });
      if (mat.mapNormal) normalMap = await tex(path.join(texDir, mat.mapNormal), `${name}-n`, { normal: true, size: 512 });
    }
    meta.proxies[name] = {
      kind, P, M: mesh.orig.length, T: mesh.tris.length / 3, z: md.z_depth ?? 50, S, map, normalMap, maps,
      tags: md.tags || [], alpha: !!mat.transparent,
    };
    console.log(kind, name, P, mesh.orig.length, (size / 1024).toFixed(0) + 'KB', 'del', del.length);
  }
}

// pele
const skinSrc = EXTRA && fs.existsSync(path.join(EXTRA, 'young_lightskinned_female_diffuse2.png'))
  ? path.join(EXTRA, 'young_lightskinned_female_diffuse2.png')
  : path.join(PUB, 'skins/young_caucasian_female/textures/young_lightskinned_female_diffuse.png');
meta.skin = await tex(skinSrc, 'skin', { size: 2048, q: 82 });
meta.skinSmall = await tex(skinSrc, 'skin-1k', { size: 1024, q: 80 });

// detalhe da pele (poros/rugas): normal map a partir do passa-alta da luminância
{
  const S = 1024;
  const { data } = await sharp(skinSrc).resize(S, S).greyscale().raw().toBuffer({ resolveWithObject: true });
  const blur = (await sharp(skinSrc).resize(S, S).greyscale().blur(6).raw().toBuffer());
  const H = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) H[i] = (data[i] - blur[i]) / 255;
  const out = Buffer.alloc(S * S * 3);
  const at = (x, y) => H[Math.min(S - 1, Math.max(0, y)) * S + Math.min(S - 1, Math.max(0, x))];
  const k = 5.5;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k;
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const o = (y * S + x) * 3; out[o] = (nx * 0.5 + 0.5) * 255; out[o + 1] = (ny * 0.5 + 0.5) * 255; out[o + 2] = (nz * 0.5 + 0.5) * 255;
  }
  await sharp(out, { raw: { width: S, height: S, channels: 3 } }).webp({ quality: 88 }).toFile(path.join(OUT, 't', 'skin-n.webp'));
  meta.skinNormal = 't/skin-n.webp';
}
// máscara dos lábios (para o batom): pixels avermelhados na região da boca
{
  const S = 512;
  const { data } = await sharp(skinSrc).resize(S, S).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = Buffer.alloc(S * S);
  const box = { x0: 0.84, x1: 0.97, y0: 0.44, y1: 0.58 };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    if (u < box.x0 || u > box.x1 || v < box.y0 || v > box.y1) continue;
    const i = (y * S + x) * 3; const r = data[i], g = data[i + 1], b = data[i + 2];
    const red = (r - g) / Math.max(1, r);
    m[y * S + x] = Math.max(0, Math.min(255, (red - 0.3) * 255 * 4));
  }
  await sharp(m, { raw: { width: S, height: S, channels: 1 } }).blur(1.2).webp({ quality: 90 }).toFile(path.join(OUT, 't', 'lips.webp'));
  meta.lipsMask = 't/lips.webp';
}

const size = bin.save(path.join(OUT, 'human.bin'));
fs.writeFileSync(path.join(OUT, 'human.json'), JSON.stringify(meta));
console.log('human.bin', (size / 1024).toFixed(0) + 'KB', 'targets', Object.keys(meta.targets).length, 'proxies total', (total / 1024).toFixed(0) + 'KB', 'body verts', body.orig.length, 'tris', body.tris.length / 3, 'bones', bones.length);

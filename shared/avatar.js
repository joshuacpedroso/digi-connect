// Criador de personagem (estilo GTA): opções, sliders e validação.
// Usado pelo cliente (src/three/human.js, customizador) e pelo servidor (lib/actions.js).

export const SEX = { F: 0, M: 1 };

// Cabelos, barbas e sobrancelhas (proxies do MakeHuman em public/mh/p/)
export const HAIR = [
  { id: 'none', label: 'Raspado' },
  { id: 'short02', label: 'Curto social' },
  { id: 'short01', label: 'Curto bagunçado' },
  { id: 'short03', label: 'Topete' },
  { id: 'short04', label: 'Militar' },
  { id: 'afro01', label: 'Black power' },
  { id: 'bob02', label: 'Chanel' },
  { id: 'bob01', label: 'Chanel longo' },
  { id: 'long01', label: 'Longo liso' },
  { id: 'ponytail01', label: 'Rabo de cavalo' },
  { id: 'Braid01', label: 'Trança' },
  { id: 'curly', label: 'Cacheado' },
  { id: 'Wig_bun_blonde', label: 'Coque' },
];
export const BEARD = [
  { id: 'none', label: 'Sem barba' },
  { id: 'Full_beard', label: 'Barba cheia' },
  { id: 'Moustache', label: 'Bigode' },
];
export const BROWS = [
  { id: 'eyebrow001', label: 'Natural' },
  { id: 'eyebrow003', label: 'Arqueada' },
  { id: 'eyebrow006', label: 'Fina' },
  { id: 'eyebrow009', label: 'Grossa' },
  { id: 'eyebrow010', label: 'Reta' },
  { id: 'eyebrow012', label: 'Marcante' },
];
export const EYES = [
  { id: 'brown', label: 'Castanho', color: '#5a3a22' },
  { id: 'brownlight', label: 'Mel', color: '#9a6a32' },
  { id: 'green', label: 'Verde', color: '#5f7d45' },
  { id: 'bluegreen', label: 'Azul-esverdeado', color: '#4f7f80' },
  { id: 'blue', label: 'Azul', color: '#3f6aa0' },
  { id: 'lightblue', label: 'Azul claro', color: '#7da3c8' },
  { id: 'deepblue', label: 'Azul escuro', color: '#2a4a86' },
  { id: 'grey', label: 'Cinza', color: '#7d8590' },
  { id: 'ice', label: 'Gelo', color: '#b9cbd6' },
];

// Roupas. `full`: cobre o corpo todo (conjunto/vestido); sem `full`, precisa de uma peça de baixo.
export const TOPS = [
  { id: 'male_casualsuit01', label: 'Camisa + jeans', full: true },
  { id: 'male_casualsuit02', label: 'Camiseta + jeans', full: true },
  { id: 'male_casualsuit03', label: 'Camisa listrada', full: true },
  { id: 'male_casualsuit04', label: 'Camiseta logo', full: true },
  { id: 'male_casualsuit05', label: 'Jaqueta + jeans', full: true },
  { id: 'male_casualsuit06', label: 'Camiseta branca', full: true },
  { id: 'male_elegantsuit01', label: 'Terno', full: true },
  { id: 'male_worksuit01', label: 'Macacão', full: true },
  { id: 'female_casualsuit01', label: 'Básico jeans', full: true },
  { id: 'female_casualsuit02', label: 'Camiseta + short', full: true },
  { id: 'female_elegantsuit01', label: 'Social com saia', full: true },
  { id: 'female_sportsuit01', label: 'Esportivo', full: true },
  { id: 'F_Dress_01', label: 'Vestido vinho', full: true },
  { id: 'F_Dress_02', label: 'Vestido verde', full: true },
  { id: 'F_Dress_04', label: 'Vestido preto', full: true },
  { id: 'Cocktaildress', label: 'Vestido de festa', full: true },
  { id: 'TubeDress', label: 'Vestido tubinho', full: true },
  { id: 'VNeckTop', label: 'Blusa decote V' },
  { id: 'Sleeveless', label: 'Camisa sem manga' },
  { id: 'Tank_Top_01', label: 'Regata' },
  { id: 'short_tail_camo_tee', label: 'Camiseta camuflada' },
  { id: 'spaghetti-top', label: 'Blusa de alcinha' },
  { id: 'Coat', label: 'Casaco longo' },
];
export const BOTTOMS = [
  { id: 'Tightjeans', label: 'Calça jeans' },
  { id: 'ShortJeans', label: 'Short jeans' },
  { id: 'JeansSkirt', label: 'Saia jeans' },
  { id: 'miniskirt', label: 'Saia preta' },
];
export const SHOES = [
  { id: 'shoes03', label: 'Social preto' },
  { id: 'shoes01', label: 'Social marrom' },
  { id: 'shoes05', label: 'Tênis branco' },
  { id: 'shoes06', label: 'Tênis azul' },
  { id: 'shoes02', label: 'Tênis surrado' },
  { id: 'WinterBoots', label: 'Bota' },
];
export const HATS = [
  { id: 'none', label: 'Nada' },
  { id: 'fedora', label: 'Chapéu' },
];
export const ACCESSORIES = [
  { id: 'none', label: 'Nenhum' },
  { id: 'glasses', label: 'Óculos' },
  { id: 'sunglasses', label: 'Óculos escuros' },
  { id: 'headphones', label: 'Headphone' },
];

export const SKIN_TONES = ['#f6dccb', '#efc9ae', '#e2b293', '#d39c78', '#c08560', '#a86d48', '#8d5634', '#6f4026', '#55301c', '#3d2214'];
export const HAIR_COLORS = ['#0f0c0b', '#2b1d16', '#4a2f1f', '#6b4428', '#8d5f37', '#b48650', '#d8b47a', '#e8d2a6', '#9b3f22', '#c25a2b', '#8a8a8a', '#e6e6e6', '#3d5bd6', '#d6488a'];
export const LIP_COLORS = ['none', '#b5555e', '#c2185b', '#8e1b2e', '#e07a6a', '#7a3d5c'];

// Sliders: valor de -1 a 1 (ou 0 a 1 quando só há um lado). Cada lado aponta para alvos do MakeHuman.
const LR = (n) => [`l-${n}`, `r-${n}`];
export const FACE = [
  { group: 'Rosto', items: [
    { k: 'faceW', label: 'Largura do rosto', neg: 'head-scale-horiz-less', pos: 'head-scale-horiz-more' },
    { k: 'faceH', label: 'Comprimento do rosto', neg: 'head-scale-vert-less', pos: 'head-scale-vert-more' },
    { k: 'faceFat', label: 'Rosto cheio', pos: 'head-fat', one: true },
    { k: 'forehead', label: 'Testa', neg: 'forehead-scale-vert-less', pos: 'forehead-scale-vert-more' },
    { k: 'cheekBones', label: 'Maçãs do rosto', neg: LR('cheek-bones-in'), pos: LR('cheek-bones-out') },
    { k: 'cheeks', label: 'Bochechas', neg: LR('cheek-volume-deflate'), pos: LR('cheek-volume-inflate') },
  ] },
  { group: 'Olhos e sobrancelhas', items: [
    { k: 'eyeSize', label: 'Tamanho dos olhos', neg: LR('eye-size-small'), pos: LR('eye-size-big') },
    { k: 'eyeOpen', label: 'Abertura dos olhos', neg: LR('eye-height2-min'), pos: LR('eye-height2-max') },
    { k: 'eyeDist', label: 'Distância dos olhos', neg: LR('eye-move-in'), pos: LR('eye-move-out') },
    { k: 'eyeTilt', label: 'Inclinação dos olhos', neg: LR('eye-corner1-down'), pos: LR('eye-corner1-up') },
    { k: 'eyeBags', label: 'Olheiras', neg: LR('eye-bag-min'), pos: LR('eye-bag-max') },
    { k: 'browH', label: 'Altura da sobrancelha', neg: 'eyebrows-trans-vert-less', pos: 'eyebrows-trans-vert-more' },
    { k: 'browA', label: 'Ângulo da sobrancelha', neg: 'eyebrows-angle-down', pos: 'eyebrows-angle-up' },
    { k: 'browD', label: 'Projeção da testa', neg: 'eyebrows-trans-depth-less', pos: 'eyebrows-trans-depth-more' },
  ] },
  { group: 'Nariz', items: [
    { k: 'noseW', label: 'Largura', neg: 'nose-scale-horiz-decr', pos: 'nose-scale-horiz-incr' },
    { k: 'noseH', label: 'Comprimento', neg: 'nose-scale-vert-decr', pos: 'nose-scale-vert-incr' },
    { k: 'noseD', label: 'Projeção', neg: 'nose-scale-depth-decr', pos: 'nose-scale-depth-incr' },
    { k: 'noseHump', label: 'Ponte', neg: 'nose-hump-lesshump', pos: 'nose-hump-morehump' },
    { k: 'noseTip', label: 'Ponta', neg: 'nose-point-width-less', pos: 'nose-point-width-more' },
    { k: 'noseY', label: 'Altura', neg: 'nose-trans-vert-down', pos: 'nose-trans-vert-up' },
    { k: 'noseShape', label: 'Formato', neg: 'nose-volume-point', pos: 'nose-volume-potato' },
  ] },
  { group: 'Boca e queixo', items: [
    { k: 'mouthW', label: 'Largura da boca', neg: 'mouth-scale-horiz-decr', pos: 'mouth-scale-horiz-incr' },
    { k: 'lips', label: 'Lábios', neg: ['mouth-upperlip-volume-deflate', 'mouth-lowerlip-volume-deflate'], pos: ['mouth-upperlip-volume-inflate', 'mouth-lowerlip-volume-inflate'] },
    { k: 'mouthCorners', label: 'Cantos da boca', neg: 'mouth-angles-down', pos: 'mouth-angles-up' },
    { k: 'jaw', label: 'Mandíbula', neg: 'chin-bones-in', pos: 'chin-bones-out' },
    { k: 'chinP', label: 'Queixo (projeção)', neg: 'chin-prominent-less', pos: 'chin-prominent-more' },
    { k: 'chinW', label: 'Queixo (largura)', neg: 'chin-width-min', pos: 'chin-width-max' },
    { k: 'chinH', label: 'Queixo (altura)', neg: 'chin-height-min', pos: 'chin-height-max' },
    { k: 'chinCleft', label: 'Furinho no queixo', pos: 'chin-cleft-in', one: true },
  ] },
  { group: 'Orelhas e pescoço', items: [
    { k: 'ears', label: 'Orelhas', neg: LR('ear-size-small'), pos: LR('ear-size-big') },
    { k: 'earsOut', label: 'Orelha de abano', pos: LR('ear-flap-out'), one: true },
    { k: 'neck', label: 'Pescoço', neg: 'neck-scale-horiz-less', pos: 'neck-scale-horiz-more' },
    { k: 'neckDouble', label: 'Papada', pos: 'neck-double-more', one: true },
  ] },
];
export const FACE_SHAPES = [
  { id: 'natural', label: 'Natural' }, { id: 'head-oval', label: 'Oval' }, { id: 'head-round', label: 'Redondo' },
  { id: 'head-square', label: 'Quadrado' }, { id: 'head-triangular', label: 'Triangular' },
];
export const BODY = [
  { k: 'age', label: 'Idade', min: 0, max: 1 },
  { k: 'weight', label: 'Peso', min: 0, max: 1 },
  { k: 'muscle', label: 'Músculos', min: 0, max: 1 },
  { k: 'height', label: 'Altura', min: 0, max: 1 },
  { k: 'breast', label: 'Busto', min: 0, max: 1, female: true },
  { k: 'belly', label: 'Barriga', neg: 'stomach-pregnant-decr', pos: 'stomach-pregnant-incr' },
  { k: 'shoulders', label: 'Ombros (V)', neg: 'torso-vshape-less', pos: 'torso-vshape-more' },
  { k: 'hips', label: 'Quadril', neg: 'hip-scale-horiz-decr', pos: 'hip-scale-horiz-incr' },
  { k: 'glutes', label: 'Glúteos', neg: 'buttocks-volume-decr', pos: 'buttocks-volume-incr' },
];
export const MACRO_KEYS = ['sex', 'age', 'weight', 'muscle', 'height', 'breast'];
export const SHAPE_SLIDERS = [...FACE.flatMap((g) => g.items), ...BODY.filter((b) => b.pos)];
const SLIDER_KEYS = new Set(SHAPE_SLIDERS.map((s) => s.k));

// Pesos dos alvos (morph targets) para uma configuração.
export function targetWeights(a) {
  const W = new Map();
  const add = (k, w) => { if (w) W.set(k, (W.get(k) || 0) + w); };
  const g = a.sex, gw = { female: 1 - g, male: g };
  const tri = (v) => ({ min: Math.max(0, 1 - v * 2), max: Math.max(0, v * 2 - 1), average: 1 - Math.max(0, 1 - v * 2) - Math.max(0, v * 2 - 1) });
  const mw = tri(a.muscle), ww = tri(a.weight);
  const old = a.age * 0.7; // 25 → ~70 anos
  for (const s of ['female', 'male']) {
    if (!gw[s]) continue;
    for (const m of ['min', 'average', 'max']) for (const w of ['min', 'average', 'max']) add(`u-${s}-young-${m}-${w}`, gw[s] * mw[m] * ww[w]);
    add(`age-${s}`, gw[s] * old);
    const anc = a.anc;
    add(`r-african-${s}`, gw[s] * anc[0]);
    add(`r-asian-${s}`, gw[s] * anc[1]);
    add(`r-caucasian-${s}`, gw[s] * anc[2]);
  }
  if (a.breast < 0.5) add('breast-mincup', (1 - g) * (0.5 - a.breast) * 2);
  else add('breast-maxcup', (1 - g) * (a.breast - 0.5) * 2);
  add('head-age-more', a.age * 0.8);
  if (a.shape && a.shape !== 'natural') add(a.shape, 0.7);
  for (const s of SHAPE_SLIDERS) {
    const v = a.face?.[s.k] ?? 0;
    if (!v) continue;
    const list = [].concat(v > 0 ? s.pos : s.neg || []);
    for (const t of list) add(t, Math.abs(v));
  }
  return W;
}

// ---------- configuração padrão, aleatória e validação ----------
function rng(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
const ids = (list) => list.map((x) => x.id);

export function randomAvatar(seed = Math.random().toString(), sexHint) {
  const r = rng(seed);
  const male = sexHint != null ? sexHint >= 0.5 : r() < 0.5;
  const anc = [r() ** 2, r() ** 2, r() ** 1.5];
  const t = anc.reduce((s, x) => s + x, 0) || 1;
  const skinIdx = Math.min(SKIN_TONES.length - 1, Math.floor((anc[0] / t) * 7 + r() * 3));
  const face = {};
  for (const s of SHAPE_SLIDERS) face[s.k] = Math.round((r() - 0.5) * (s.one ? 0.5 : 0.55) * 100) / 100;
  for (const s of SHAPE_SLIDERS) if (s.one) face[s.k] = Math.max(0, face[s.k]);
  const top = male
    ? pick(r, ['male_casualsuit01', 'male_casualsuit02', 'male_casualsuit03', 'male_casualsuit05', 'male_casualsuit06', 'male_elegantsuit01'])
    : pick(r, ['female_casualsuit01', 'female_elegantsuit01', 'F_Dress_01', 'F_Dress_04', 'VNeckTop', 'Sleeveless', 'female_casualsuit02']);
  return sanitizeAvatar({
    v: 2,
    sex: male ? 1 : 0,
    age: Math.round(r() * r() * 70) / 100,
    weight: Math.round((0.3 + r() * 0.45) * 100) / 100,
    muscle: Math.round((0.3 + r() * 0.45) * 100) / 100,
    height: Math.round((0.3 + r() * 0.4) * 100) / 100,
    breast: Math.round((0.35 + r() * 0.4) * 100) / 100,
    anc: anc.map((x) => Math.round((x / t) * 100) / 100),
    shape: pick(r, ids(FACE_SHAPES)),
    face,
    skin: SKIN_TONES[skinIdx],
    eyes: pick(r, skinIdx > 5 ? ['brown', 'brown', 'brownlight'] : ids(EYES)),
    hair: male ? pick(r, ['short02', 'short01', 'short03', 'short04', 'afro01', 'none']) : pick(r, ['bob02', 'bob01', 'long01', 'ponytail01', 'Braid01', 'curly', 'Wig_bun_blonde']),
    hairColor: pick(r, skinIdx > 4 ? HAIR_COLORS.slice(0, 3) : HAIR_COLORS.slice(0, 8)),
    brows: male ? pick(r, ['eyebrow001', 'eyebrow009', 'eyebrow012', 'eyebrow010']) : pick(r, ['eyebrow003', 'eyebrow006', 'eyebrow001']),
    beard: male && r() < 0.35 ? pick(r, ['Full_beard', 'Moustache']) : 'none',
    top,
    bottom: pick(r, male ? ['Tightjeans'] : ['Tightjeans', 'JeansSkirt', 'miniskirt']),
    shoes: male ? pick(r, ['shoes03', 'shoes01', 'shoes05', 'shoes06']) : pick(r, ['shoes03', 'shoes05', 'shoes06']),
    hat: 'none',
    acc: r() < 0.2 ? pick(r, ['glasses', 'headphones']) : 'none',
    lips: !male && r() < 0.5 ? pick(r, LIP_COLORS.slice(1)) : 'none',
  }, seed);
}

const num = (v, d, lo = 0, hi = 1) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v)) * 100) / 100 : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);

export function sanitizeAvatar(input, seed) {
  if (!input || typeof input !== 'object' || input.v !== 2) {
    // configuração antiga (personagens Rocketbox) ou vazia → novo personagem determinístico
    const hint = typeof input?.character === 'string' ? (/female/i.test(input.character) ? 0 : 1) : undefined;
    return randomAvatar(seed || JSON.stringify(input || {}), hint);
  }
  const anc = Array.isArray(input.anc) && input.anc.length === 3 ? input.anc.map((x) => num(x, 1 / 3)) : [0.33, 0.33, 0.34];
  const t = anc.reduce((s, x) => s + x, 0) || 1;
  const face = {};
  for (const s of SHAPE_SLIDERS) face[s.k] = num(input.face?.[s.k], 0, s.one ? 0 : -1, 1);
  const top = oneOf(input.top, ids(TOPS), 'male_casualsuit02');
  const full = TOPS.find((x) => x.id === top)?.full;
  return {
    v: 2,
    sex: num(input.sex, 0.5),
    age: num(input.age, 0.15),
    weight: num(input.weight, 0.5),
    muscle: num(input.muscle, 0.5),
    height: num(input.height, 0.5),
    breast: num(input.breast, 0.5),
    anc: anc.map((x) => Math.round((x / t) * 100) / 100),
    shape: oneOf(input.shape, ids(FACE_SHAPES), 'natural'),
    face,
    skin: hex(input.skin, SKIN_TONES[2]),
    eyes: oneOf(input.eyes, ids(EYES), 'brown'),
    hair: oneOf(input.hair, ids(HAIR), 'short02'),
    hairColor: hex(input.hairColor, HAIR_COLORS[1]),
    brows: oneOf(input.brows, ids(BROWS), 'eyebrow001'),
    beard: oneOf(input.beard, ids(BEARD), 'none'),
    top,
    bottom: full ? null : oneOf(input.bottom, ids(BOTTOMS), 'Tightjeans'),
    shoes: oneOf(input.shoes, ids(SHOES), 'shoes03'),
    hat: oneOf(input.hat, ids(HATS), 'none'),
    acc: oneOf(input.acc, ids(ACCESSORIES), 'none'),
    lips: input.lips === 'none' ? 'none' : oneOf(hex(input.lips, 'none'), LIP_COLORS, 'none'),
  };
}

export const isValidKey = (k) => SLIDER_KEYS.has(k);

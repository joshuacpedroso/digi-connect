// Planta do escritório — compartilhada entre o servidor e o cliente.
// Unidades em metros. Eixo X: oeste(-) → leste(+). Eixo Z: norte(-) → sul(+).
// A câmera isométrica olha de sudeste, então as paredes norte e oeste ficam ao fundo.
// A ESTRUTURA (paredes, salas fixas) é fixa; os MÓVEIS são itens editáveis no editor.
import { CATALOG, itemSeats } from './catalog.js';

export const WORLD = { minX: -18, maxX: 18, minZ: -12, maxZ: 12 };

// Salas fixas (estrutura). Zonas privadas isolam o áudio: só quem está dentro se escuta.
export const ROOMS = [
  { id: 'valdinei', label: 'Sala do Valdinei', private: true, x0: 4.5, x1: 11, z0: -12, z1: -6.5, floor: '#3b4a6b', sign: { x: 7.75, z: -6.5 } },
  { id: 'fran', label: 'Sala da Fran', private: true, x0: 11, x1: 18, z0: -12, z1: -6.5, floor: '#6b3b55', sign: { x: 14.5, z: -6.5 } },
  { id: 'meeting', label: 'Sala de Reunião', private: true, x0: 10.5, x1: 18, z0: -3.5, z1: 3.5, floor: '#34436a', sign: { x: 14.25, z: 3.5 } },
  { id: 'booth1', label: 'Cabine de Foco 1', private: true, x0: -1, x1: 1.75, z0: -12, z1: -9.2, floor: '#8f84c9' },
  { id: 'booth2', label: 'Cabine de Foco 2', private: true, x0: 1.75, x1: 4.5, z0: -12, z1: -9.2, floor: '#8f84c9' },
];

// Paredes de vidro (segmentos [x0, z0, x1, z1]); os vãos são as portas.
export const GLASS = [
  // cabines
  [-1, -9.2, -0.1, -9.2], [0.85, -9.2, 1.75, -9.2], [1.75, -9.2, 2.65, -9.2], [3.6, -9.2, 4.5, -9.2],
  // Valdinei
  [4.5, -9.2, 4.5, -6.5], [4.5, -6.5, 9.2, -6.5], [10.4, -6.5, 11, -6.5],
  // Fran
  [11, -12, 11, -6.5], [11, -6.5, 11.6, -6.5], [12.8, -6.5, 18, -6.5], [18, -12, 18, -6.5],
  // reunião
  [10.5, -3.5, 18, -3.5], [10.5, 3.5, 18, 3.5], [10.5, -3.5, 10.5, -0.65], [10.5, 0.65, 10.5, 3.5], [18, -3.5, 18, 3.5],
];
// Divisórias sólidas (acústicas) entre as cabines.
export const PARTITIONS = [[-1, -12, -1, -9.2], [1.75, -12, 1.75, -9.2], [4.5, -12, 4.5, -9.2]];

export const ZONES = [
  ...ROOMS,
  { id: 'work', label: 'Área de Trabalho', private: false, x0: -18, x1: -1.5, z0: -12, z1: 3.5 },
  { id: 'cafe', label: 'Café & Conexões', private: false, x0: -18, x1: -8, z0: 5, z1: 12 },
  { id: 'lounge', label: 'Lounge', private: false, x0: 8, x1: 18, z0: 5, z1: 12 },
  { id: 'reception', label: 'Recepção', private: false, x0: -4, x1: 7, z0: 5.5, z1: 12 },
  { id: 'games', label: 'Área de Jogos', private: false, x0: -1.5, x1: 10.5, z0: -5.5, z1: 4.5 },
];

export function zoneAt(x, z) {
  for (const zone of ZONES) if (x >= zone.x0 && x < zone.x1 && z >= zone.z0 && z < zone.z1) return zone;
  return { id: 'hall', label: 'Corredor', private: false };
}

export const SPAWN = { x: 1, z: 6.4 };
export const DESK = { w: 1.5, d: 0.8, h: 0.62 };
export const POD_COLORS = { 'Operações': '#2f7bff', 'Criação': '#ff7a6b', 'Tech': '#1fb59f', 'Comercial': '#f2a93b' };

// ------------------------------------------------------------------ layout padrão (editável)
export function defaultLayout() {
  const items = [];
  let n = 0;
  const add = (type, x, z, rot = 0, extra = {}) => { items.push({ id: extra.id || `${type}-${++n}`, type, x: +x.toFixed(3), z: +z.toFixed(3), rot: +rot.toFixed(4), ...extra }); };
  const PI = Math.PI;

  // ilhas de trabalho (as 16 mesas mantêm os ids desk-01…desk-16)
  const pods = [
    { cx: -14, cz: -7.4, team: 'Operações' }, { cx: -7.4, cz: -7.4, team: 'Criação' },
    { cx: -14, cz: -1.4, team: 'Tech' }, { cx: -7.4, cz: -1.4, team: 'Comercial' },
  ];
  pods.forEach((p, pi) => {
    add('rug_rect', p.cx, p.cz, 0, { color: POD_COLORS[p.team] });
    [-1, 1].forEach((side, si) => [-1, 1].forEach((col, ci) => {
      const id = `desk-${String(pi * 4 + si * 2 + ci + 1).padStart(2, '0')}`;
      add('desk', p.cx + col * 0.77, p.cz + side * 0.41, side < 0 ? 0 : PI, { id, team: p.team, color: POD_COLORS[p.team] });
    }));
    add('divider', p.cx, p.cz, 0, { color: POD_COLORS[p.team] });
    add('pendant', p.cx - 0.77, p.cz); add('pendant', p.cx + 0.77, p.cz);
  });
  add('whiteboard', -2.1, -4.4, -PI / 2);
  add('printer', -3.4, -11.55, 0);
  add('water_cooler', -17.5, -4.4, PI / 2);
  add('bookshelf', -17.75, -0.2, PI / 2);
  add('plant_tall', -17.35, -11.4); add('plant', -2.0, -11.45); add('plant', -17.4, 3.0); add('plant_tall', -2.2, 2.9);

  // cabines de foco
  [0.375, 3.125].forEach((x, i) => {
    add('table_booth', x, -11.6, 0);
    add('chair_office', x, -10.65, PI, { color: i ? '#7c5cff' : '#1fb59f' });
  });

  // Sala do Valdinei e Sala da Fran
  [[7.75, 'desk-valdinei', '#2f7bff'], [14.5, 'desk-fran', '#ff7a6b']].forEach(([cx, id, color], i) => {
    add('rug_round', cx, -9.4, 0, { color: i ? '#f3d6e0' : '#d8e4f5' });
    add('desk_exec', cx, -10.6, 0, { id });
    add('chair_guest', cx - 0.6, -9.05, PI, { color });
    add('chair_guest', cx + 0.6, -9.05, PI, { color });
    add('bookshelf', i ? 16.9 : 5.6, -11.75, 0);
    add('plant_tall', i ? 11.55 : 10.45, -11.45);
    add('sofa_small', i ? 17.35 : 5.15, -8.4, i ? -PI / 2 : PI / 2, { color });
    add('lamp_floor', i ? 17.45 : 5.05, -7.05);
  });

  // sala de reunião
  add('table_meeting', 14.4, 0, 0);
  [13, 14.4, 15.8].forEach((x) => { add('chair_office', x, -1.45, 0, { color: '#e9ecf2' }); add('chair_office', x, 1.45, PI, { color: '#e9ecf2' }); });
  add('chair_office', 11.2, 0, PI / 2, { color: '#e9ecf2' });
  add('chair_office', 17.55, 0, -PI / 2, { color: '#e9ecf2' });
  add('tv', 14.4, -3.15, 0);
  add('plant', 11.0, 3.0); add('plant_tall', 17.5, 3.0);

  // área de jogos
  add('rug_rect', 4.4, -0.6, 0, { color: '#7c5cff' });
  add('pingpong', 4.4, -1.2, 0);
  add('foosball', 8.3, 2.2, PI / 2);
  add('arcade', 0.0, -4.85, 0); add('arcade', 1.0, -4.85, 0);
  add('beanbag', 1.0, 2.6, PI * 0.8, { color: '#f2a93b' }); add('beanbag', 2.2, 3.2, PI, { color: '#1fb59f' });
  add('plant_tall', 9.9, -4.9); add('tree_indoor', -0.6, 3.6);
  add('vending', 7.2, -5.0, 0);

  // café
  add('kitchen', -17.6, 8.6, PI / 2);
  add('fridge', -17.45, 11.45, PI / 2);
  add('bar_counter', -15.95, 8.2, PI / 2);
  [6.6, 8.2, 9.8].forEach((z) => add('stool', -15.1, z, -PI / 2, { color: '#f2a93b' }));
  [[-11.5, 7.2], [-9, 10]].forEach(([x, z]) => {
    add('table_round', x, z);
    add('chair_wood', x - 0.95, z, PI / 2, { color: '#ff7a6b' });
    add('chair_wood', x + 0.95, z, -PI / 2, { color: '#ff7a6b' });
  });
  add('plant_tall', -8.4, 11.4); add('plant', -12.8, 11.45); add('pendant', -15.95, 7.1); add('pendant', -15.95, 9.3);

  // recepção
  add('welcome_mat', 1, 6.7, 0);
  add('reception', 1, 9.4, 0);
  add('plant_tall', -1.5, 9.4); add('plant_tall', 3.5, 9.4);
  add('bench', -3.2, 11.3, PI);

  // lounge
  add('rug_round', 13, 7.9, 0, { color: '#f3e4cf' });
  add('sofa', 13, 5.95, 0, { color: '#2a7f7a' });
  add('table_coffee', 13, 7.85, 0);
  add('armchair', 11.2, 9.85, PI, { color: '#ff7a6b' });
  add('armchair', 14.8, 9.85, PI, { color: '#f2a93b' });
  add('lamp_floor', 15.9, 5.6);
  add('cabinet_low', 17.6, 8.6, -PI / 2);
  add('beanbag', 16.8, 11.0, PI, { color: '#7c5cff' }); add('beanbag', 9.2, 11.1, PI, { color: '#1fb59f' });
  add('plant_tall', 8.6, 5.6); add('plant', 17.5, 5.5); add('plant_tall', 17.45, 11.45);
  return items;
}

export function seatsOf(items) {
  return items.flatMap(itemSeats);
}

export function desksOf(items) {
  let i = 0;
  return items.filter((it) => CATALOG[it.type]?.desk).map((it) => {
    i++;
    const label = it.id === 'desk-valdinei' ? 'Mesa do Valdinei' : it.id === 'desk-fran' ? 'Mesa da Fran' : `Mesa ${/^desk-\d+$/.test(it.id) ? it.id.slice(5) : String(i).padStart(2, '0')}`;
    const room = zoneAt(it.x, it.z);
    return { id: it.id, label, zone: it.team || room.label, item: it, seat: itemSeats(it)[0] };
  });
}

export const PROXIMITY = { full: 2.2, max: 4.6 };

// Opções de personalização dos avatares (o servidor valida contra estas listas).
export const AVATAR_OPTIONS = {
  skin: ['#f9dcc6', '#f1c3a1', '#e0a47c', '#c4835a', '#94603d', '#5e3a26'],
  hairStyle: ['short', 'fringe', 'buzz', 'long', 'ponytail', 'bun', 'curly', 'bald'],
  hairColor: ['#1f1715', '#4a2c1d', '#8a5530', '#c99a5b', '#e8d29a', '#b23a2e', '#6d4bd6', '#9aa3ad'],
  face: ['smile', 'calm', 'lashes', 'beard', 'mustache', 'stubble', 'freckles'],
  top: ['tshirt', 'polo', 'hoodie', 'social', 'blazer', 'sweater'],
  shirt: ['#2f7bff', '#7c5cff', '#ff6b8b', '#ffb547', '#22c58b', '#1fb6d6', '#ff7a45', '#2b3446', '#f4f4f6', '#c2263f'],
  legwear: ['jeans', 'social', 'shorts', 'skirt'],
  pants: ['#2d4a7a', '#26324a', '#3a3a40', '#6b5a48', '#c8b89a', '#8a9bb5'],
  shoes: ['#f4f4f6', '#1f2229', '#7a4a2a', '#2f7bff', '#ff5d6e'],
  accessory: ['none', 'glasses', 'sunglasses', 'headphones', 'cap', 'beanie'],
};

export function randomAvatar(seed = Math.random().toString()) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  return {
    skin: pick(AVATAR_OPTIONS.skin),
    hairStyle: pick(AVATAR_OPTIONS.hairStyle.slice(0, 7)),
    hairColor: pick(AVATAR_OPTIONS.hairColor.slice(0, 6)),
    face: pick(AVATAR_OPTIONS.face),
    top: pick(AVATAR_OPTIONS.top),
    shirt: pick(AVATAR_OPTIONS.shirt),
    legwear: pick(['jeans', 'jeans', 'social', 'social', 'shorts', 'skirt']),
    pants: pick(AVATAR_OPTIONS.pants),
    shoes: pick(AVATAR_OPTIONS.shoes),
    accessory: rnd() < 0.55 ? 'none' : pick(AVATAR_OPTIONS.accessory.slice(1)),
  };
}

export function sanitizeAvatar(input) {
  const base = randomAvatar();
  const out = {};
  for (const key of Object.keys(AVATAR_OPTIONS)) {
    out[key] = AVATAR_OPTIONS[key].includes(input?.[key]) ? input[key] : base[key];
  }
  return out;
}

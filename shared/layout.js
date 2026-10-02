// Planta do escritório — compartilhada entre o servidor (seed das mesas) e o cliente (cena 3D).
// Unidades em metros. Eixo X: oeste(-) → leste(+). Eixo Z: norte(-) → sul(+).
// A câmera isométrica olha de sudeste, então as paredes norte e oeste ficam ao fundo.

export const WORLD = { minX: -18, maxX: 18, minZ: -12, maxZ: 12 };

// Zonas privadas isolam o áudio: só quem está dentro se escuta (estilo Gather).
export const ZONES = [
  { id: 'meeting', label: 'Sala de Reunião', private: true, x0: 5, x1: 18, z0: -12, z1: -3 },
  { id: 'booth1', label: 'Cabine de Foco 1', private: true, x0: -1, x1: 1.5, z0: -12, z1: -9.2 },
  { id: 'booth2', label: 'Cabine de Foco 2', private: true, x0: 1.5, x1: 4, z0: -12, z1: -9.2 },
  { id: 'work', label: 'Área de Trabalho', private: false, x0: -18, x1: -1, z0: -12, z1: 3 },
  { id: 'lounge', label: 'Lounge', private: false, x0: 7, x1: 18, z0: 0, z1: 12 },
  { id: 'cafe', label: 'Café & Conexões', private: false, x0: -18, x1: -7, z0: 5, z1: 12 },
  { id: 'reception', label: 'Recepção', private: false, x0: -5, x1: 7, z0: 4, z1: 12 },
];

export function zoneAt(x, z) {
  for (const zone of ZONES) if (x >= zone.x0 && x < zone.x1 && z >= zone.z0 && z < zone.z1) return zone;
  return { id: 'hall', label: 'Corredor', private: false };
}

export const SPAWN = { x: 1, z: 6.2 };

// 4 ilhas com 4 mesas cada (duas de frente para as outras).
const PODS = [
  { cx: -14, cz: -7.4, team: 'Operações' },
  { cx: -7.4, cz: -7.4, team: 'Criação' },
  { cx: -14, cz: -1.4, team: 'Tech' },
  { cx: -7.4, cz: -1.4, team: 'Comercial' },
];

export const DESK = { w: 1.5, d: 0.8, h: 0.62 };

export const DESKS = PODS.flatMap((pod, pi) => {
  const out = [];
  [-1, 1].forEach((side, si) => {
    [-1, 1].forEach((col, ci) => {
      const n = pi * 4 + si * 2 + ci + 1;
      const x = pod.cx + col * 0.77;
      const z = pod.cz + side * 0.41;
      // side -1: mesa do lado norte, a pessoa senta ao norte olhando para o sul (face 0)
      const face = side < 0 ? 0 : Math.PI;
      const seatZ = z + side * 0.78;
      out.push({
        id: `desk-${String(n).padStart(2, '0')}`,
        label: `Mesa ${String(n).padStart(2, '0')}`,
        zone: pod.team,
        x, z, face,
        seat: { x, z: seatZ, face },
      });
    });
  });
  return out;
});

// Assentos públicos (qualquer pessoa pode sentar clicando).
export const SEATS = [];
(() => {
  // sala de reunião — mesa central (11.5, -7.5)
  const mx = 11.5, mz = -7.5;
  [-1.8, 0, 1.8].forEach((dx, i) => {
    SEATS.push({ id: `meet-n${i}`, kind: 'chair', x: mx + dx, z: mz - 1.45, face: 0, h: 0.4 });
    SEATS.push({ id: `meet-s${i}`, kind: 'chair', x: mx + dx, z: mz + 1.45, face: Math.PI, h: 0.4 });
  });
  SEATS.push({ id: 'meet-w', kind: 'chair', x: mx - 3.45, z: mz, face: Math.PI / 2, h: 0.4 });
  SEATS.push({ id: 'meet-e', kind: 'chair', x: mx + 3.45, z: mz, face: -Math.PI / 2, h: 0.4 });
  // lounge — sofá ao norte do tapete, olhando para o sul
  [10.6, 11.9, 13.2, 14.5].forEach((x, i) => SEATS.push({ id: `sofa-${i}`, kind: 'sofa', x, z: 3.55, face: 0, h: 0.44 }));
  SEATS.push({ id: 'arm-0', kind: 'armchair', x: 11, z: 8.6, face: Math.PI, h: 0.38 });
  SEATS.push({ id: 'arm-1', kind: 'armchair', x: 14.2, z: 8.6, face: Math.PI, h: 0.38 });
  // café — banquetas no balcão e mesas redondas
  [6.6, 8.2, 9.8].forEach((z, i) => SEATS.push({ id: `bar-${i}`, kind: 'stool', x: -15.1, z, face: -Math.PI / 2, h: 0.5 }));
  [[-11.5, 7.2], [-9, 10]].forEach(([tx, tz], t) => {
    SEATS.push({ id: `cafe-${t}a`, kind: 'chair', x: tx - 0.95, z: tz, face: Math.PI / 2, h: 0.4 });
    SEATS.push({ id: `cafe-${t}b`, kind: 'chair', x: tx + 0.95, z: tz, face: -Math.PI / 2, h: 0.4 });
  });
  // cabines de foco
  SEATS.push({ id: 'booth1-seat', kind: 'chair', x: 0.25, z: -10.55, face: Math.PI, h: 0.4 });
  SEATS.push({ id: 'booth2-seat', kind: 'chair', x: 2.75, z: -10.55, face: Math.PI, h: 0.4 });
})();

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

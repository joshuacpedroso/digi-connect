// Catálogo de móveis do editor do escritório (compartilhado: o servidor valida, o cliente constrói).
// w/d = área ocupada (bloqueia a passagem) no espaço local do item; 0 = dá pra pisar em cima.
// seats = assentos em coordenadas locais (quem senta olha para +z local, rotacionado pelo item).
// desk = pode ser atribuída a uma pessoa.

export const CATEGORIES = ['Trabalho', 'Assentos', 'Mesas', 'Decoração', 'Diversão', 'Copa'];

export const CATALOG = {
  desk: { label: 'Mesa de trabalho', cat: 'Trabalho', icon: '🖥️', w: 1.5, d: 0.8, desk: true, seats: [{ x: 0, z: -0.78, face: 0, h: 0.41, kind: 'desk' }], color: true },
  desk_exec: { label: 'Mesa de diretor', cat: 'Trabalho', icon: '💼', w: 2.0, d: 0.95, desk: true, seats: [{ x: 0, z: -0.95, face: 0, h: 0.43, kind: 'desk' }] },
  table_booth: { label: 'Mesinha de foco', cat: 'Trabalho', icon: '💻', w: 1.3, d: 0.6 },
  divider: { label: 'Divisória', cat: 'Trabalho', icon: '▭', w: 3.1, d: 0.08, color: true },
  whiteboard: { label: 'Quadro branco', cat: 'Trabalho', icon: '📋', w: 1.9, d: 0.35 },
  printer: { label: 'Impressora', cat: 'Trabalho', icon: '🖨️', w: 0.9, d: 0.6 },
  tv: { label: 'TV / Telão', cat: 'Trabalho', icon: '📺', w: 2.4, d: 0.45 },
  chair_office: { label: 'Cadeira', cat: 'Assentos', icon: '🪑', w: 0, d: 0, seats: [{ x: 0, z: 0, face: 0, h: 0.41, kind: 'chair' }], color: true },
  chair_guest: { label: 'Cadeira de visita', cat: 'Assentos', icon: '💺', w: 0, d: 0, seats: [{ x: 0, z: 0, face: 0, h: 0.41, kind: 'chair' }], color: true },
  chair_wood: { label: 'Cadeira de madeira', cat: 'Assentos', icon: '🪵', w: 0, d: 0, seats: [{ x: 0, z: 0, face: 0, h: 0.4, kind: 'chair' }], color: true },
  stool: { label: 'Banqueta', cat: 'Assentos', icon: '🍸', w: 0, d: 0, seats: [{ x: 0, z: 0, face: 0, h: 0.5, kind: 'stool' }], color: true },
  armchair: { label: 'Poltrona', cat: 'Assentos', icon: '🛋️', w: 0.95, d: 0.9, seats: [{ x: 0, z: 0.05, face: 0, h: 0.38, kind: 'armchair' }], color: true },
  sofa: { label: 'Sofá', cat: 'Assentos', icon: '🛋️', w: 2.7, d: 0.95, seats: [-0.85, 0, 0.85].map((x) => ({ x, z: 0.12, face: 0, h: 0.44, kind: 'sofa' })), color: true },
  sofa_small: { label: 'Sofá 2 lugares', cat: 'Assentos', icon: '🛋️', w: 1.8, d: 0.9, seats: [-0.42, 0.42].map((x) => ({ x, z: 0.1, face: 0, h: 0.44, kind: 'sofa' })), color: true },
  bench: { label: 'Banco', cat: 'Assentos', icon: '🪵', w: 2.3, d: 0.5, seats: [-0.7, 0, 0.7].map((x) => ({ x, z: 0, face: 0, h: 0.42, kind: 'sofa' })) },
  beanbag: { label: 'Puff', cat: 'Assentos', icon: '🫘', w: 0.8, d: 0.8, seats: [{ x: 0, z: 0.05, face: 0, h: 0.3, kind: 'armchair' }], color: true },
  table_meeting: { label: 'Mesa de reunião', cat: 'Mesas', icon: '🟫', w: 5.5, d: 2.0 },
  table_round: { label: 'Mesa redonda', cat: 'Mesas', icon: '⚪', w: 1.1, d: 1.1 },
  table_coffee: { label: 'Mesa de centro', cat: 'Mesas', icon: '☕', w: 2.2, d: 1.1 },
  reception: { label: 'Balcão de recepção', cat: 'Mesas', icon: '🛎️', w: 3.6, d: 1.0 },
  plant: { label: 'Planta', cat: 'Decoração', icon: '🪴', w: 0.55, d: 0.55 },
  plant_tall: { label: 'Planta grande', cat: 'Decoração', icon: '🌿', w: 0.65, d: 0.65 },
  tree_indoor: { label: 'Árvore', cat: 'Decoração', icon: '🌳', w: 0.9, d: 0.9 },
  bookshelf: { label: 'Estante', cat: 'Decoração', icon: '📚', w: 1.6, d: 0.42 },
  cabinet_low: { label: 'Aparador', cat: 'Decoração', icon: '🗄️', w: 3.0, d: 0.5 },
  lamp_floor: { label: 'Luminária de chão', cat: 'Decoração', icon: '💡', w: 0.45, d: 0.45 },
  pendant: { label: 'Pendente', cat: 'Decoração', icon: '🔆', w: 0, d: 0 },
  rug_rect: { label: 'Tapete', cat: 'Decoração', icon: '🟦', w: 0, d: 0, color: true },
  rug_round: { label: 'Tapete redondo', cat: 'Decoração', icon: '🔵', w: 0, d: 0, color: true },
  welcome_mat: { label: 'Tapete de boas-vindas', cat: 'Decoração', icon: '👋', w: 0, d: 0 },
  water_cooler: { label: 'Bebedouro', cat: 'Copa', icon: '🚰', w: 0.5, d: 0.5 },
  kitchen: { label: 'Cozinha', cat: 'Copa', icon: '🍳', w: 6.2, d: 0.7 },
  bar_counter: { label: 'Balcão do café', cat: 'Copa', icon: '🥤', w: 5.0, d: 0.75 },
  fridge: { label: 'Geladeira', cat: 'Copa', icon: '🧊', w: 0.85, d: 0.8 },
  vending: { label: 'Máquina de snacks', cat: 'Copa', icon: '🍫', w: 0.95, d: 0.75 },
  pingpong: { label: 'Ping-pong', cat: 'Diversão', icon: '🏓', w: 2.8, d: 1.55 },
  foosball: { label: 'Pebolim', cat: 'Diversão', icon: '⚽', w: 1.45, d: 0.85 },
  arcade: { label: 'Fliperama', cat: 'Diversão', icon: '🕹️', w: 0.8, d: 0.75 },
};

export const ITEM_COLORS = ['#2f7bff', '#ff7a6b', '#1fb59f', '#f2a93b', '#7c5cff', '#2a7f7a', '#e9ecf2', '#2b3446', '#c2263f', '#9cb38a'];

// Assentos de um item no mundo.
export function itemSeats(item) {
  const def = CATALOG[item.type];
  if (!def?.seats) return [];
  const c = Math.cos(item.rot || 0), s = Math.sin(item.rot || 0);
  return def.seats.map((st, k) => ({
    id: def.seats.length > 1 ? `${item.id}#${k}` : item.id,
    item: item.id,
    x: item.x + st.x * c + st.z * s,
    z: item.z - st.x * s + st.z * c,
    face: (item.rot || 0) + st.face,
    h: st.h,
    kind: st.kind,
    desk: !!def.desk,
  }));
}

// Retângulo (alinhado aos eixos) que o item ocupa no chão.
export function itemFootprint(item, pad = 0) {
  const def = CATALOG[item.type];
  if (!def || !def.w || !def.d) return null;
  const c = Math.abs(Math.cos(item.rot || 0)), s = Math.abs(Math.sin(item.rot || 0));
  const hw = (def.w * c + def.d * s) / 2 + pad;
  const hd = (def.w * s + def.d * c) / 2 + pad;
  return { x0: item.x - hw, x1: item.x + hw, z0: item.z - hd, z1: item.z + hd };
}

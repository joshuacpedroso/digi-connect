// Móveis do escritório (itens editáveis). Cada tipo do catálogo tem um construtor 3D.
// Espaço local: quem senta olha para +z; o item é girado por item.rot.
import * as THREE from 'three';
import { CATALOG, itemSeats, itemFootprint } from '../../shared/catalog.js';
import { DESK } from '../../shared/layout.js';
import {
  mat, rbox, cyl, sphere, group, mergeStatic,
  screenTexture, rugTexture, noiseTexture, gameScreenTexture, snackTexture, labelTexture,
} from './kit.js';

const C = {
  deskTop: '#fbfaf7', oak: '#c99a64', walnut: '#6b4a33', metal: '#2c313c', chrome: '#c7ccd6',
  plant: '#3f9b5a', plant2: '#2f8150', plant3: '#5bb36b', pot: '#d77b55', potWhite: '#f1efea', sofa: '#2a7f7a',
};
const screens = {};
const screen = (k) => (screens[k] ||= new THREE.MeshBasicMaterial({ map: screenTexture(k), toneMapped: false }));
const glowCache = new Map();
const glow = (c, i = 1.6) => {
  const k = c + i;
  if (!glowCache.has(k)) glowCache.set(k, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, toneMapped: false }));
  return glowCache.get(k);
};
let fabricMap = null;
const fabric = (c) => { fabricMap ||= noiseTexture('#ffffff', 0.08, 128, [3, 3]); return mat(c, { roughness: 0.95, map: fabricMap }); };
const plantMats = () => [mat(C.plant), mat(C.plant2), mat(C.plant3)];

function hit(g, w, h, d, data, y = h / 2, z = 0, x = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.set(x, y, z);
  m.userData = data;
  g.add(m);
  return m;
}

// ------------------------------------------------------------------ peças reutilizáveis
function chairOffice(g, color, x = 0, z = 0, ry = 0, tall = false) {
  const c = group(g, x, 0, z, ry);
  const seat = fabric(color);
  cyl(c, 0.03, 0.03, 0.3, mat(C.metal, { metalness: 0.5, roughness: 0.35 }), 0, 0.05, 0, 10);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = rbox(c, 0.05, 0.03, 0.27, mat(C.metal), Math.sin(a) * 0.12, 0.03, Math.cos(a) * 0.12, 0.012, false);
    leg.rotation.y = a;
    sphere(c, 0.025, mat('#111'), Math.sin(a) * 0.24, 0.025, Math.cos(a) * 0.24, 8, false);
  }
  rbox(c, 0.48, 0.09, 0.46, seat, 0, 0.32, 0, 0.045);
  rbox(c, 0.46, tall ? 0.7 : 0.5, 0.08, seat, 0, 0.45, -0.22, 0.04);
  rbox(c, 0.04, 0.2, 0.06, mat(C.metal), 0, 0.36, -0.2, 0.01, false);
  [-0.26, 0.26].forEach((ax) => { rbox(c, 0.04, 0.16, 0.04, mat(C.metal), ax, 0.38, 0, 0.01, false); rbox(c, 0.06, 0.03, 0.26, mat('#222'), ax, 0.54, 0.02, 0.015, false); });
  return c;
}

function laptop(g, x, y, z, ry = 0, open = true) {
  const l = group(g, x, y, z, ry);
  rbox(l, 0.38, 0.02, 0.26, mat(C.chrome, { metalness: 0.6, roughness: 0.3 }), 0, 0, 0, 0.01, false);
  if (open) {
    const lid = group(l, 0, 0.02, -0.13);
    rbox(lid, 0.38, 0.25, 0.015, mat(C.chrome, { metalness: 0.6, roughness: 0.3 }), 0, 0, 0, 0.008, false);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.21), screen('ui'));
    s.position.set(0, 0.125, 0.009);
    lid.add(s);
    lid.rotation.x = -0.25;
  }
  return l;
}

function mug(g, x, y, z, color) {
  cyl(g, 0.04, 0.036, 0.09, mat(color, { roughness: 0.4 }), x, y, z, 14, false);
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.008, 6, 12), mat(color));
  h.position.set(x + 0.045, y + 0.045, z);
  h.rotation.y = Math.PI / 2;
  g.add(h);
}

function pot(g, s, color, x = 0, z = 0) {
  cyl(g, 0.24 * s, 0.18 * s, 0.42 * s, mat(color, { roughness: 0.6 }), x, 0, z, 20);
  cyl(g, 0.21 * s, 0.21 * s, 0.03 * s, mat('#5a3d2b'), x, 0.41 * s, z, 20, false);
}

// ------------------------------------------------------------------ construtores
const BUILD = {
  desk(g, it, ctx) {
    const color = it.color || '#2f7bff';
    rbox(g, DESK.w, 0.05, DESK.d, mat(C.deskTop, { roughness: 0.4 }), 0, DESK.h - 0.05, 0, 0.02);
    rbox(g, DESK.w - 0.02, 0.02, DESK.d - 0.02, mat(C.oak), 0, DESK.h - 0.065, 0, 0.005, false);
    [-1, 1].forEach((sx) => {
      rbox(g, 0.05, DESK.h - 0.05, DESK.d - 0.1, mat(C.metal), sx * (DESK.w / 2 - 0.08), 0, 0, 0.015);
      rbox(g, 0.05, 0.03, DESK.d - 0.04, mat(C.metal), sx * (DESK.w / 2 - 0.08), 0, 0, 0.01, false);
    });
    // gaveteiro
    rbox(g, 0.36, 0.5, 0.5, mat('#e9ecf2'), 0.5, 0.02, 0.0, 0.03);
    [0.12, 0.28, 0.44].forEach((y) => rbox(g, 0.12, 0.015, 0.01, mat(C.metal), 0.5, y, -0.255, 0.004, false));
    // monitor
    const mon = group(g, 0, DESK.h, 0.16);
    rbox(mon, 0.26, 0.015, 0.17, mat(C.metal), 0, 0, 0, 0.007, false);
    rbox(mon, 0.04, 0.22, 0.04, mat(C.metal), 0, 0, 0.02, 0.01, false);
    rbox(mon, 0.8, 0.46, 0.035, mat('#1d2230', { roughness: 0.3 }), 0, 0.17, 0, 0.02);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.4), screen(['code', 'chart', 'ui'][ctx.index % 3]));
    scr.position.set(0, 0.4, -0.02); scr.rotation.y = Math.PI;
    mon.add(scr);
    rbox(g, 0.44, 0.016, 0.14, mat('#e9ecf2'), -0.05, DESK.h, -0.16, 0.006, false);
    rbox(g, 0.07, 0.022, 0.1, mat('#e9ecf2'), 0.3, DESK.h, -0.16, 0.02, false);
    mug(g, -0.55, DESK.h, 0.05, color);
    if (ctx.index % 2) { cyl(g, 0.06, 0.05, 0.1, mat(C.potWhite), 0.58, DESK.h, 0.2, 12, false); sphere(g, 0.09, plantMats()[ctx.index % 3], 0.58, DESK.h + 0.16, 0.2, 8, false); }
    else { rbox(g, 0.22, 0.03, 0.16, mat(['#ff7a6b', '#2f7bff', '#ffd479'][ctx.index % 3]), 0.5, DESK.h, 0.15, 0.01, false); }
    chairOffice(g, color, 0, -0.78, 0);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.016, -0.78);
    ring.userData.dynamic = true;
    g.add(ring);
    hit(g, DESK.w + 0.1, 1.2, 1.9, { kind: 'desk', id: it.id }, 0.6, -0.4);
    ctx.desk = { ring, ringMat };
  },

  desk_exec(g, it, ctx) {
    const wood = mat(C.walnut, { roughness: 0.45 });
    rbox(g, 2.0, 0.06, 0.95, wood, 0, 0.68, 0, 0.03);
    rbox(g, 1.9, 0.62, 0.05, wood, 0, 0.06, 0.42, 0.02);
    [-0.92, 0.92].forEach((x) => rbox(g, 0.08, 0.68, 0.9, wood, x, 0, 0, 0.02));
    rbox(g, 0.5, 0.55, 0.8, mat('#5a3d2b'), 0.62, 0.06, -0.02, 0.03);
    // monitor + laptop + luminária + porta-nome
    const mon = group(g, -0.25, 0.74, 0.2);
    rbox(mon, 0.24, 0.015, 0.15, mat(C.metal), 0, 0, 0, 0.007, false);
    rbox(mon, 0.04, 0.24, 0.04, mat(C.metal), 0, 0, 0.02, 0.01, false);
    rbox(mon, 0.9, 0.5, 0.035, mat('#1d2230'), 0, 0.18, 0, 0.02);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.44), screen('chart'));
    scr.position.set(0, 0.43, -0.02); scr.rotation.y = Math.PI;
    mon.add(scr);
    laptop(g, 0.5, 0.74, -0.05, Math.PI + 0.3);
    const lamp = group(g, -0.82, 0.74, 0.25);
    cyl(lamp, 0.08, 0.09, 0.02, mat(C.metal), 0, 0, 0, 14, false);
    cyl(lamp, 0.012, 0.012, 0.35, mat(C.metal), 0, 0, 0, 6, false);
    cyl(lamp, 0.05, 0.1, 0.12, glow('#ffe7b3', 0.8), 0, 0.33, 0, 16, false);
    rbox(g, 0.32, 0.08, 0.04, mat('#d9b48a'), 0.1, 0.74, 0.38, 0.01, false);
    mug(g, 0.15, 0.74, -0.2, '#ffffff');
    chairOffice(g, '#2b2f38', 0, -0.95, 0, true);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 40), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.016, -0.95); ring.userData.dynamic = true;
    g.add(ring);
    hit(g, 2.1, 1.3, 2.0, { kind: 'desk', id: it.id }, 0.65, -0.45);
    ctx.desk = { ring, ringMat };
  },

  table_booth(g) {
    rbox(g, 1.3, 0.04, 0.6, mat(C.deskTop, { roughness: 0.4 }), 0, 0.6, 0, 0.02);
    rbox(g, 1.2, 0.6, 0.04, mat(C.oak), 0, 0, -0.26, 0.01);
    laptop(g, 0, 0.64, 0.02, Math.PI);
    const lamp = group(g, 0.45, 0.64, -0.05);
    cyl(lamp, 0.06, 0.08, 0.02, mat(C.metal), 0, 0, 0, 12, false);
    cyl(lamp, 0.012, 0.012, 0.32, mat(C.metal), 0, 0, 0, 6, false);
    cyl(lamp, 0.03, 0.09, 0.1, glow('#ffd88a', 0.8), 0, 0.3, 0, 16, false);
  },

  divider(g, it) {
    rbox(g, 3.1, 0.34, 0.05, fabric(it.color || '#2f7bff'), 0, DESK.h, 0, 0.02);
    rbox(g, 3.12, 0.02, 0.06, mat('#e9ecf2'), 0, DESK.h + 0.34, 0, 0.01, false);
  },

  whiteboard(g) {
    [-0.85, 0.85].forEach((x) => { rbox(g, 0.05, 1.9, 0.05, mat(C.chrome, { metalness: 0.5 }), x, 0, 0, 0.01); rbox(g, 0.06, 0.04, 0.5, mat(C.metal), x, 0, 0, 0.01, false); });
    rbox(g, 1.75, 1.0, 0.04, mat('#ffffff', { roughness: 0.2 }), 0, 0.8, 0, 0.02);
    const marks = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.8), new THREE.MeshBasicMaterial({ map: screenTexture('ui'), transparent: true, opacity: 0.35 }));
    marks.position.set(0, 1.3, 0.025);
    g.add(marks);
    rbox(g, 1.6, 0.03, 0.07, mat('#9aa3ad'), 0, 0.78, 0.04, 0.01, false);
    ['#ff5d6e', '#2f7bff', '#22c58b'].forEach((c, i) => cyl(g, 0.012, 0.012, 0.12, mat(c), -0.3 + i * 0.08, 0.81, 0.05, 6, false).rotation.z = Math.PI / 2);
  },

  printer(g) {
    rbox(g, 0.9, 0.55, 0.6, mat('#e9ecf2'), 0, 0, 0, 0.03);
    rbox(g, 0.7, 0.32, 0.5, mat('#f7f7f9'), 0, 0.55, 0, 0.04);
    rbox(g, 0.5, 0.03, 0.25, mat('#ffffff'), 0, 0.88, 0.18, 0.01, false);
    rbox(g, 0.12, 0.05, 0.02, glow('#22c58b', 1.2), 0.22, 0.75, 0.26, 0.01, false);
  },

  tv(g) {
    rbox(g, 2.2, 0.38, 0.42, mat('#2b2f38'), 0, 0, 0, 0.04);
    rbox(g, 2.3, 1.35, 0.06, mat('#151a24', { roughness: 0.3 }), 0, 0.55, -0.05, 0.03);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.18, 1.23), screen('chart'));
    s.position.set(0, 1.225, -0.015);
    g.add(s);
  },

  chair_office(g, it) { chairOffice(g, it.color || '#e9ecf2'); },

  chair_guest(g, it) {
    const seat = fabric(it.color || '#2f7bff');
    [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]].forEach(([x, z]) => cyl(g, 0.018, 0.015, 0.36, mat(C.chrome, { metalness: 0.6, roughness: 0.3 }), x, 0, z, 8));
    rbox(g, 0.48, 0.08, 0.46, seat, 0, 0.34, 0, 0.04);
    rbox(g, 0.48, 0.42, 0.08, seat, 0, 0.42, -0.21, 0.04);
  },

  chair_wood(g, it) {
    [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].forEach(([a, b]) => cyl(g, 0.018, 0.018, 0.36, mat(C.oak), a, 0, b, 6));
    rbox(g, 0.42, 0.06, 0.42, mat(it.color || '#ff7a6b', { roughness: 0.7 }), 0, 0.34, 0, 0.03);
    rbox(g, 0.42, 0.36, 0.05, mat(it.color || '#ff7a6b', { roughness: 0.7 }), 0, 0.4, -0.2, 0.025);
  },

  stool(g, it) {
    cyl(g, 0.025, 0.025, 0.45, mat(C.metal), 0, 0, 0, 8);
    cyl(g, 0.17, 0.2, 0.02, mat(C.metal), 0, 0, 0, 16, false);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 20), mat(C.chrome, { metalness: 0.6 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; g.add(ring);
    cyl(g, 0.2, 0.18, 0.06, mat(it.color || '#f2a93b', { roughness: 0.6 }), 0, 0.45, 0, 20);
  },

  armchair(g, it) {
    const am = fabric(it.color || '#ff7a6b');
    rbox(g, 0.95, 0.3, 0.9, am, 0, 0.06, 0, 0.14);
    rbox(g, 0.95, 0.62, 0.24, am, 0, 0.06, -0.36, 0.12);
    [-0.4, 0.4].forEach((x) => rbox(g, 0.18, 0.46, 0.9, am, x, 0.06, 0, 0.09));
    [-0.38, 0.38].forEach((x) => [-0.35, 0.35].forEach((z) => cyl(g, 0.025, 0.02, 0.07, mat(C.oak), x, 0, z, 6, false)));
    rbox(g, 0.4, 0.34, 0.12, fabric('#f7f3ee'), 0.0, 0.4, -0.18, 0.06).rotation.x = -0.2;
  },

  sofa(g, it) { sofa(g, it, 2.7, 3); },
  sofa_small(g, it) { sofa(g, it, 1.8, 2); },

  bench(g) {
    for (let i = 0; i < 4; i++) rbox(g, 2.2, 0.035, 0.1, mat(C.oak), 0, 0.4, -0.18 + i * 0.12, 0.01);
    [-0.9, 0.9].forEach((x) => rbox(g, 0.08, 0.4, 0.45, mat(C.metal), x, 0, 0, 0.02));
  },

  beanbag(g, it) {
    const b = sphere(g, 0.45, fabric(it.color || '#7c5cff'), 0, 0.3, 0, 20);
    b.scale.set(1, 0.68, 1);
    const top = sphere(g, 0.28, fabric(it.color || '#7c5cff'), 0, 0.42, -0.12, 14);
    top.scale.set(1.1, 0.6, 0.8);
  },

  table_meeting(g) {
    rbox(g, 5.5, 0.08, 2.0, mat('#d9b48a', { roughness: 0.45 }), 0, 0.58, 0, 0.06);
    rbox(g, 5.3, 0.03, 1.8, mat('#f7f3ee', { roughness: 0.35 }), 0, 0.66, 0, 0.03);
    [-1.8, 1.8].forEach((dx) => { rbox(g, 0.2, 0.58, 1.1, mat(C.metal), dx, 0, 0, 0.04); rbox(g, 0.5, 0.04, 1.3, mat(C.metal), dx, 0, 0, 0.02); });
    [[-1.4, -0.5, 0], [0, 0.5, Math.PI], [1.4, -0.5, 0]].forEach(([dx, dz, r]) => laptop(g, dx, 0.69, dz, r));
    cyl(g, 0.05, 0.05, 0.22, mat('#7ee0c3', { roughness: 0.2 }), -0.6, 0.69, 0.1, 12, false);
    cyl(g, 0.05, 0.05, 0.22, mat('#ff8fa3', { roughness: 0.2 }), 0.7, 0.69, -0.2, 12, false);
    cyl(g, 0.1, 0.08, 0.1, mat(C.potWhite), 0, 0.69, 0, 14, false);
    sphere(g, 0.14, plantMats()[0], 0, 0.86, 0, 10, false);
    rbox(g, 0.3, 0.02, 0.2, mat('#ffffff'), 2.2, 0.69, 0.4, 0.01, false);
  },

  table_round(g) {
    cyl(g, 0.55, 0.55, 0.04, mat('#f7f3ee', { roughness: 0.35 }), 0, 0.6, 0, 32);
    cyl(g, 0.04, 0.04, 0.6, mat(C.metal), 0, 0, 0, 8);
    cyl(g, 0.3, 0.3, 0.03, mat(C.metal), 0, 0, 0, 20, false);
    sphere(g, 0.08, plantMats()[1], 0.05, 0.72, 0.05, 10, false);
    mug(g, -0.22, 0.64, 0.1, '#2f7bff');
  },

  table_coffee(g) {
    rbox(g, 2.2, 0.08, 1.1, mat(C.oak, { roughness: 0.5 }), 0, 0.32, 0, 0.08);
    [[-0.95, -0.4], [0.95, -0.4], [-0.95, 0.4], [0.95, 0.4]].forEach(([dx, dz]) => cyl(g, 0.03, 0.03, 0.32, mat(C.metal), dx, 0, dz, 6));
    ['#2f7bff', '#ff7a6b'].forEach((c, i) => rbox(g, 0.36, 0.05 + i * 0.03, 0.26, mat(c), -0.4 + i * 0.12, 0.4 + i * 0.05, -0.05, 0.01, false));
    cyl(g, 0.06, 0.08, 0.14, mat(C.potWhite), 0.5, 0.4, 0.1, 12, false);
    sphere(g, 0.13, plantMats()[2], 0.5, 0.62, 0.1, 10, false);
  },

  reception(g) {
    rbox(g, 3.4, 1.0, 0.8, mat('#f7f3ee', { roughness: 0.4 }), 0, 0, 0, 0.12);
    rbox(g, 3.6, 0.06, 1.0, mat(C.oak, { roughness: 0.5 }), 0, 1.0, 0, 0.03);
    rbox(g, 3.0, 0.08, 0.02, glow('#2f7bff', 1.4), 0, 0.25, 0.41, 0.01, false);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map: labelTexture('DIGI CONNECT', { bg: '#0d1b33', fg: '#ffffff' }), transparent: true, toneMapped: false }));
    sign.position.set(0, 0.58, 0.42);
    g.add(sign);
    const mon = group(g, 0.6, 1.06, -0.1, Math.PI);
    rbox(mon, 0.6, 0.36, 0.03, mat('#1d2230'), 0, 0.1, 0, 0.02, false);
    rbox(mon, 0.04, 0.12, 0.04, mat(C.metal), 0, 0, 0.03, 0.01, false);
    sphere(g, 0.1, mat('#f2c94c', { metalness: 0.7, roughness: 0.25 }), -0.8, 1.12, 0.1, 12, false).scale.y = 0.6;
    cyl(g, 0.08, 0.1, 0.12, mat(C.potWhite), 1.4, 1.06, 0, 12, false);
    sphere(g, 0.16, plantMats()[2], 1.4, 1.3, 0, 10, false);
  },

  plant(g) { plant(g, 1, C.pot, 0); },
  plant_tall(g, it, ctx) { plant(g, 1.35, ctx.index % 2 ? C.potWhite : '#2b2f38', ctx.index % 3); },
  tree_indoor(g) {
    cyl(g, 0.38, 0.32, 0.5, mat('#2b2f38', { roughness: 0.6 }), 0, 0, 0, 20);
    cyl(g, 0.06, 0.09, 1.4, mat('#8a5a3b'), 0, 0.45, 0, 8);
    const m = plantMats();
    [[0, 2.0, 0, 0.75], [0.35, 1.7, 0.2, 0.55], [-0.32, 1.75, -0.15, 0.55], [0.1, 1.6, -0.35, 0.5]].forEach(([x, y, z, r], i) => {
      const l = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m[i % 3]);
      l.position.set(x, y, z); l.castShadow = true; l.receiveShadow = true; g.add(l);
    });
  },

  bookshelf(g) {
    const wood = mat(C.oak, { roughness: 0.6 });
    [-0.78, 0.78].forEach((x) => rbox(g, 0.04, 1.9, 0.4, wood, x, 0, 0, 0.01));
    for (let i = 0; i < 5; i++) rbox(g, 1.6, 0.04, 0.4, wood, 0, i * 0.46, 0, 0.01);
    rbox(g, 1.6, 1.9, 0.02, mat('#e9e2d6'), 0, 0, -0.19, 0.005, false);
    const cols = ['#2f7bff', '#ff7a6b', '#f2a93b', '#1fb59f', '#7c5cff', '#2b3446', '#e9ecf2'];
    for (let r = 0; r < 4; r++) {
      let x = -0.72;
      let k = r * 3;
      while (x < 0.6) {
        const w = 0.05 + ((k * 7) % 4) * 0.012;
        const h = 0.26 + ((k * 5) % 4) * 0.035;
        if ((k + r) % 9 === 4) { sphere(g, 0.1, plantMats()[k % 3], x + 0.1, r * 0.46 + 0.14, 0, 8, false); x += 0.25; }
        else { rbox(g, w, h, 0.26, mat(cols[k % cols.length], { roughness: 0.7 }), x + w / 2, r * 0.46 + 0.04, 0.02, 0.006, false); x += w + 0.008; }
        k++;
      }
    }
  },

  cabinet_low(g) {
    rbox(g, 3.0, 0.75, 0.5, mat('#f7f3ee', { roughness: 0.5 }), 0, 0, 0, 0.04);
    [-1, 0, 1].forEach((i) => rbox(g, 0.9, 0.6, 0.01, mat('#e6dfd3'), i * 0.98, 0.08, 0.255, 0.01, false));
    const cols = ['#2f7bff', '#ff7a6b', '#f2a93b', '#1fb59f', '#7c5cff'];
    for (let i = 0; i < 9; i++) rbox(g, 0.06, 0.2 + (i % 3) * 0.04, 0.2, mat(cols[i % 5]), -1.3 + i * 0.07, 0.75, 0, 0.005, false);
    cyl(g, 0.12, 0.09, 0.22, mat(C.potWhite), 0.9, 0.75, 0, 14, false);
    sphere(g, 0.2, plantMats()[0], 0.9, 1.1, 0, 10, false);
    rbox(g, 0.5, 0.36, 0.03, mat('#2b2f38'), 0.1, 0.75, -0.1, 0.01, false);
  },

  lamp_floor(g) {
    cyl(g, 0.18, 0.2, 0.04, mat(C.metal), 0, 0, 0, 16);
    cyl(g, 0.015, 0.015, 1.5, mat(C.metal), 0, 0, 0, 6);
    cyl(g, 0.18, 0.3, 0.32, glow('#ffe2a8', 0.9), 0, 1.45, 0, 24);
  },

  pendant(g) {
    cyl(g, 0.006, 0.006, 0.9, mat('#222'), 0, 2.3, 0, 4, false);
    cyl(g, 0.07, 0.3, 0.24, mat('#1b2a4a', { roughness: 0.35, side: THREE.DoubleSide }), 0, 2.08, 0, 24, false);
    sphere(g, 0.07, glow('#fff1c9', 2.2), 0, 2.1, 0, 12, false);
  },

  rug_rect(g, it) {
    const c = new THREE.Color(it.color || '#2f7bff').lerp(new THREE.Color('#f4efe8'), 0.78);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.9), new THREE.MeshStandardMaterial({ color: c, roughness: 1, map: fabricMap || (fabricMap = noiseTexture('#ffffff', 0.08, 128, [3, 3])) }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.008; m.receiveShadow = true; g.add(m);
    const b = new THREE.Mesh(new THREE.RingGeometry(0.98, 1, 4, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(it.color || '#2f7bff').lerp(new THREE.Color('#ffffff'), 0.45) }));
    b.rotation.set(-Math.PI / 2, 0, Math.PI / 4); b.scale.set(3.2, 2.7, 1); b.position.y = 0.01; g.add(b);
  },

  rug_round(g, it) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48), new THREE.MeshStandardMaterial({ map: rugTexture(it.color || '#f3e4cf', new THREE.Color(it.color || '#f3e4cf').multiplyScalar(0.88).getStyle(), 'circles'), roughness: 1 }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.009; m.receiveShadow = true; g.add(m);
  },

  welcome_mat(g) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshStandardMaterial({ map: rugTexture('#ffffff', '#2f6bff', 'welcome'), roughness: 1 }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.01; m.receiveShadow = true; g.add(m);
  },

  water_cooler(g) {
    rbox(g, 0.45, 0.9, 0.45, mat('#f7f7f9'), 0, 0, 0, 0.06);
    cyl(g, 0.17, 0.17, 0.45, new THREE.MeshPhysicalMaterial({ color: '#9fd3ff', transparent: true, opacity: 0.6, roughness: 0.05, transmission: 0.3 }), 0, 0.9, 0, 16);
    rbox(g, 0.05, 0.05, 0.04, mat('#2f7bff'), -0.08, 0.6, 0.23, 0.01, false);
    rbox(g, 0.05, 0.05, 0.04, mat('#ff5d6e'), 0.08, 0.6, 0.23, 0.01, false);
  },

  kitchen(g, it, ctx) {
    rbox(g, 6.2, 0.92, 0.65, mat('#f7f3ee'), 0, 0, 0, 0.04);
    for (let i = 0; i < 6; i++) rbox(g, 0.95, 0.75, 0.01, mat('#ebe5db'), -2.6 + i * 1.04, 0.08, 0.33, 0.01, false);
    rbox(g, 6.3, 0.05, 0.7, mat('#2b2f38', { roughness: 0.3 }), 0, 0.92, 0, 0.02);
    rbox(g, 6.0, 0.7, 0.38, mat('#f7f3ee'), 0, 1.75, -0.14, 0.04);
    rbox(g, 0.6, 0.05, 0.4, mat(C.chrome, { metalness: 0.7, roughness: 0.25 }), 1.4, 0.95, 0, 0.02, false);
    cyl(g, 0.015, 0.015, 0.3, mat(C.chrome, { metalness: 0.7 }), 1.4, 0.95, -0.2, 8, false);
    // máquina de café + vapor
    rbox(g, 0.45, 0.5, 0.4, mat('#2b2f38', { metalness: 0.3, roughness: 0.35 }), -1.5, 0.95, -0.05, 0.05);
    rbox(g, 0.1, 0.04, 0.02, glow('#5aa8ff', 1.5), -1.5, 1.32, 0.16, 0.005, false);
    const steamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
    const puffs = [0, 1, 2, 3].map(() => { const p = sphere(g, 0.05, steamMat, -1.5, 1.1, 0.1, 8, false); p.userData.dynamic = true; return p; });
    ctx.animate = (t) => puffs.forEach((p, i) => {
      const k = (t * 0.0005 + i / 4) % 1;
      p.position.set(-1.5 + Math.sin(k * 6 + i) * 0.04, 1.1 + k * 0.6, 0.12);
      p.scale.setScalar(0.6 + k * 1.8);
      p.material.opacity = 0.45 * (1 - k);
    });
    ['#ff7a6b', '#2f7bff', '#f2a93b', '#1fb59f'].forEach((c, i) => mug(g, -0.6 + i * 0.18, 0.95, 0.05, c));
    cyl(g, 0.18, 0.12, 0.08, mat('#f7f3ee'), 2.5, 0.95, 0, 16, false);
    [[0, 0], [0.07, 0.05], [-0.06, 0.04]].forEach(([dx, dz], i) => sphere(g, 0.06, mat(['#ff6b6b', '#ffd479', '#7ee0c3'][i]), 2.5 + dx, 1.08, dz, 10, false));
    const menu = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshBasicMaterial({ map: labelTexture('CAFÉ ☕', { bg: '#1b2a4a', fg: '#ffd479' }), toneMapped: false }));
    menu.position.set(-0.4, 2.42, -0.3);
    g.add(menu);
  },

  bar_counter(g) {
    rbox(g, 5.0, 0.95, 0.7, mat('#1b2a4a', { roughness: 0.6 }), 0, 0, 0, 0.05);
    rbox(g, 5.15, 0.06, 0.85, mat('#f7f3ee', { roughness: 0.3 }), 0, 0.95, 0, 0.03);
    rbox(g, 4.8, 0.05, 0.02, glow('#f2a93b', 1.2), 0, 0.1, 0.36, 0.01, false);
    ['#ff7a6b', '#2f7bff', '#f2a93b'].forEach((c, i) => mug(g, -1.6 + i * 1.6, 1.01, 0.1, c));
  },

  fridge(g) {
    rbox(g, 0.82, 2.0, 0.78, mat('#dfe5ee', { metalness: 0.35, roughness: 0.3 }), 0, 0, 0, 0.08);
    rbox(g, 0.8, 0.01, 0.02, mat('#b9c2cf'), 0, 1.3, 0.4, 0.005, false);
    [0.9, 1.6].forEach((y) => rbox(g, 0.03, 0.4, 0.04, mat(C.chrome, { metalness: 0.8 }), 0.3, y - 0.2, 0.41, 0.01, false));
  },

  vending(g) {
    rbox(g, 0.95, 1.95, 0.75, mat('#c2263f', { roughness: 0.4 }), 0, 0, 0, 0.05);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.3), new THREE.MeshBasicMaterial({ map: snackTexture(), toneMapped: false }));
    win.position.set(-0.1, 1.1, 0.38);
    g.add(win);
    rbox(g, 0.18, 0.5, 0.02, glow('#5aa8ff', 1.2), 0.33, 1.2, 0.38, 0.01, false);
    rbox(g, 0.6, 0.18, 0.02, mat('#111'), -0.1, 0.2, 0.38, 0.01, false);
  },

  pingpong(g) {
    rbox(g, 2.74, 0.05, 1.52, mat('#1d6b4f', { roughness: 0.5 }), 0, 0.7, 0, 0.01);
    rbox(g, 0.02, 0.005, 1.52, mat('#ffffff'), 0, 0.751, 0, 0.001, false);
    rbox(g, 2.74, 0.005, 0.02, mat('#ffffff'), 0, 0.751, 0, 0.001, false);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.15), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    net.rotation.y = Math.PI / 2; net.position.set(0, 0.83, 0); g.add(net);
    [[-1.1, -0.6], [1.1, -0.6], [-1.1, 0.6], [1.1, 0.6]].forEach(([x, z]) => rbox(g, 0.06, 0.7, 0.06, mat(C.metal), x, 0, z, 0.01));
    [[-0.9, 0.3, '#ff5d6e'], [0.8, -0.35, '#2f7bff']].forEach(([x, z, c]) => {
      cyl(g, 0.08, 0.08, 0.015, mat(c), x, 0.755, z, 16, false);
      rbox(g, 0.03, 0.015, 0.1, mat(C.oak), x, 0.755, z + 0.12, 0.005, false);
    });
    sphere(g, 0.025, mat('#ffffff'), 0.3, 0.78, 0.2, 8, false);
  },

  foosball(g) {
    rbox(g, 1.4, 0.25, 0.8, mat(C.walnut, { roughness: 0.5 }), 0, 0.65, 0, 0.03);
    rbox(g, 1.3, 0.02, 0.7, mat('#2e8b57'), 0, 0.72, 0, 0.005, false);
    [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]].forEach(([x, z]) => rbox(g, 0.08, 0.65, 0.08, mat(C.walnut), x, 0, z, 0.01));
    for (let i = 0; i < 6; i++) {
      const x = -0.55 + i * 0.22;
      const rod = cyl(g, 0.012, 0.012, 1.1, mat(C.chrome, { metalness: 0.8 }), x, 0.83, 0, 6, false);
      rod.rotation.x = Math.PI / 2; rod.position.set(x, 0.83, 0);
      for (let k = -1; k <= 1; k++) rbox(g, 0.04, 0.12, 0.05, mat(i % 2 ? '#ff5d6e' : '#2f7bff'), x, 0.73, k * 0.2, 0.01, false);
    }
  },

  arcade(g, it, ctx) {
    rbox(g, 0.78, 1.75, 0.72, mat('#2b1f5c', { roughness: 0.4 }), 0, 0, -0.02, 0.04);
    rbox(g, 0.7, 0.18, 0.4, mat('#1a1340'), 0, 0.95, 0.22, 0.03);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.45), new THREE.MeshBasicMaterial({ map: gameScreenTexture(ctx.index + 1), toneMapped: false }));
    scr.position.set(0, 1.38, 0.345); scr.rotation.x = -0.15;
    g.add(scr);
    rbox(g, 0.74, 0.16, 0.04, glow(ctx.index % 2 ? '#ff4fd8' : '#4fe3ff', 2), 0, 1.75, 0.32, 0.02, false);
    cyl(g, 0.02, 0.02, 0.08, mat('#111'), -0.15, 1.13, 0.3, 8, false);
    sphere(g, 0.04, mat('#ff5d6e'), -0.15, 1.22, 0.3, 10, false);
    ['#ffd479', '#4fe3ff', '#6bff4f'].forEach((c, i) => cyl(g, 0.03, 0.03, 0.02, glow(c, 1), 0.05 + i * 0.09, 1.13, 0.32, 12, false));
  },
};

function sofa(g, it, width, n) {
  const m = fabric(it.color || C.sofa);
  const cush = fabric(new THREE.Color(it.color || C.sofa).lerp(new THREE.Color('#ffffff'), 0.12).getStyle());
  rbox(g, width, 0.3, 0.95, m, 0, 0.06, 0, 0.12);
  rbox(g, width, 0.62, 0.28, m, 0, 0.06, -0.38, 0.12);
  [-1, 1].forEach((s) => rbox(g, 0.28, 0.5, 0.95, m, s * (width / 2 - 0.1), 0.06, 0, 0.12));
  const cw = (width - 0.5) / n;
  for (let i = 0; i < n; i++) rbox(g, cw - 0.04, 0.12, 0.7, cush, -((width - 0.5) / 2) + cw * (i + 0.5), 0.34, 0.08, 0.06);
  [[-0.35, '#f2a93b'], [0.35, '#f7f3ee']].forEach(([f, c]) => { const p = rbox(g, 0.42, 0.38, 0.14, fabric(c), f * width, 0.42, -0.2, 0.07); p.rotation.x = -0.25; });
  [-1, 1].forEach((s) => [-0.35, 0.35].forEach((z) => cyl(g, 0.03, 0.02, 0.07, mat(C.oak), s * (width / 2 - 0.12), 0, z, 6, false)));
}

function plant(g, s, potColor, kind) {
  pot(g, s, potColor);
  const m = plantMats();
  if (kind === 0) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const leaf = sphere(g, 0.2 * s, m[i % 3], Math.cos(a) * 0.16 * s, (0.75 + (i % 3) * 0.15) * s, Math.sin(a) * 0.16 * s, 10);
      leaf.scale.set(0.55, 1.6, 0.55);
      leaf.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
    }
  } else if (kind === 1) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * s, 1), m[1]);
    crown.position.y = 0.95 * s; crown.castShadow = true; g.add(crown);
    sphere(g, 0.26 * s, m[2], 0.18 * s, 1.25 * s, 0.05 * s, 10);
  } else {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const stem = cyl(g, 0.012 * s, 0.012 * s, 0.6 * s, m[1], Math.cos(a) * 0.05 * s, 0.42 * s, Math.sin(a) * 0.05 * s, 4, false);
      stem.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      const leaf = sphere(g, 0.13 * s, m[i % 3], Math.cos(a) * 0.28 * s, 0.98 * s, Math.sin(a) * 0.28 * s, 8);
      leaf.scale.set(1.3, 0.35, 0.8);
      leaf.rotation.y = -a;
    }
  }
}

// Constrói todos os móveis. merge=true junta tudo (rápido); false deixa cada item separado (editor).
export function buildFurniture(items, { merge = true } = {}) {
  const root = new THREE.Group();
  const obstacles = [];
  const clickables = [];
  const desks = new Map();
  const seats = new Map();
  const groups = new Map();
  const animators = [];
  const counts = {};
  for (const it of items) {
    const def = CATALOG[it.type];
    const builder = BUILD[it.type];
    if (!def || !builder) continue;
    const g = group(root, it.x, 0, it.z, it.rot || 0);
    g.userData.itemId = it.id;
    const ctx = { index: (counts[it.type] = (counts[it.type] || 0) + 1) - 1 };
    builder(g, it, ctx);
    if (ctx.animate) animators.push(ctx.animate);
    groups.set(it.id, g);
    const fp = itemFootprint(it);
    if (fp) obstacles.push(fp);
    for (const s of itemSeats(it)) {
      seats.set(s.id, s);
      if (!s.desk) {
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
        h.position.set(s.x, 0.5, s.z);
        h.userData = { kind: 'seat', id: s.id };
        root.add(h);
        clickables.push(h);
      }
    }
    if (ctx.desk) {
      desks.set(it.id, { group: g, ring: ctx.desk.ring, ringMat: ctx.desk.ringMat, item: it, seat: itemSeats(it)[0] });
    }
    g.traverse((o) => { if (o.userData.kind === 'desk') clickables.push(o); });
  }
  if (merge) mergeStatic(root);
  root.updateMatrixWorld(true);
  return {
    root, obstacles, clickables, desks, seats, groups,
    animate(t) { for (const a of animators) a(t); },
  };
}

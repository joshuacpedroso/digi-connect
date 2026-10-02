// O escritório DIGI — maquete isométrica procedural (estilo SoWork).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DESKS, SEATS, DESK } from '../../shared/layout.js';
import {
  mat, rbox, cyl, sphere, group,
  woodTexture, tileTexture, carpetTexture, rugTexture, signTexture, artTexture, screenTexture, windowSkyTexture,
} from './kit.js';

export const POD_COLORS = { 'Operações': '#2f7bff', 'Criação': '#ff7a6b', 'Tech': '#1fb59f', 'Comercial': '#f2a93b' };

const C = {
  wall: '#f6f2ec', wallTop: '#3b4050', trim: '#e2dbd0', navy: '#1b2a4a', deskTop: '#fbfaf7', oak: '#c99a64',
  metal: '#2c313c', glass: '#bfe3ff', plant: '#3f9b5a', plant2: '#2f8150', plant3: '#5bb36b', pot: '#d77b55', potWhite: '#f1efea',
  sofa: '#2a7f7a', cushion: '#f2a93b', screen: '#0f1f3d',
};

export function buildOffice(scene) {
  const root = group(scene);
  const obstacles = [];
  const clickables = [];
  const desks = new Map();
  const animators = [];
  const block = (x0, x1, z0, z1) => obstacles.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
  const blockAt = (x, z, w, d) => block(x - w / 2, x + w / 2, z - d / 2, z + d / 2);

  // ------------------------------------------------------------ ilha / exterior
  rbox(root, 48, 1.4, 36, mat('#9ccf86', { roughness: 1 }), 0, -1.75, 0, 0.6, false).receiveShadow = true;
  rbox(root, 47, 2.4, 35, mat('#b98a5e', { roughness: 1 }), 0, -4.1, 0, 0.6, false);
  // trilha até a recepção
  for (let i = 0; i < 4; i++) rbox(root, 1.6, 0.06, 0.9, mat('#e9e2d6'), 1, -0.38, 13.2 + i * 1.15, 0.12, false);

  const treeMats = [mat(C.plant, { flatShading: true }), mat(C.plant2, { flatShading: true }), mat(C.plant3, { flatShading: true })];
  const tree = (x, z, s = 1) => {
    const g = group(root, x, -0.35, z);
    cyl(g, 0.12 * s, 0.18 * s, 1.4 * s, mat('#8a5a3b'), 0, 0, 0, 8);
    const m = treeMats[Math.floor(Math.abs(x * 7 + z * 3)) % 3];
    [[0, 1.9, 0, 1], [0.35, 1.55, 0.2, 0.75], [-0.3, 1.6, -0.15, 0.7]].forEach(([dx, dy, dz, r]) => {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 * s * r, 0), m);
      leaf.position.set(dx * s, dy * s, dz * s);
      leaf.castShadow = true;
      g.add(leaf);
    });
    g.userData.dynamic = true;
    animators.push((t) => { g.rotation.z = Math.sin(t * 0.0006 + x) * 0.012; });
  };
  [[-21, -14.5, 1.3], [-16, -14.6, 1.1], [-10, -14.8, 1.4], [-3, -14.5, 1.0], [4, -14.7, 1.3], [11, -14.6, 1.2], [18, -14.5, 1.4], [22.3, -12, 1.1],
    [-21.5, -9, 1.2], [-21.3, -3, 1.0], [-21.6, 3, 1.3], [-21.2, 9, 1.1], [-20.8, 14.6, 0.9]].forEach((t) => tree(...t));
  const bush = (x, z, s = 1) => {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * s, 1), treeMats[(Math.abs(Math.round(x + z))) % 3]);
    b.position.set(x, -0.2 + 0.3 * s, z); b.scale.y = 0.7; b.castShadow = true; root.add(b);
  };
  [[21, 14.5, 1.2], [22, 6, 1], [21.5, -2, 1.1], [14, 15.2, 0.9], [-6, 15.3, 1], [-14, 15, 1.1], [5, 15.4, 0.8], [-2.5, 14.8, 0.7]].forEach((b) => bush(...b));

  // ------------------------------------------------------------ piso
  const slab = rbox(root, 36.6, 0.42, 24.6, mat('#efe9df'), 0, -0.42, 0, 0.12);
  slab.castShadow = false;
  const floorMat = new THREE.MeshStandardMaterial({ map: woodTexture([226, 190, 146], [9, 6]), roughness: 0.62 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 24), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  floor.receiveShadow = true;
  root.add(floor);

  const floorPatch = (x0, x1, z0, z1, material, y = 0.006) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), material);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.receiveShadow = true;
    root.add(m);
    return m;
  };
  floorPatch(5, 18, -12, -3, new THREE.MeshStandardMaterial({ map: carpetTexture('#34436a', [4, 3]), roughness: 1 }));
  floorPatch(-1, 4, -12, -9.2, new THREE.MeshStandardMaterial({ map: carpetTexture('#8f84c9', [2, 1]), roughness: 1 }));
  floorPatch(-18, -7, 5, 12, new THREE.MeshStandardMaterial({ map: tileTexture('#f7f3ee', '#e3ddd3', [5.5, 3.5]), roughness: 0.5 }));

  // ------------------------------------------------------------ paredes
  const wallMat = mat(C.wall, { roughness: 0.92 });
  const capMat = mat(C.wallTop, { roughness: 0.6 });
  const WALL_H = 3.0;
  rbox(root, 36.6, WALL_H, 0.3, wallMat, 0, 0, -12.15, 0.02);
  rbox(root, 36.6, 0.06, 0.32, capMat, 0, WALL_H, -12.15, 0.01, false);
  rbox(root, 0.3, WALL_H, 24.6, wallMat, -18.15, 0, 0, 0.02);
  rbox(root, 0.32, 0.06, 24.6, capMat, -18.15, WALL_H, 0, 0.01, false);
  rbox(root, 36, 0.12, 0.04, mat(C.trim), 0, 0, -11.99, 0.01, false);
  rbox(root, 0.04, 0.12, 24, mat(C.trim), -17.99, 0, 0, 0.01, false);
  // parede de destaque azul-marinho atrás da área de trabalho
  rbox(root, 9.4, WALL_H - 0.12, 0.05, mat(C.navy, { roughness: 0.85 }), -10.7, 0.12, -11.97, 0.01, false);
  block(-18.5, 18.5, -12.5, -11.92);
  block(-18.5, -17.92, -12.5, 12.5);

  const sky = new THREE.MeshBasicMaterial({ map: windowSkyTexture() });
  const frameMat = mat('#ffffff', { roughness: 0.4 });
  const windowN = (x, w) => {
    const g = group(root, x, 0.85, -11.97);
    rbox(g, w + 0.16, 1.76, 0.08, frameMat, 0, 0, 0.02, 0.03, false);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.6), sky);
    pane.position.set(0, 0.88, 0.07);
    g.add(pane);
    rbox(g, 0.05, 1.6, 0.05, frameMat, 0, 0.08, 0.09, 0.01, false);
    rbox(g, w, 0.05, 0.05, frameMat, 0, 0.9, 0.09, 0.01, false);
    rbox(g, w + 0.3, 0.06, 0.18, frameMat, 0, -0.04, 0.1, 0.02, false);
  };
  const windowW = (z, w) => {
    const g = group(root, -17.97, 0.85, z, Math.PI / 2);
    rbox(g, w + 0.16, 1.76, 0.08, frameMat, 0, 0, 0.02, 0.03, false);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.6), sky);
    pane.position.set(0, 0.88, 0.07);
    g.add(pane);
    rbox(g, 0.05, 1.6, 0.05, frameMat, 0, 0.08, 0.09, 0.01, false);
    rbox(g, w, 0.05, 0.05, frameMat, 0, 0.9, 0.09, 0.01, false);
    rbox(g, w + 0.3, 0.06, 0.18, frameMat, 0, -0.04, 0.1, 0.02, false);
  };
  windowN(-16.1, 2.4); windowN(-5.2, 2.6); windowN(7.4, 2.2); windowN(15.7, 2.2);
  windowW(-9.6, 2.4); windowW(-5.0, 2.4); windowW(2.8, 2.4);

  // letreiro DIGI CONNECT
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: signTexture('CONNECT', 'Trabalhe perto, mesmo estando longe'), transparent: true }));
  sign.position.set(-10.7, 1.95, -11.93);
  root.add(sign);
  const glow = new THREE.PointLight('#5aa8ff', 2.2, 6, 2);
  glow.position.set(-10.7, 1.9, -11.2);
  root.add(glow);

  // quadros
  const art = (x, y, z, ry, seed, palette, w = 0.9, h = 1.1) => {
    const g = group(root, x, y, z, ry);
    rbox(g, w + 0.1, h + 0.1, 0.05, mat('#2b2f38'), 0, 0, 0, 0.01, false);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: artTexture(seed, palette), roughness: 0.9 }));
    p.position.set(0, (h + 0.1) / 2, 0.03);
    g.add(p);
  };
  art(-17.97, 1.0, -1.9, Math.PI / 2, 4, ['#ffe8d6', '#ff7a6b', '#2f7bff', '#f2a93b']);
  art(-17.97, 1.25, -0.7, Math.PI / 2, 9, ['#e8f4ff', '#1fb59f', '#1b2a4a', '#ffd479'], 0.7, 0.8);
  art(-2.6, 1.0, -11.95, 0, 21, ['#f3ecff', '#7c5cff', '#ff8fa3', '#2f7bff'], 0.8, 1.0);

  // ------------------------------------------------------------ helpers de mobília
  const plantMat = [mat(C.plant), mat(C.plant2), mat(C.plant3)];
  const plant = (x, z, s = 1, potColor = C.pot, kind = 0) => {
    const g = group(root, x, 0, z);
    cyl(g, 0.24 * s, 0.18 * s, 0.42 * s, mat(potColor, { roughness: 0.7 }), 0, 0, 0, 20);
    cyl(g, 0.21 * s, 0.21 * s, 0.03 * s, mat('#5a3d2b'), 0, 0.41 * s, 0, 20, false);
    if (kind === 0) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const leaf = sphere(g, 0.2 * s, plantMat[i % 3], Math.cos(a) * 0.16 * s, (0.75 + (i % 3) * 0.14) * s, Math.sin(a) * 0.16 * s, 10);
        leaf.scale.set(0.55, 1.5, 0.55);
        leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      }
    } else {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * s, 1), plantMat[kind % 3]);
      crown.position.y = 0.95 * s; crown.castShadow = true; g.add(crown);
      sphere(g, 0.26 * s, plantMat[(kind + 1) % 3], 0.18 * s, 1.25 * s, 0.05 * s, 10);
    }
    g.userData.dynamic = true;
    animators.push((t) => { g.rotation.z = Math.sin(t * 0.0011 + x * 2) * 0.02; });
    blockAt(x, z, 0.55 * s, 0.55 * s);
    return g;
  };

  const chairOffice = (parent, color, x = 0, z = 0, ry = 0) => {
    const g = group(parent, x, 0, z, ry);
    const seatMat = mat(color, { roughness: 0.7 });
    cyl(g, 0.03, 0.03, 0.3, mat(C.metal, { metalness: 0.4, roughness: 0.4 }), 0, 0.05, 0, 10);
    for (let i = 0; i < 5; i++) {
      const leg = rbox(g, 0.05, 0.03, 0.26, mat(C.metal), 0, 0.03, 0, 0.01, false);
      leg.rotation.y = (i / 5) * Math.PI * 2;
      leg.position.set(Math.sin(leg.rotation.y) * 0.12, 0.045, Math.cos(leg.rotation.y) * 0.12);
    }
    rbox(g, 0.46, 0.08, 0.44, seatMat, 0, 0.33, 0, 0.04);
    rbox(g, 0.44, 0.48, 0.07, seatMat, 0, 0.45, -0.22, 0.035);
    return g;
  };

  // ------------------------------------------------------------ área de trabalho (ilhas)
  const screens = ['code', 'chart', 'ui'].map(screenTexture);
  const pods = new Map();
  for (const d of DESKS) {
    if (!pods.has(d.zone)) pods.set(d.zone, []);
    pods.get(d.zone).push(d);
  }
  for (const [team, list] of pods) {
    const cx = list.reduce((a, d) => a + d.x, 0) / list.length;
    const cz = list.reduce((a, d) => a + d.z, 0) / list.length;
    const color = POD_COLORS[team];
    // tapete da ilha
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.9), new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#f4efe8'), 0.82), roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(cx, 0.008, cz); rug.receiveShadow = true; root.add(rug);
    // divisória acústica no meio
    rbox(root, 3.1, 0.34, 0.05, mat(color, { roughness: 0.95 }), cx, DESK.h, cz, 0.02);
    blockAt(cx, cz, 3.12, 1.66);
  }

  for (const d of DESKS) {
    const color = POD_COLORS[d.zone];
    const g = group(root, d.x, 0, d.z, d.face);
    // tampo + pés
    rbox(g, DESK.w, 0.05, DESK.d, mat(C.deskTop, { roughness: 0.45 }), 0, DESK.h - 0.05, 0, 0.02);
    rbox(g, DESK.w - 0.02, 0.02, DESK.d - 0.02, mat(C.oak), 0, DESK.h - 0.065, 0, 0.005, false);
    [-1, 1].forEach((sx) => rbox(g, 0.05, DESK.h - 0.05, DESK.d - 0.1, mat(C.metal), sx * (DESK.w / 2 - 0.08), 0, 0, 0.015));
    // monitor (de frente para quem senta)
    const mon = group(g, 0, DESK.h, 0.16);
    rbox(mon, 0.24, 0.015, 0.16, mat(C.metal), 0, 0, 0, 0.007, false);
    rbox(mon, 0.04, 0.2, 0.04, mat(C.metal), 0, 0, 0.02, 0.01, false);
    rbox(mon, 0.76, 0.44, 0.035, mat('#1d2230'), 0, 0.17, 0, 0.02);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.38), new THREE.MeshBasicMaterial({ map: screens[DESKS.indexOf(d) % 3], toneMapped: false }));
    scr.position.set(0, 0.39, -0.02); scr.rotation.y = Math.PI;
    mon.add(scr);
    // teclado, mouse, caneca
    rbox(g, 0.42, 0.015, 0.13, mat('#e9ecf2'), -0.05, DESK.h, -0.16, 0.006, false);
    rbox(g, 0.06, 0.02, 0.09, mat('#e9ecf2'), 0.27, DESK.h, -0.16, 0.02, false);
    cyl(g, 0.04, 0.04, 0.09, mat(color), -0.52, DESK.h, 0.05, 12, false);
    if (DESKS.indexOf(d) % 2) {
      cyl(g, 0.06, 0.05, 0.1, mat(C.potWhite), 0.55, DESK.h, 0.18, 12, false);
      sphere(g, 0.09, plantMat[DESKS.indexOf(d) % 3], 0.55, DESK.h + 0.16, 0.18, 8, false);
    }
    // cadeira
    const chair = chairOffice(g, color, 0, -0.78, 0);
    // anel de status no chão
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.015, -0.78);
    ring.userData.dynamic = true;
    g.add(ring);
    // área clicável
    const hit = new THREE.Mesh(new THREE.BoxGeometry(DESK.w + 0.1, 1.2, 1.9), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, 0.6, -0.4);
    hit.userData = { kind: 'desk', id: d.id };
    g.add(hit);
    clickables.push(hit);
    desks.set(d.id, { group: g, ring, ringMat, chair, desk: d });
  }

  // ------------------------------------------------------------ sala de reunião
  const glassMat = new THREE.MeshPhysicalMaterial({ color: C.glass, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, depthWrite: false });
  const postMat = mat('#2c3240', { roughness: 0.5 });
  const glassWall = (x0, z0, x1, z1, h = 2.6) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g = group(root, (x0 + x1) / 2, 0, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0));
    const pane = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.04), glassMat);
    pane.position.y = h / 2; pane.renderOrder = 2; g.add(pane);
    rbox(g, len, 0.06, 0.08, postMat, 0, h - 0.03, 0, 0.01, false);
    rbox(g, len, 0.05, 0.08, postMat, 0, 0, 0, 0.01, false);
    const n = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i <= n; i++) rbox(g, 0.06, h, 0.08, postMat, -len / 2 + (i * len) / n, 0, 0, 0.01);
    // faixa jateada
    const frost = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.18), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    frost.position.set(0, 1.25, 0.03); g.add(frost);
    block(Math.min(x0, x1) - 0.08, Math.max(x0, x1) + 0.08, Math.min(z0, z1) - 0.08, Math.max(z0, z1) + 0.08);
  };
  glassWall(5, -12, 5, -3);
  glassWall(5, -3, 6.0, -3);
  glassWall(7.4, -3, 18, -3);
  // porta aberta (folha de vidro girada)
  const door = group(root, 7.4, 0, -3, -Math.PI / 2.6);
  const doorPane = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.4, 0.04), glassMat);
  doorPane.position.set(-0.68, 1.2, 0); door.add(doorPane);
  rbox(door, 0.04, 0.5, 0.08, postMat, -1.25, 0.9, 0, 0.01);

  const mx = 11.5, mz = -7.5;
  rbox(root, 5.5, 0.08, 2.0, mat('#d9b48a', { roughness: 0.5 }), mx, 0.58, mz, 0.06);
  rbox(root, 5.3, 0.03, 1.8, mat('#f7f3ee', { roughness: 0.4 }), mx, 0.66, mz, 0.03, false);
  [-1.8, 1.8].forEach((dx) => {
    rbox(root, 0.2, 0.58, 1.1, mat(C.metal), mx + dx, 0, mz, 0.04);
    rbox(root, 0.5, 0.04, 1.3, mat(C.metal), mx + dx, 0, mz, 0.02);
  });
  blockAt(mx, mz, 5.6, 2.1);
  // laptops e garrafas na mesa
  [[-1.8, -0.5, 0], [0, 0.5, Math.PI], [1.8, -0.5, 0]].forEach(([dx, dz, r]) => {
    const lg = group(root, mx + dx, 0.69, mz + dz, r);
    rbox(lg, 0.4, 0.02, 0.28, mat('#c7ccd6', { metalness: 0.5, roughness: 0.35 }), 0, 0, 0, 0.01, false);
    const lid = rbox(lg, 0.4, 0.26, 0.015, mat('#c7ccd6', { metalness: 0.5, roughness: 0.35 }), 0, 0.01, 0.13, 0.008, false);
    lid.rotation.x = -0.25;
  });
  cyl(root, 0.05, 0.05, 0.22, mat('#7ee0c3', { roughness: 0.2 }), mx - 0.6, 0.69, mz + 0.1, 12, false);
  cyl(root, 0.05, 0.05, 0.22, mat('#ff8fa3', { roughness: 0.2 }), mx + 0.7, 0.69, mz - 0.2, 12, false);
  // TV
  rbox(root, 3.4, 1.95, 0.08, mat('#151a24'), mx, 0.95, -11.95, 0.04);
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.78), new THREE.MeshBasicMaterial({ map: screenTexture('chart'), toneMapped: false }));
  tv.position.set(mx, 1.92, -11.89);
  root.add(tv);
  rbox(root, 2.2, 0.32, 0.4, mat('#2b2f38'), mx, 0, -11.65, 0.04);
  // pendentes
  [-1.4, 1.4].forEach((dx) => {
    const pg = group(root, mx + dx, 0, mz);
    cyl(pg, 0.006, 0.006, 1.2, mat('#222'), 0, 2.2, 0, 4, false);
    cyl(pg, 0.08, 0.32, 0.28, mat('#1b2a4a', { roughness: 0.4 }), 0, 1.92, 0, 24);
    const bulb = sphere(pg, 0.08, new THREE.MeshBasicMaterial({ color: '#fff3c4' }), 0, 1.92, 0, 12, false);
    bulb.castShadow = false;
  });
  plant(5.55, -11.4, 1.1, C.potWhite, 1);
  plant(17.4, -11.4, 1.2, C.pot, 0);
  plant(17.4, -3.6, 0.9, C.potWhite, 2);

  // ------------------------------------------------------------ cabines de foco
  const panelMat = mat('#b9b0e6', { roughness: 0.95 });
  [-1, 1.5, 4].forEach((x) => { rbox(root, 0.12, 2.4, 2.8, panelMat, x, 0, -10.6, 0.03); block(x - 0.1, x + 0.1, -12, -9.2); });
  [[-1, -0.25], [0.75, 1.5], [1.5, 2.25], [3.25, 4]].forEach(([a, b]) => glassWall(a, -9.2, b, -9.2, 2.4));
  [0.25, 2.75].forEach((x, i) => {
    rbox(root, 1.3, 0.04, 0.6, mat(C.deskTop, { roughness: 0.45 }), x, 0.6, -11.55, 0.02);
    rbox(root, 1.2, 0.6, 0.04, mat(C.oak), x, 0, -11.82, 0.01);
    blockAt(x, -11.55, 1.32, 0.66);
    const lg = group(root, x, 0.64, -11.55);
    rbox(lg, 0.36, 0.02, 0.25, mat('#c7ccd6', { metalness: 0.5, roughness: 0.35 }), 0, 0, 0, 0.01, false);
    const lid = rbox(lg, 0.36, 0.24, 0.015, mat('#c7ccd6', { metalness: 0.5, roughness: 0.35 }), 0, 0.01, -0.12, 0.008, false);
    lid.rotation.x = 0.25;
    cyl(root, 0.06, 0.08, 0.02, mat('#2b2f38'), x + 0.45, 0.64, -11.6, 12, false);
    cyl(root, 0.012, 0.012, 0.35, mat('#2b2f38'), x + 0.45, 0.64, -11.6, 6, false);
    cyl(root, 0.03, 0.09, 0.1, mat(i ? '#ffb547' : '#7ee0c3'), x + 0.45, 0.95, -11.6, 16, false);
    chairOffice(root, i ? '#7c5cff' : '#1fb59f', x, -10.55, Math.PI);
  });

  // ------------------------------------------------------------ café
  const barMat = mat('#1b2a4a', { roughness: 0.6 });
  rbox(root, 0.7, 0.95, 5.0, barMat, -15.95, 0, 8.2, 0.05);
  rbox(root, 0.85, 0.06, 5.15, mat('#f7f3ee', { roughness: 0.3 }), -15.95, 0.95, 8.2, 0.03);
  block(-16.35, -15.5, 5.6, 10.8);
  // armários e bancada de fundo
  rbox(root, 0.65, 0.92, 6.2, mat('#f7f3ee'), -17.5, 0, 8.6, 0.04);
  rbox(root, 0.7, 0.05, 6.3, mat(C.oak), -17.5, 0.92, 8.6, 0.02);
  rbox(root, 0.4, 0.75, 6.0, mat('#f7f3ee'), -17.75, 1.85, 8.6, 0.04);
  block(-17.95, -17.1, 5.4, 11.8);
  // geladeira
  rbox(root, 0.8, 2.1, 0.8, mat('#dfe5ee', { metalness: 0.3, roughness: 0.3 }), -17.4, 0, 11.3, 0.08);
  block(-17.85, -16.95, 10.85, 11.75);
  // máquina de café + vapor
  rbox(root, 0.45, 0.5, 0.4, mat('#2b2f38', { metalness: 0.3, roughness: 0.35 }), -17.5, 0.95, 7.1, 0.05);
  cyl(root, 0.05, 0.05, 0.08, mat('#ffffff'), -17.4, 0.97, 7.1, 12, false);
  const steamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
  const puffs = [0, 1, 2, 3].map(() => sphere(root, 0.05, steamMat, -17.4, 1.1, 7.1, 8, false));
  puffs.forEach((p) => { p.userData.dynamic = true; });
  animators.push((t) => puffs.forEach((p, i) => {
    const k = ((t * 0.0005 + i / 4) % 1);
    p.position.set(-17.4 + Math.sin(k * 6 + i) * 0.04, 1.1 + k * 0.6, 7.1);
    p.scale.setScalar(0.6 + k * 1.8);
    p.material.opacity = 0.45 * (1 - k);
  }));
  // canecas e frutas
  ['#ff7a6b', '#2f7bff', '#f2a93b', '#1fb59f'].forEach((c, i) => cyl(root, 0.045, 0.04, 0.09, mat(c), -15.9, 1.01, 6.3 + i * 0.35, 12, false));
  cyl(root, 0.18, 0.12, 0.08, mat('#f7f3ee'), -15.95, 1.01, 9.8, 16, false);
  [[0, 0], [0.07, 0.05], [-0.06, 0.04]].forEach(([dx, dz], i) => sphere(root, 0.06, mat(['#ff6b6b', '#ffd479', '#7ee0c3'][i]), -15.95 + dx, 1.12, 9.8 + dz, 10, false));
  // banquetas
  SEATS.filter((s) => s.kind === 'stool').forEach((s) => {
    cyl(root, 0.025, 0.025, 0.45, mat(C.metal), s.x, 0, s.z, 8);
    cyl(root, 0.17, 0.2, 0.02, mat(C.metal), s.x, 0, s.z, 16, false);
    cyl(root, 0.2, 0.18, 0.06, mat('#f2a93b', { roughness: 0.6 }), s.x, 0.45, s.z, 20);
  });
  // menu
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial({ map: signTexture('CAFÉ', 'espresso · latte · chá · água'), toneMapped: false }));
  menu.position.set(-17.97, 2.55, 6.3); menu.rotation.y = Math.PI / 2;
  root.add(menu);
  // mesas redondas
  [[-11.5, 7.2], [-9, 10]].forEach(([x, z]) => {
    cyl(root, 0.55, 0.55, 0.04, mat('#f7f3ee', { roughness: 0.35 }), x, 0.6, z, 32);
    cyl(root, 0.04, 0.04, 0.6, mat(C.metal), x, 0, z, 8);
    cyl(root, 0.3, 0.3, 0.03, mat(C.metal), x, 0, z, 20, false);
    sphere(root, 0.08, plantMat[1], x, 0.72, z, 10, false);
    blockAt(x, z, 1.1, 1.1);
  });
  SEATS.filter((s) => s.id.startsWith('cafe-')).forEach((s) => {
    const g = group(root, s.x, 0, s.z, s.face);
    [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].forEach(([a, b]) => cyl(g, 0.018, 0.018, 0.36, mat(C.oak), a, 0, b, 6));
    rbox(g, 0.42, 0.06, 0.42, mat('#ff7a6b', { roughness: 0.7 }), 0, 0.34, 0, 0.03);
    rbox(g, 0.42, 0.36, 0.05, mat('#ff7a6b', { roughness: 0.7 }), 0, 0.4, -0.2, 0.025);
  });
  plant(-7.6, 11.4, 1.1, C.potWhite, 0);
  plant(-12.8, 11.4, 0.9, C.pot, 1);

  // ------------------------------------------------------------ recepção
  const recMat = mat('#f7f3ee', { roughness: 0.4 });
  rbox(root, 3.4, 1.0, 0.8, recMat, 1, 0, 9.3, 0.12);
  rbox(root, 3.6, 0.06, 1.0, mat(C.oak, { roughness: 0.5 }), 1, 1.0, 9.3, 0.03);
  rbox(root, 3.0, 0.08, 0.02, new THREE.MeshBasicMaterial({ color: '#2f7bff' }), 1, 0.25, 9.71, 0.01, false);
  const recSign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map: signTexture('CONNECT'), transparent: true, toneMapped: false }));
  recSign.position.set(1, 0.58, 9.72);
  root.add(recSign);
  blockAt(1, 9.3, 3.6, 1.0);
  const recMon = group(root, 1.6, 1.06, 9.2, Math.PI);
  rbox(recMon, 0.6, 0.36, 0.03, mat('#1d2230'), 0, 0.1, 0, 0.02, false);
  rbox(recMon, 0.04, 0.12, 0.04, mat(C.metal), 0, 0, 0.03, 0.01, false);
  sphere(root, 0.12, mat('#ffffff', { roughness: 0.2 }), 0.2, 1.17, 9.25, 12, false);
  plant(-1.4, 9.4, 1.3, C.potWhite, 2);
  plant(3.4, 9.4, 1.3, C.potWhite, 0);
  // tapete de boas-vindas
  const welcome = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshStandardMaterial({ map: rugTexture('#ffffff', '#2f6bff', 'welcome'), roughness: 1 }));
  welcome.rotation.x = -Math.PI / 2;
  welcome.rotation.z = Math.PI / 4; welcome.position.set(1, 0.01, 6.4); welcome.receiveShadow = true; root.add(welcome);

  // ------------------------------------------------------------ lounge
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 5.6), new THREE.MeshStandardMaterial({ map: rugTexture('#f3e4cf', '#e7c9a3', 'circles'), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(12.5, 0.01, 6.1); rug.receiveShadow = true; root.add(rug);
  const sofaMat = mat(C.sofa, { roughness: 0.95 });
  const sofa = group(root, 12.55, 0, 3.4);
  rbox(sofa, 5.4, 0.3, 0.95, sofaMat, 0, 0.06, 0, 0.12);
  rbox(sofa, 5.4, 0.62, 0.28, sofaMat, 0, 0.06, -0.38, 0.12);
  [-2.6, 2.6].forEach((x) => rbox(sofa, 0.28, 0.5, 0.95, sofaMat, x, 0.06, 0, 0.12));
  [-1.95, -0.65, 0.65, 1.95].forEach((x) => rbox(sofa, 1.22, 0.12, 0.7, mat('#33918b', { roughness: 0.95 }), x, 0.34, 0.08, 0.06));
  [[-2.0, '#f2a93b'], [1.9, '#ff7a6b'], [0.2, '#f7f3ee']].forEach(([x, c]) => {
    const p = rbox(sofa, 0.42, 0.38, 0.14, mat(c, { roughness: 1 }), x, 0.42, -0.2, 0.07);
    p.rotation.x = -0.25;
  });
  [-2.5, 2.5].forEach((x) => [-0.35, 0.35].forEach((z) => cyl(sofa, 0.03, 0.02, 0.07, mat(C.oak), x, 0, z, 6, false)));
  block(9.8, 15.3, 2.9, 3.85);
  // mesa de centro
  rbox(root, 2.2, 0.08, 1.1, mat(C.oak, { roughness: 0.5 }), 12.5, 0.32, 6.1, 0.08);
  [[-0.95, -0.4], [0.95, -0.4], [-0.95, 0.4], [0.95, 0.4]].forEach(([dx, dz]) => cyl(root, 0.03, 0.03, 0.32, mat(C.metal), 12.5 + dx, 0, 6.1 + dz, 6));
  blockAt(12.5, 6.1, 2.3, 1.2);
  ['#2f7bff', '#ff7a6b'].forEach((c, i) => rbox(root, 0.36, 0.05 + i * 0.03, 0.26, mat(c), 12.1 + i * 0.12, 0.4 + i * 0.05, 6.05, 0.01, false));
  cyl(root, 0.06, 0.08, 0.14, mat(C.potWhite), 13.2, 0.4, 6.1, 12, false);
  sphere(root, 0.13, plantMat[2], 13.2, 0.62, 6.1, 10, false);
  // poltronas
  SEATS.filter((s) => s.kind === 'armchair').forEach((s, i) => {
    const g = group(root, s.x, 0, s.z, s.face);
    const am = mat(i ? '#f2a93b' : '#ff7a6b', { roughness: 0.95 });
    rbox(g, 0.95, 0.3, 0.9, am, 0, 0.06, 0, 0.14);
    rbox(g, 0.95, 0.6, 0.24, am, 0, 0.06, -0.36, 0.12);
    [-0.4, 0.4].forEach((x) => rbox(g, 0.18, 0.44, 0.9, am, x, 0.06, 0, 0.09));
    [-0.38, 0.38].forEach((x) => [-0.35, 0.35].forEach((z) => cyl(g, 0.025, 0.02, 0.07, mat(C.oak), x, 0, z, 6, false)));
    blockAt(s.x, s.z + 0.05, 1.0, 0.95);
  });
  // luminária de chão
  const lamp = group(root, 16.2, 0, 4.0);
  cyl(lamp, 0.18, 0.2, 0.04, mat(C.metal), 0, 0, 0, 16);
  cyl(lamp, 0.015, 0.015, 1.5, mat(C.metal), 0, 0, 0, 6);
  cyl(lamp, 0.18, 0.3, 0.32, mat('#fff4dc', { emissive: '#ffcf86', emissiveIntensity: 0.6 }), 0, 1.45, 0, 24);
  const lampLight = new THREE.PointLight('#ffcf86', 3, 5, 2);
  lampLight.position.set(16.2, 1.5, 4.0);
  root.add(lampLight);
  blockAt(16.2, 4.0, 0.45, 0.45);
  // puffs
  [[16.6, 9.6, '#7c5cff'], [16.4, 7.7, '#1fb59f'], [8.4, 10.6, '#f2a93b']].forEach(([x, z, c]) => {
    const b = sphere(root, 0.45, mat(c, { roughness: 1 }), x, 0.3, z, 20);
    b.scale.set(1, 0.65, 1);
    blockAt(x, z, 0.8, 0.8);
  });
  // estante baixa
  rbox(root, 0.5, 0.75, 3.2, mat('#f7f3ee'), 17.6, 0, 6.2, 0.04);
  block(17.3, 17.9, 4.6, 7.8);
  for (let i = 0; i < 9; i++) {
    const h = 0.18 + (i % 3) * 0.04;
    rbox(root, 0.2, h, 0.06, mat(['#2f7bff', '#ff7a6b', '#f2a93b', '#1fb59f', '#7c5cff'][i % 5]), 17.55, 0.75, 4.9 + i * 0.12, 0.01, false);
  }
  plant(17.5, 8.6, 1.0, C.pot, 1);
  plant(7.6, 0.6, 1.1, C.potWhite, 0);
  plant(17.5, 0.6, 1.3, C.pot, 2);

  // ------------------------------------------------------------ corredor / decoração
  plant(-1.6, -11.4, 1.2, C.pot, 0);
  plant(-17.4, -11.4, 1.3, C.potWhite, 1);
  plant(-17.4, 3.6, 1.0, C.pot, 2);
  plant(-3.6, 3.6, 1.0, C.potWhite, 0);
  plant(-1.6, -5.0, 0.95, C.pot, 1);
  plant(4.4, -2.4, 1.1, C.potWhite, 2);
  // bebedouro
  rbox(root, 0.45, 0.9, 0.45, mat('#f7f3ee'), -17.5, 0, -7.4, 0.06);
  cyl(root, 0.17, 0.17, 0.45, mat('#9fd3ff', { transparent: true, opacity: 0.7, roughness: 0.1 }), -17.5, 0.9, -7.4, 16);
  blockAt(-17.5, -7.4, 0.5, 0.5);
  // banco no corredor
  rbox(root, 2.2, 0.08, 0.5, mat(C.oak), -4.2, 0.38, 3.9, 0.04);
  [-0.9, 0.9].forEach((dx) => rbox(root, 0.08, 0.38, 0.45, mat(C.metal), -4.2 + dx, 0, 3.9, 0.02));
  blockAt(-4.2, 3.9, 2.3, 0.6);

  // ------------------------------------------------------------ assentos públicos (clicáveis)
  const seatChairs = SEATS.filter((s) => s.id.startsWith('meet-'));
  seatChairs.forEach((s) => chairOffice(root, '#e9ecf2', s.x, s.z, s.face));
  for (const s of SEATS) {
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.0, 0.75), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(s.x, 0.5, s.z);
    hit.userData = { kind: 'seat', id: s.id };
    root.add(hit);
    clickables.push(hit);
  }

  mergeStatic(root);

  return {
    root, obstacles, clickables, desks,
    animate(t) { for (const a of animators) a(t); },
  };
}

// Junta toda a mobília estática em poucas malhas (1 por material) — de ~1000 para ~60 draw calls.
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const remove = [];
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.userData.kind) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}`;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
    g.morphAttributes = {};
    g.applyMatrix4(o.matrixWorld);
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

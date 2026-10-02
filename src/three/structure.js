// Estrutura fixa do escritório: ilha/jardim, piso, paredes, janelas, salas de vidro e placas.
import * as THREE from 'three';
import { ROOMS, GLASS, PARTITIONS } from '../../shared/layout.js';
import {
  mat, rbox, cyl, sphere, group, mergeStatic,
  woodTexture, tileTexture, carpetTexture, signTexture, artTexture, windowSkyTexture, noiseTexture, labelTexture,
} from './kit.js';

export function buildStructure(scene) {
  const root = group(scene);
  const obstacles = [];
  const animators = [];
  const block = (x0, x1, z0, z1) => obstacles.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });

  // ------------------------------------------------------------ ilha / jardim
  rbox(root, 50, 1.4, 38, mat('#9ccf86', { roughness: 1, map: noiseTexture('#ffffff', 0.05, 256, [10, 8]) }), 0, -1.75, 0, 0.7, false).receiveShadow = true;
  rbox(root, 49, 2.6, 37, mat('#b98a5e', { roughness: 1 }), 0, -4.3, 0, 0.7, false);
  rbox(root, 49.4, 0.5, 37.4, mat('#8a6a48', { roughness: 1 }), 0, -1.85, 0, 0.5, false);
  // calçada até a recepção + calçada lateral
  const stone = mat('#e9e2d6', { roughness: 0.9 });
  for (let i = 0; i < 5; i++) rbox(root, 1.7, 0.06, 0.9, stone, 1, -0.38, 13.0 + i * 1.12, 0.12, false);
  rbox(root, 44, 0.05, 1.6, mat('#d8d2c6', { roughness: 0.95 }), 0, -0.37, 16.6, 0.2, false);

  const treeMats = ['#3f9b5a', '#2f8150', '#5bb36b'].map((c) => mat(c, { flatShading: true }));
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
  };
  [[-21, -14.5, 1.3], [-16, -14.6, 1.1], [-10, -14.8, 1.4], [-3, -14.5, 1.0], [4, -14.7, 1.3], [11, -14.6, 1.2], [18, -14.5, 1.4], [22.6, -12, 1.1],
    [-21.5, -9, 1.2], [-21.3, -3, 1.0], [-21.6, 3, 1.3], [-21.2, 9, 1.1], [-21.8, 15, 0.9], [23, 15, 0.8]].forEach((t) => tree(...t));
  const bush = (x, z, s = 1) => {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * s, 1), treeMats[Math.abs(Math.round(x + z)) % 3]);
    b.position.set(x, -0.2 + 0.3 * s, z); b.scale.y = 0.7; b.castShadow = true; root.add(b);
  };
  [[21, 13.8, 1.2], [22, 6, 1], [21.5, -2, 1.1], [14, 14.2, 0.9], [-6, 14.3, 1], [-14, 14, 1.1], [5, 14.4, 0.8], [-2.5, 14, 0.7]].forEach((b) => bush(...b));
  // canteiros de flores
  const flowerCols = ['#ff5d6e', '#ffd479', '#ffffff', '#c4b5fd', '#ff9f43'];
  [[-9, 13.6], [9, 13.6], [20.8, 9], [20.8, -6]].forEach(([x, z], k) => {
    rbox(root, 3.2, 0.22, 1.0, mat('#e9e2d6'), x, -0.38, z, 0.1);
    rbox(root, 3.0, 0.06, 0.82, mat('#5a3d2b', { roughness: 1 }), x, -0.17, z, 0.05, false);
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), treeMats[(i + k) % 3]);
      b.position.set(x - 1.2 + i * 0.4, -0.05, z + ((i % 2) - 0.5) * 0.2); b.scale.y = 0.75; b.castShadow = true; root.add(b);
    }
    for (let i = 0; i < 18; i++) sphere(root, 0.075, mat(flowerCols[(i + k) % 5], { roughness: 0.6 }), x - 1.35 + (i % 9) * 0.34, 0.14 + (i % 3) * 0.03, z - 0.2 + Math.floor(i / 9) * 0.4, 8, false);
  });
  // postes de luz
  [[-12, 15.7], [-4, 15.7], [6, 15.7], [14, 15.7]].forEach(([x, z]) => {
    cyl(root, 0.06, 0.08, 2.6, mat('#2b2f38', { metalness: 0.5, roughness: 0.4 }), x, -0.35, z, 10);
    sphere(root, 0.18, new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd88a', emissiveIntensity: 1.2, toneMapped: false }), x, 2.35, z, 14, false);
  });
  // bancos externos
  [[-8, 15.2], [8, 15.2]].forEach(([x, z]) => {
    for (let i = 0; i < 3; i++) rbox(root, 2.0, 0.04, 0.12, mat('#c99a64'), x, 0.05, z - 0.15 + i * 0.15, 0.01);
    [-0.8, 0.8].forEach((dx) => rbox(root, 0.08, 0.42, 0.45, mat('#2b2f38'), x + dx, -0.37, z, 0.02));
  });

  // ------------------------------------------------------------ piso
  rbox(root, 36.6, 0.42, 24.6, mat('#efe9df'), 0, -0.42, 0, 0.12).castShadow = false;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 24), new THREE.MeshStandardMaterial({ map: woodTexture([226, 190, 146], [9, 6]), roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  floor.receiveShadow = true;
  root.add(floor);
  const patch = (x0, x1, z0, z1, material, y = 0.005) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), material);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.receiveShadow = true;
    root.add(m);
  };
  for (const r of ROOMS) patch(r.x0, r.x1, r.z0, r.z1, new THREE.MeshStandardMaterial({ map: carpetTexture(r.floor, [Math.ceil((r.x1 - r.x0) / 3), Math.ceil((r.z1 - r.z0) / 3)]), roughness: 1 }));
  patch(-18, -8, 5, 12, new THREE.MeshStandardMaterial({ map: tileTexture('#f7f3ee', '#e3ddd3', [5, 3.5]), roughness: 0.45 }));

  // luz do sol entrando pelas janelas (manchas suaves no chão)
  const sunTex = new THREE.CanvasTexture((() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,226,170,0.16)'); g.addColorStop(1, 'rgba(255,226,170,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 128);
    return c;
  })());
  const beam = (x, z, w, len, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.set(-Math.PI / 2, 0, ry);
    m.position.set(x, 0.012, z);
    root.add(m);
  };

  // ------------------------------------------------------------ paredes externas
  const wallMat = mat('#f6f2ec', { roughness: 0.92, map: noiseTexture('#ffffff', 0.025, 256, [8, 1]) });
  const capMat = mat('#3b4050', { roughness: 0.6 });
  const H = 3.0;
  rbox(root, 36.6, H, 0.3, wallMat, 0, 0, -12.15, 0.02);
  rbox(root, 36.6, 0.06, 0.32, capMat, 0, H, -12.15, 0.01, false);
  rbox(root, 0.3, H, 24.6, wallMat, -18.15, 0, 0, 0.02);
  rbox(root, 0.32, 0.06, 24.6, capMat, -18.15, H, 0, 0.01, false);
  rbox(root, 36, 0.12, 0.04, mat('#e2dbd0'), 0, 0, -11.99, 0.01, false);
  rbox(root, 0.04, 0.12, 24, mat('#e2dbd0'), -17.99, 0, 0, 0.01, false);
  rbox(root, 9.4, H - 0.12, 0.05, mat('#1b2a4a', { roughness: 0.85 }), -10.7, 0.12, -11.97, 0.01, false);
  // painel de madeira na parede das salas de diretoria
  for (let i = 0; i < 26; i++) rbox(root, 0.22, H - 0.14, 0.04, mat(i % 2 ? '#b98a5e' : '#c99a64', { roughness: 0.6 }), 4.75 + i * 0.25, 0.12, -11.96, 0.01, false);
  block(-18.5, 18.5, -12.5, -11.92);
  block(-18.5, -17.92, -12.5, 12.5);

  const sky = new THREE.MeshBasicMaterial({ map: windowSkyTexture() });
  const frameMat = mat('#ffffff', { roughness: 0.4 });
  const windowAt = (x, z, w, ry) => {
    const g = group(root, x, 0.85, z, ry);
    rbox(g, w + 0.16, 1.76, 0.08, frameMat, 0, 0, 0.02, 0.03, false);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.6), sky);
    pane.position.set(0, 0.88, 0.07);
    g.add(pane);
    rbox(g, 0.05, 1.6, 0.05, frameMat, 0, 0.08, 0.09, 0.01, false);
    rbox(g, w, 0.05, 0.05, frameMat, 0, 0.9, 0.09, 0.01, false);
    rbox(g, w + 0.3, 0.06, 0.18, frameMat, 0, -0.04, 0.1, 0.02, false);
  };
  [[-16.1, 2.4], [-5.2, 2.6]].forEach(([x, w]) => { windowAt(x, -11.97, w, 0); beam(x + 0.6, -10.3, w * 0.9, 3.2, -0.35); });
  [[-9.6, 2.4], [-5.0, 2.4], [2.8, 2.4], [8.6, 2.0]].forEach(([z, w]) => { windowAt(-17.97, z, w, Math.PI / 2); beam(-16.3, z + 0.6, w * 0.9, 3.4, -Math.PI / 2 - 0.35); });

  // letreiro DIGI CONNECT
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: signTexture('CONNECT', 'Trabalhe perto, mesmo estando longe'), transparent: true, toneMapped: false }));
  sign.position.set(-10.7, 1.95, -11.93);
  root.add(sign);

  const art = (x, y, z, ry, seed, palette, w = 0.9, h = 1.1) => {
    const g = group(root, x, y, z, ry);
    rbox(g, w + 0.1, h + 0.1, 0.05, mat('#2b2f38'), 0, 0, 0, 0.01, false);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: artTexture(seed, palette), roughness: 0.9 }));
    p.position.set(0, (h + 0.1) / 2, 0.03);
    g.add(p);
  };
  art(-17.97, 1.0, -2.0, Math.PI / 2, 4, ['#ffe8d6', '#ff7a6b', '#2f7bff', '#f2a93b']);
  art(-17.97, 1.2, 5.9, Math.PI / 2, 9, ['#e8f4ff', '#1fb59f', '#1b2a4a', '#ffd479'], 0.7, 0.8);
  art(-2.6, 1.0, -11.95, 0, 21, ['#f3ecff', '#7c5cff', '#ff8fa3', '#2f7bff'], 0.8, 1.0);
  art(7.75, 1.25, -11.9, 0, 33, ['#fff4e0', '#2f7bff', '#1b2a4a', '#f2a93b'], 1.4, 0.9);
  art(14.5, 1.25, -11.9, 0, 47, ['#fff0f5', '#ff7a6b', '#7c5cff', '#ffd479'], 1.4, 0.9);

  // ------------------------------------------------------------ vidro, divisórias e placas
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0, depthWrite: false });
  const postMat = mat('#2c3240', { roughness: 0.5 });
  const frost = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  for (const [x0, z0, x1, z1] of GLASS) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const h = 2.6;
    const g = group(root, (x0 + x1) / 2, 0, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0));
    const pane = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.04), glassMat);
    pane.position.y = h / 2; pane.renderOrder = 2; g.add(pane);
    rbox(g, len, 0.06, 0.08, postMat, 0, h - 0.03, 0, 0.01, false);
    rbox(g, len, 0.05, 0.08, postMat, 0, 0, 0, 0.01, false);
    const n = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i <= n; i++) rbox(g, 0.06, h, 0.08, postMat, -len / 2 + (i * len) / n, 0, 0, 0.01);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.18), frost);
    f.position.set(0, 1.25, 0.03); g.add(f);
    block(Math.min(x0, x1) - 0.08, Math.max(x0, x1) + 0.08, Math.min(z0, z1) - 0.08, Math.max(z0, z1) + 0.08);
  }
  const panelMat = mat('#b9b0e6', { roughness: 0.95 });
  for (const [x0, z0, x1, z1] of PARTITIONS) {
    rbox(root, 0.12, 2.4, Math.abs(z1 - z0), panelMat, x0, 0, (z0 + z1) / 2, 0.03);
    block(x0 - 0.1, x0 + 0.1, Math.min(z0, z1), Math.max(z0, z1));
  }
  // placas com o nome das salas (em cima da porta)
  for (const r of ROOMS) {
    if (!r.sign) continue;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.42), new THREE.MeshBasicMaterial({ map: labelTexture(r.label, { bg: '#0d1b33', fg: '#ffffff' }), transparent: true, toneMapped: false, side: THREE.DoubleSide }));
    plate.position.set(r.sign.x + (r.sign.side ? -0.05 : 0), 2.85, r.sign.z + (r.sign.side ? 0 : 0.05));
    if (r.sign.side) plate.rotation.y = -Math.PI / 2;
    root.add(plate);
    rbox(root, r.sign.side ? 0.04 : 2.3, 0.5, r.sign.side ? 2.3 : 0.04, mat('#0d1b33'), r.sign.x, 2.6, r.sign.z, 0.02, false);
  }

  mergeStatic(root);
  return { root, obstacles, animate(t) { for (const a of animators) a(t); } };
}

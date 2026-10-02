// Avatar chibi: cabeça grande, olhos que piscam, cabelo/acessórios customizáveis,
// animações de andar, sentar, acenar e "respirar".
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { blobShadowTexture } from './kit.js';

const HIP_Y = 0.42;
const THIGH = 0.2;
const SHIN = 0.19;
let shadowTex = null;

const sharedGeo = {
  head: new THREE.SphereGeometry(0.3, 28, 20),
  eye: new THREE.SphereGeometry(0.042, 14, 10),
  shine: new THREE.SphereGeometry(0.013, 8, 6),
  blush: new THREE.CircleGeometry(0.045, 18),
  mouth: new THREE.TorusGeometry(0.04, 0.011, 8, 16, Math.PI),
  torso: new THREE.CapsuleGeometry(0.19, 0.2, 8, 20),
  arm: new THREE.CapsuleGeometry(0.058, 0.17, 6, 12),
  hand: new THREE.SphereGeometry(0.062, 12, 10),
  thigh: new THREE.CapsuleGeometry(0.075, THIGH - 0.06, 6, 12),
  shin: new THREE.CapsuleGeometry(0.068, SHIN - 0.06, 6, 12),
  shoe: new THREE.SphereGeometry(0.085, 14, 10),
  ear: new THREE.SphereGeometry(0.06, 12, 10),
};

function m(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, ...opts });
}

function mesh(geo, material, parent, x = 0, y = 0, z = 0, shadow = true) {
  const o = new THREE.Mesh(geo, material);
  o.position.set(x, y, z);
  o.castShadow = shadow;
  o.receiveShadow = false;
  parent.add(o);
  return o;
}

function buildHair(head, style, color) {
  const mat = m(color, { roughness: 0.75 });
  const g = new THREE.Group();
  head.add(g);
  if (style === 'bald') return g;
  const cap = (r = 0.318, tilt = -0.5, len = 0.55) => {
    const c = mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI * len), mat, g, 0, 0.0, -0.01);
    c.rotation.x = tilt;
    return c;
  };
  if (style === 'short') {
    cap();
    const fringe = mesh(new THREE.SphereGeometry(0.16, 16, 10), mat, g, 0.07, 0.19, 0.2);
    fringe.scale.set(1.2, 0.5, 0.6); fringe.rotation.z = 0.4;
  } else if (style === 'long') {
    cap(0.322, -0.35, 0.58);
    const back = mesh(new THREE.CapsuleGeometry(0.2, 0.28, 8, 16), mat, g, 0, -0.16, -0.12);
    back.scale.set(1.45, 1, 0.75);
    [-1, 1].forEach((s) => { const side = mesh(new THREE.CapsuleGeometry(0.07, 0.3, 6, 10), mat, g, s * 0.25, -0.12, 0.02); side.rotation.z = s * 0.12; });
    const fringe = mesh(new THREE.SphereGeometry(0.17, 16, 10), mat, g, -0.06, 0.2, 0.19);
    fringe.scale.set(1.3, 0.45, 0.6); fringe.rotation.z = -0.35;
  } else if (style === 'bun') {
    cap(0.32, -0.42, 0.56);
    mesh(new THREE.SphereGeometry(0.13, 18, 14), mat, g, 0, 0.3, -0.12);
    const fringe = mesh(new THREE.SphereGeometry(0.15, 16, 10), mat, g, 0.05, 0.2, 0.2);
    fringe.scale.set(1.3, 0.45, 0.6); fringe.rotation.z = 0.3;
  } else if (style === 'curly') {
    const pts = [];
    for (let i = 0; i < 18; i++) {
      const phi = Math.acos(1 - (i + 0.5) / 18 * 1.15);
      const th = i * 2.4;
      const p = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)).multiplyScalar(0.29);
      if (p.z > 0.15 && p.y < 0.2) continue;
      pts.push(p);
    }
    pts.forEach((p) => mesh(new THREE.SphereGeometry(0.1, 12, 10), mat, g, p.x, p.y + 0.02, p.z - 0.02));
  } else if (style === 'mohawk') {
    cap(0.312, -0.6, 0.42).material = m(color, { roughness: 0.9, transparent: true, opacity: 0.55 });
    for (let i = 0; i < 5; i++) {
      const a = -0.5 + i * 0.32;
      const spike = mesh(new THREE.ConeGeometry(0.06, 0.2, 10), mat, g, 0, Math.cos(a) * 0.31, Math.sin(a) * 0.31 - 0.02);
      spike.rotation.x = a;
    }
  }
  return g;
}

function buildAccessory(head, kind) {
  const g = new THREE.Group();
  head.add(g);
  const dark = m('#22262f', { roughness: 0.4 });
  if (kind === 'glasses') {
    [-0.1, 0.1].forEach((x) => mesh(new THREE.TorusGeometry(0.068, 0.012, 8, 24), dark, g, x, 0.02, 0.29, false));
    mesh(new THREE.BoxGeometry(0.07, 0.014, 0.014), dark, g, 0, 0.03, 0.3, false);
  } else if (kind === 'headphones') {
    const band = mesh(new THREE.TorusGeometry(0.33, 0.025, 8, 32, Math.PI), dark, g, 0, 0.0, 0, false);
    [-1, 1].forEach((s) => {
      const cup = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 18), m('#2f7bff', { roughness: 0.4 }), g, s * 0.31, 0, 0);
      cup.rotation.z = Math.PI / 2;
    });
  } else if (kind === 'cap') {
    const c = mesh(new THREE.SphereGeometry(0.325, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), m('#ff7a6b'), g, 0, 0.03, 0);
    c.rotation.x = -0.15;
    const brim = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 24, 1, false, -Math.PI / 2, Math.PI), m('#ff7a6b'), g, 0, 0.08, 0.2);
    brim.rotation.x = 0.12;
    brim.scale.set(1, 1, 1.2);
  } else if (kind === 'beanie') {
    const c = mesh(new THREE.SphereGeometry(0.33, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), m('#7c5cff', { roughness: 0.95 }), g, 0, 0.04, -0.01);
    c.rotation.x = -0.2;
    const rim = mesh(new THREE.TorusGeometry(0.31, 0.05, 10, 32), m('#6a4be6', { roughness: 0.95 }), g, 0, 0.07, 0.0);
    rim.rotation.x = Math.PI / 2 - 0.2;
    mesh(new THREE.SphereGeometry(0.07, 12, 10), m('#ffffff', { roughness: 1 }), g, 0, 0.38, -0.08);
  }
  return g;
}

// Junta as peças rígidas de um grupo (cabelo, acessório) em 1 malha por material.
function mergeChildren(g) {
  const byMat = new Map();
  for (const c of [...g.children]) {
    if (!c.isMesh) continue;
    c.updateMatrix();
    const geo = (c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone()).applyMatrix4(c.matrix);
    for (const n of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(n)) geo.deleteAttribute(n);
    if (!byMat.has(c.material)) byMat.set(c.material, []);
    byMat.get(c.material).push(geo);
    g.remove(c);
    c.geometry.dispose();
  }
  for (const [material, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((x) => x.dispose());
    if (merged) mesh(merged, material, g);
  }
  return g;
}

export class Avatar {
  constructor(config, { isMe = false } = {}) {
    this.root = new THREE.Group();
    this.isMe = isMe;
    this.t = Math.random() * 1000;
    this.walk = 0;          // 0..1 mistura de caminhada
    this.sit = 0;           // 0..1 mistura de sentado
    this.wave = 0;          // tempo restante do aceno
    this.blinkT = 2 + Math.random() * 3;
    this.seatH = 0.41;
    this.opacity = 1;
    this.speaking = 0;
    this.build(config);
  }

  build(cfg) {
    this.cfg = { ...cfg };
    if (this.body) this.root.remove(this.body);
    const body = new THREE.Group();
    this.body = body;
    this.root.add(body);
    this.materials = [];
    const track = (mt) => { this.materials.push(mt); return mt; };
    const skin = track(m(cfg.skin, { roughness: 0.7 }));
    const shirt = track(m(cfg.shirt, { roughness: 0.75 }));
    const pants = track(m(cfg.pants, { roughness: 0.85 }));
    const shoe = track(m('#f4f4f6', { roughness: 0.5 }));

    // pernas (quadril → coxa → joelho → canela)
    this.hips = new THREE.Group();
    this.hips.position.y = HIP_Y;
    body.add(this.hips);
    this.legs = [-1, 1].map((s) => {
      const hip = new THREE.Group();
      hip.position.x = s * 0.095;
      this.hips.add(hip);
      mesh(sharedGeo.thigh, pants, hip, 0, -THIGH / 2, 0);
      const knee = new THREE.Group();
      knee.position.y = -THIGH;
      hip.add(knee);
      mesh(sharedGeo.shin, pants, knee, 0, -SHIN / 2, 0);
      const foot = mesh(sharedGeo.shoe, shoe, knee, 0, -SHIN + 0.0, 0.04);
      foot.scale.set(0.9, 0.6, 1.25);
      return { hip, knee };
    });

    // tronco
    this.torso = new THREE.Group();
    this.torso.position.y = HIP_Y;
    body.add(this.torso);
    const t = mesh(sharedGeo.torso, shirt, this.torso, 0, 0.2, 0);
    t.scale.set(1, 1, 0.82);
    // detalhe da gola
    const collar = mesh(new THREE.TorusGeometry(0.09, 0.022, 8, 20), track(m(new THREE.Color(cfg.shirt).multiplyScalar(0.75).getStyle())), this.torso, 0, 0.42, 0.02, false);
    collar.rotation.x = Math.PI / 2;

    // braços
    this.arms = [-1, 1].map((s) => {
      const sh = new THREE.Group();
      sh.position.set(s * 0.235, 0.38, 0);
      this.torso.add(sh);
      const a = mesh(sharedGeo.arm, shirt, sh, 0, -0.12, 0);
      a.rotation.z = s * 0.08;
      mesh(sharedGeo.hand, skin, sh, s * 0.02, -0.26, 0.0);
      return sh;
    });

    // cabeça
    this.head = new THREE.Group();
    this.head.position.y = 0.68;
    this.torso.add(this.head);
    const headMesh = mesh(sharedGeo.head, skin, this.head);
    headMesh.scale.set(1.04, 0.96, 0.98);
    [-1, 1].forEach((s) => mesh(sharedGeo.ear, skin, this.head, s * 0.3, -0.01, 0));
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#1b1d24', roughness: 0.25 });
    const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    this.eyes = [-1, 1].map((s) => {
      const e = mesh(sharedGeo.eye, eyeMat, this.head, s * 0.1, 0.0, 0.278, false);
      e.scale.set(0.9, 1.15, 0.5);
      mesh(sharedGeo.shine, shineMat, e, 0.014, 0.018, 0.035, false);
      return e;
    });
    const blushMat = new THREE.MeshBasicMaterial({ color: '#ff8fa3', transparent: true, opacity: 0.45, depthWrite: false });
    [-1, 1].forEach((s) => {
      const b = mesh(sharedGeo.blush, blushMat, this.head, s * 0.175, -0.075, 0.24, false);
      b.rotation.y = s * 0.55;
    });
    const mouth = mesh(sharedGeo.mouth, new THREE.MeshBasicMaterial({ color: '#7a3b3b' }), this.head, 0, -0.085, 0.283, false);
    mouth.rotation.z = Math.PI;
    mouth.scale.set(1, 0.8, 1);
    this.mouth = mouth;
    mergeChildren(buildHair(this.head, cfg.hairStyle, cfg.hairColor));
    mergeChildren(buildAccessory(this.head, cfg.accessory));

    // sombra suave + anel no chão
    if (!this.shadow) {
      shadowTex ||= blobShadowTexture();
      this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      this.shadow.rotation.x = -Math.PI / 2;
      this.shadow.position.y = 0.012;
      this.root.add(this.shadow);
      this.ringMat = new THREE.MeshBasicMaterial({ color: this.isMe ? '#3b8cff' : '#22c58b', transparent: true, opacity: 0, depthWrite: false });
      this.ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.47, 48), this.ringMat);
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.position.y = 0.014;
      this.root.add(this.ring);
    }
    this.applyOpacity(this.opacity, true);
  }

  setConfig(cfg) {
    if (JSON.stringify(cfg) !== JSON.stringify(this.cfg)) this.build(cfg);
  }

  applyOpacity(o, force = false) {
    if (!force && Math.abs(o - this.opacity) < 0.01) return;
    this.opacity = o;
    this.body?.traverse((c) => {
      if (!c.isMesh) return;
      const mt = c.material;
      if (mt.userData.baseOpacity === undefined) mt.userData.baseOpacity = mt.opacity;
      mt.transparent = o < 0.99 || mt.userData.baseOpacity < 1;
      mt.opacity = mt.userData.baseOpacity * o;
      c.castShadow = o > 0.6;
    });
  }

  emote() { this.wave = 2.2; }

  // moving: se está andando; seated: se está sentado; dt em segundos
  update(dt, { moving = false, seated = false, seatH = 0.41, speaking = 0 } = {}) {
    this.t += dt;
    const k = 1 - Math.exp(-dt * 10);
    this.walk += ((moving ? 1 : 0) - this.walk) * k;
    this.sit += ((seated ? 1 : 0) - this.sit) * (1 - Math.exp(-dt * 7));
    this.seatH = seatH;
    const w = this.walk * (1 - this.sit);
    const s = this.sit;
    const phase = this.t * 9.5;
    const swing = Math.sin(phase) * 0.7 * w;

    // pernas: andar + sentar
    this.legs.forEach(({ hip, knee }, i) => {
      const dir = i ? -1 : 1;
      const walkHip = swing * dir;
      const walkKnee = Math.max(0, -Math.sin(phase + (i ? Math.PI : 0))) * 0.9 * w;
      hip.rotation.x = walkHip * (1 - s) + (-Math.PI / 2 + 0.05) * s;
      knee.rotation.x = walkKnee * (1 - s) + (Math.PI / 2 - 0.1) * s;
    });

    // braços
    const typing = s * (0.5 + Math.sin(this.t * 14) * 0.04);
    this.arms.forEach((a, i) => {
      const dir = i ? 1 : -1;
      a.rotation.x = -swing * dir * 0.9 * (1 - s) - typing - 0.05;
      a.rotation.z = (i ? 1 : -1) * (0.08 + 0.04 * Math.sin(this.t * 2));
    });
    if (this.wave > 0) {
      this.wave -= dt;
      const a = this.arms[1];
      const up = Math.min(1, this.wave * 3, (2.2 - this.wave) * 5);
      a.rotation.z = THREE.MathUtils.lerp(a.rotation.z, 2.6 + Math.sin(this.t * 16) * 0.35, up);
      a.rotation.x = THREE.MathUtils.lerp(a.rotation.x, 0, up);
    }

    // corpo: quique ao andar, respiração parado, altura do assento
    const bob = Math.abs(Math.sin(phase)) * 0.045 * w;
    const breathe = Math.sin(this.t * 2.2) * 0.008 * (1 - w);
    this.body.position.y = bob + (seatH + 0.03 - HIP_Y) * s;
    this.torso.scale.y = 1 + breathe;
    this.torso.rotation.x = 0.06 * w + 0.05 * s;
    this.head.rotation.z = Math.sin(this.t * 1.3) * 0.04 * (1 - w);
    this.head.rotation.x = -0.05 * s;

    // piscar
    this.blinkT -= dt;
    let eyeY = 1.15;
    if (this.blinkT < 0.12) eyeY = 0.15;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 4;
    this.eyes.forEach((e) => { e.scale.y = eyeY; });

    // boca mexe ao falar
    this.speaking += (speaking - this.speaking) * (1 - Math.exp(-dt * 18));
    this.mouth.scale.y = 0.8 + this.speaking * (0.8 + Math.sin(this.t * 30) * 0.6);

    // anel no chão: pulsa ao falar (verde) ou para "você" (azul)
    const pulse = 0.5 + Math.sin(this.t * 4) * 0.5;
    const ringOp = Math.max(this.isMe ? 0.35 + pulse * 0.3 : 0, this.speaking * 0.95);
    this.ringMat.opacity = ringOp * this.opacity;
    this.ringMat.color.set(this.speaking > 0.15 ? '#22c58b' : (this.isMe ? '#3b8cff' : '#22c58b'));
    this.ring.scale.setScalar(1 + this.speaking * 0.25 + (this.isMe ? pulse * 0.06 : 0));
    this.shadow.scale.setScalar(1 - bob * 2);
  }

  dispose() {
    this.root.traverse((c) => { if (c.isMesh && !Object.values(sharedGeo).includes(c.geometry)) c.geometry.dispose(); });
  }
}

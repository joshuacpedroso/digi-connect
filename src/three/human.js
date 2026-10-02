// Personagens realistas e personalizáveis (MakeHuman, CC0), montados em src/three/mh.js.
// Animação procedural por osso, no espaço do modelo (x = esquerda, y = cima, z = frente):
// andar, sentar e digitar, acenar, respirar, olhar em volta, piscar e mexer a boca ao falar.
import * as THREE from 'three';
import { buildHuman, disposeHuman, loadHumanData, skinTexture } from './mh.js';
import { sanitizeAvatar } from '../../shared/avatar.js';
import { blobShadowTexture } from './kit.js';

const OFFICE_SCALE = 0.93; // o mobiliário do escritório é um pouco menor que o tamanho real
const BONES = {
  Hips: 'root', Spine: 'spine04', Chest: 'spine03', UpperChest: 'spine01', Neck: 'neck01', Head: 'head',
  LeftShoulder: 'clavicle.L', LeftArm: 'upperarm01.L', LeftForeArm: 'lowerarm01.L', LeftHand: 'wrist.L',
  RightShoulder: 'clavicle.R', RightArm: 'upperarm01.R', RightForeArm: 'lowerarm01.R', RightHand: 'wrist.R',
  LeftUpLeg: 'upperleg01.L', LeftLeg: 'lowerleg01.L', LeftFoot: 'foot.L',
  RightUpLeg: 'upperleg01.R', RightLeg: 'lowerleg01.R', RightFoot: 'foot.R',
  Jaw: 'jaw', LBlink: 'orbicularis03.L', RBlink: 'orbicularis03.R', LLow: 'orbicularis04.L', RLow: 'orbicularis04.R',
  LEye: 'eye.L', REye: 'eye.R',
};
for (const s of ['L', 'R']) for (let f = 1; f <= 5; f++) for (let j = 1; j <= 3; j++) BONES[`F${s}${f}${j}`] = `finger${f}-${j}.${s}`;

let shadowTex = null;
const _q = new THREE.Quaternion();
const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const qAxis = (axis, a) => new THREE.Quaternion().setFromAxisAngle(axis, a);
const _e = new THREE.Euler();
const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(_e.set(x, y, z, 'XYZ'));
const dir = (a, b) => b.clone().sub(a).normalize();

// Pré-carrega os dados do corpo (mantém a API usada no boot).
export async function loadCharacter() { await Promise.all([loadHumanData(), skinTexture()]); }

function analyze(h) {
  const byName = new Map(h.bones.map((b) => [b.name, b]));
  const bones = {};
  for (const [k, n] of Object.entries(BONES)) bones[k] = byName.get(n) || null;
  const names = Object.keys(BONES).filter((k) => bones[k]);
  const depth = (b) => { let d = 0; for (let p = b.parent; p; p = p.parent) d++; return d; };
  names.sort((a, b) => depth(bones[a]) - depth(bones[b]));
  const objToName = new Map(names.map((n) => [bones[n], n]));
  const anc = {};
  for (const n of names) {
    anc[n] = null;
    for (let p = bones[n].parent; p; p = p.parent) if (objToName.has(p)) { anc[n] = objToName.get(p); break; }
  }
  const J = h.info.joints;
  const P = (k) => J(BONES[k]);
  const info = {
    ...h.info, names, anc, bones,
    armL: dir(P('LeftArm'), P('LeftForeArm')), armR: dir(P('RightArm'), P('RightForeArm')),
    foreL: dir(P('LeftForeArm'), P('LeftHand')), foreR: dir(P('RightForeArm'), P('RightHand')),
  };
  const down = (x) => new THREE.Vector3(x, -1, 0.04).normalize();
  info.armDownL = new THREE.Quaternion().setFromUnitVectors(info.armL, down(0.12));
  info.armDownR = new THREE.Quaternion().setFromUnitVectors(info.armR, down(-0.12));
  // o antebraço do MakeHuman vem dobrado para a frente: alinhado ao braço (quase reto) na pose de repouso
  for (const [s, k] of [['L', 1], ['R', -1]]) {
    const inv = info[`armDown${s}`].clone().invert();
    const want = new THREE.Vector3(0.05 * k, -1, 0.12).normalize().applyQuaternion(inv);
    info[`foreDown${s}`] = new THREE.Quaternion().setFromUnitVectors(info[`fore${s}`], want);
    info[`bend${s}`] = AX.clone().applyQuaternion(inv); // dobra do cotovelo (eixo esquerda-direita)
  }
  info.waveArm = new THREE.Quaternion().setFromUnitVectors(info.armR, new THREE.Vector3(-1, 0.18, 0.12).normalize());
  info.waveFore = new THREE.Quaternion().setFromUnitVectors(info.foreR, AY.clone().applyQuaternion(info.waveArm.clone().invert()));
  // eixo para dobrar os dedos (de lado a lado da mão, na pose de repouso)
  for (const s of ['L', 'R']) {
    const across = dir(J(`finger5-1.${s}`), J(`finger2-1.${s}`));
    info[`curl${s}`] = s === 'L' ? across : across.negate();
  }
  return info;
}

function mat(color, opts = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.4, ...opts }); }

export class Avatar {
  constructor(config, { isMe = false } = {}) {
    this.isMe = isMe;
    this.root = new THREE.Group();
    this.t = Math.random() * 100;
    this.walk = 0; this.sit = 0; this.wave = 0; this.speaking = 0; this.opacity = 1;
    this.lookT = Math.random() * 10;
    this.blinkT = 2 + Math.random() * 3;
    this.saccT = 0; this.sacc = new THREE.Vector2();
    this.fade = 0;
    shadowTex ||= blobShadowTexture();
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.012;
    this.root.add(this.shadow);
    this.ringMat = new THREE.MeshBasicMaterial({ color: isMe ? '#3b8cff' : '#22c58b', transparent: true, opacity: 0, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.45, 48), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.014;
    this.root.add(this.ring);
    this.build(config);
  }

  // Monta o personagem; se já houver um em construção, só a configuração mais recente é usada.
  build(cfg) {
    this.cfg = sanitizeAvatar(cfg);
    this.cfgKey = JSON.stringify(this.cfg);
    if (this.building) { this.pending = true; return this.building; }
    const run = async () => {
      do {
        this.pending = false;
        const want = this.cfg;
        try {
          const h = await buildHuman(want);
          if (this.disposed) { disposeHuman(h); return; }
          if (this.pending) { disposeHuman(h); continue; }
          this.mount(h);
        } catch (e) { console.warn('avatar', e); }
      } while (this.pending && !this.disposed);
    };
    this.building = run().finally(() => { this.building = null; });
    return this.building;
  }

  mount(h) {
    const first = !this.human;
    if (this.inner) { this.root.remove(this.inner); disposeHuman(this.human); this.extra?.forEach((m) => m.dispose()); }
    this.human = h;
    this.scale = OFFICE_SCALE * (0.95 + 0.1 * this.cfg.height);
    const inner = new THREE.Group();
    inner.scale.setScalar(this.scale);
    inner.add(h.group);
    this.inner = inner;
    this.model = h.group;
    this.root.add(inner);
    this.info = analyze(h);
    this.bones = this.info.bones;
    this.materials = [...h.materials];
    for (const m of this.materials) m.userData.baseOpacity = 1;
    this.extra = [];
    this.buildAccessory();
    h.group.updateMatrixWorld(true);
    if (first) this.fade = 0.001;
    this.applyOpacity(this.opacity, true);
    this.update(0, this.lastState || {});
  }

  buildAccessory() {
    if (this.cfg.acc !== 'headphones' || !this.bones.Head) return;
    const { head } = this.info;
    const c = head.getCenter(new THREE.Vector3());
    const s = head.getSize(new THREE.Vector3());
    const g = new THREE.Group();
    const dark = mat('#15171c', { roughness: 0.3, metalness: 0.4 });
    const cupM = mat('#2f7bff', { roughness: 0.35 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(s.x * 0.56, 0.011, 10, 32, Math.PI), dark);
    band.position.set(c.x, c.y + s.y * 0.08, c.z - s.z * 0.06);
    g.add(band);
    [-1, 1].forEach((k) => {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 20), cupM);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(c.x + k * s.x * 0.56, c.y + s.y * 0.06 - 0.02, c.z - s.z * 0.06);
      g.add(cup);
    });
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    this.materials.push(dark, cupM);
    this.extra.push(dark, cupM);
    this.model.add(g);
    this.model.updateMatrixWorld(true);
    this.bones.Head.attach(g);
  }

  setConfig(cfg) {
    const next = sanitizeAvatar(cfg);
    if (JSON.stringify(next) !== this.cfgKey) return this.build(next);
    return Promise.resolve();
  }

  applyOpacity(o, force = false) {
    if (!force && Math.abs(o - this.opacity) < 0.01) return;
    this.opacity = o;
    this.updateMaterials();
  }

  updateMaterials() {
    const o = this.opacity * Math.min(1, this.fade || 1);
    for (const m of this.materials || []) {
      const base = m.userData.baseOpacity ?? 1;
      const blend = !!m.userData.blend;
      m.transparent = blend || o < 0.99 || base < 1;
      m.opacity = base * o;
      m.depthWrite = !blend && (o > 0.99 || !!m.userData.mask);
    }
    this.model?.traverse((c) => { if (c.isMesh && !c.material.userData.blend) c.castShadow = o > 0.6; });
  }

  emote() { this.wave = 2.2; }

  pose(D) {
    const { names, anc } = this.info;
    const M = {};
    const I = new THREE.Quaternion();
    // ossos sem rotação de repouso: rotação local = (rotação do ancestral)^-1 · (rotação deste osso)
    for (const n of names) {
      const a = anc[n] ? M[anc[n]] : I;
      const m = a.clone();
      if (D[n]) m.multiply(D[n]);
      M[n] = m;
      this.bones[n].quaternion.copy(_q.copy(a).invert().multiply(m));
    }
  }

  update(dt, state = {}) {
    const { moving = false, seated = false, seatH = 0.41, speaking = 0 } = state;
    this.lastState = state;
    this.t += dt;
    this.walk += ((moving ? 1 : 0) - this.walk) * (1 - Math.exp(-dt * 10));
    this.sit += ((seated ? 1 : 0) - this.sit) * (1 - Math.exp(-dt * 6));
    this.speaking += (speaking - this.speaking) * (1 - Math.exp(-dt * 16));
    const pulse = 0.5 + Math.sin(this.t * 4) * 0.5;
    const ringOp = Math.max(this.isMe ? 0.35 + pulse * 0.3 : 0, this.speaking * 0.95);
    this.ringMat.opacity = ringOp * this.opacity;
    this.ringMat.color.set(this.speaking > 0.15 ? '#22c58b' : (this.isMe ? '#3b8cff' : '#22c58b'));
    this.ring.scale.setScalar(1 + this.speaking * 0.25 + (this.isMe ? pulse * 0.06 : 0));
    if (!this.model) return;
    if (this.fade && this.fade < 1) { this.fade = Math.min(1, this.fade + dt * 3); this.updateMaterials(); if (this.fade >= 1) this.fade = 0; }

    const info = this.info;
    const w = this.walk * (1 - this.sit);
    const s = this.sit;
    const t = this.t;
    const ph = t * 7.4;
    const sw = Math.sin(ph);
    const D = {};

    // pernas
    const legSwing = sw * 0.5 * w;
    D.LeftUpLeg = qAxis(AX, -legSwing * (1 - s) - 1.5 * s);
    D.RightUpLeg = qAxis(AX, legSwing * (1 - s) - 1.5 * s);
    D.LeftLeg = qAxis(AX, Math.max(0, Math.sin(ph + Math.PI)) * 0.85 * w * (1 - s) + 1.48 * s);
    D.RightLeg = qAxis(AX, Math.max(0, Math.sin(ph)) * 0.85 * w * (1 - s) + 1.48 * s);
    D.LeftFoot = qAxis(AX, -0.04 * s);
    D.RightFoot = qAxis(AX, -0.04 * s);

    // tronco e cabeça
    const breathe = Math.sin(t * 2.1) * 0.018;
    D.Hips = qAxis(AY, sw * 0.06 * w);
    D.Spine = qAxis(AX, 0.04 * w + 0.06 * s + breathe * 0.4);
    D.Chest = qAxis(AX, breathe).multiply(qAxis(AY, -sw * 0.05 * w));
    const look = Math.sin(t * 0.43 + this.lookT) * 0.2 * (1 - w) * (1 - s * 0.6);
    const nod = Math.sin(t * 8.5) * 0.035 * this.speaking;
    D.Head = qEuler(0.06 * s + nod, look, Math.sin(t * 0.7) * 0.025);

    // braços: da pose A para o lado do corpo; balanço ao andar; digitando sentado
    const swing = sw * 0.38 * w;
    const typeL = Math.sin(t * 13) * 0.04 * s, typeR = Math.sin(t * 11 + 1) * 0.04 * s;
    D.LeftArm = qAxis(AX, swing * (1 - s) - 0.62 * s).multiply(info.armDownL);
    D.RightArm = qAxis(AX, -swing * (1 - s) - 0.62 * s).multiply(info.armDownR);
    D.LeftForeArm = qAxis(info.bendL, -((0.1 + 0.25 * w) * (1 - s) + (1.15 + typeL) * s)).multiply(info.foreDownL);
    D.RightForeArm = qAxis(info.bendR, -((0.1 + 0.25 * w) * (1 - s) + (1.15 + typeR) * s)).multiply(info.foreDownR);

    if (this.wave > 0) {
      this.wave -= dt;
      const up = Math.min(1, this.wave * 3, (2.2 - this.wave) * 5);
      D.RightArm = D.RightArm.slerp(info.waveArm, up);
      const wav = qAxis(AZ, Math.sin(t * 14) * 0.35);
      D.RightForeArm = D.RightForeArm.slerp(wav.multiply(info.waveFore), up);
    }

    // mãos relaxadas (dedos levemente dobrados)
    for (const sd of ['L', 'R']) {
      const ax = info[`curl${sd}`];
      const k = 1 + 0.25 * s;
      for (let f = 2; f <= 5; f++) {
        D[`F${sd}${f}1`] = qAxis(ax, 0.22 * k + f * 0.03);
        D[`F${sd}${f}2`] = qAxis(ax, 0.42 * k + f * 0.04);
        D[`F${sd}${f}3`] = qAxis(ax, 0.3 * k);
      }
    }

    // rosto: piscar, olhar e boca ao falar
    this.blinkT -= dt;
    const blink = this.forceBlink ?? (this.blinkT < 0.12 ? 1 : 0);
    if (this.blinkT < 0) this.blinkT = 2.5 + Math.random() * 4;
    D.LBlink = qAxis(AX, 0.55 * blink);
    D.RBlink = qAxis(AX, 0.55 * blink);
    D.LLow = qAxis(AX, -0.12 * blink);
    D.RLow = qAxis(AX, -0.12 * blink);
    this.saccT -= dt;
    if (this.saccT < 0) { this.saccT = 0.6 + Math.random() * 2.2; this.sacc.set((Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.3); }
    const eye = qEuler(this.sacc.x, this.sacc.y + look * 0.6, 0);
    D.LEye = eye; D.REye = eye;
    D.Jaw = qAxis(AX, this.speaking * (0.05 + Math.abs(Math.sin(t * 17)) * 0.1));

    this.pose(D);

    // corpo desce ao sentar, quica levemente ao andar
    const S = this.scale;
    const bob = Math.abs(Math.sin(ph)) * 0.025 * w;
    const drop = (info.hipY - info.minY) * S - (seatH + 0.07);
    this.inner.position.y = -info.minY * S + bob - drop * s;
    this.inner.position.z = -0.05 * s;
    this.shadow.scale.setScalar(1 - bob * 2);
  }

  dispose() {
    this.disposed = true;
    if (this.human) disposeHuman(this.human);
    this.extra?.forEach((m) => m.dispose());
  }
}

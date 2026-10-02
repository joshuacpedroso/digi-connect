// Personagens realistas (Microsoft Rocketbox — MIT) com esqueleto Biped.
// Animação procedural por osso, no espaço do modelo (x = esquerda, y = cima, z = frente):
// andar, sentar e digitar, acenar, respirar, olhar em volta, piscar e mexer a boca ao falar.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CHARACTERS } from '../../shared/layout.js';
import { blobShadowTexture } from './kit.js';

const SCALE = 0.93; // personagens têm ~1,65–1,85 m; o mobiliário do escritório é um pouco menor
const BONES = {
  Hips: 'Bip01 Pelvis', Spine: 'Bip01 Spine', Chest: 'Bip01 Spine1', UpperChest: 'Bip01 Spine2', Neck: 'Bip01 Neck', Head: 'Bip01 Head',
  LeftShoulder: 'Bip01 L Clavicle', LeftArm: 'Bip01 L UpperArm', LeftForeArm: 'Bip01 L Forearm', LeftHand: 'Bip01 L Hand',
  RightShoulder: 'Bip01 R Clavicle', RightArm: 'Bip01 R UpperArm', RightForeArm: 'Bip01 R Forearm', RightHand: 'Bip01 R Hand',
  LeftUpLeg: 'Bip01 L Thigh', LeftLeg: 'Bip01 L Calf', LeftFoot: 'Bip01 L Foot',
  RightUpLeg: 'Bip01 R Thigh', RightLeg: 'Bip01 R Calf', RightFoot: 'Bip01 R Foot',
  Jaw: 'Bip01 MJaw', LBlink: 'Bip01 LEyeBlinkTop', RBlink: 'Bip01 REyeBlinkTop',
};
const norm = (s) => s.replace(/[\s_]/g, '').toLowerCase();

const loader = new GLTFLoader();
const cache = new Map();
let shadowTex = null;
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const qAxis = (axis, a) => new THREE.Quaternion().setFromAxisAngle(axis, a);
const _e = new THREE.Euler();
const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(_e.set(x, y, z, 'XYZ'));
const dir = (a, b) => b.clone().sub(a).normalize();

function boneMap(root) {
  const byNorm = new Map();
  root.traverse((o) => { if (o.isBone) byNorm.set(norm(o.name), o); });
  const out = {};
  for (const [k, n] of Object.entries(BONES)) out[k] = byNorm.get(norm(n)) || null;
  return out;
}

function analyze(scene) {
  scene.updateMatrixWorld(true);
  const bones = boneMap(scene);
  const names = Object.keys(BONES).filter((k) => bones[k]);
  // ordem hierárquica (pais antes dos filhos)
  const depth = (b) => { let d = 0; for (let p = b.parent; p; p = p.parent) d++; return d; };
  names.sort((a, b) => depth(bones[a]) - depth(bones[b]));
  const objToName = new Map(names.map((n) => [bones[n], n]));
  const rest = {};
  for (const n of names) {
    const b = bones[n];
    let anc = null;
    for (let p = b.parent; p; p = p.parent) if (objToName.has(p)) { anc = objToName.get(p); break; }
    rest[n] = {
      world: b.getWorldQuaternion(new THREE.Quaternion()),
      parentWorld: b.parent.getWorldQuaternion(new THREE.Quaternion()),
      anc,
    };
  }
  const P = (n) => bones[n].getWorldPosition(new THREE.Vector3());
  const box = new THREE.Box3();
  const head = new THREE.Box3();
  const headIdx = new Set();
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const sk = o.skeleton;
    sk.bones.forEach((b, i) => { let x = b; while (x) { if (x === bones.Head) { headIdx.add(`${o.uuid}:${i}`); break; } x = x.parent; } });
    const J = o.geometry.attributes.skinIndex, W = o.geometry.attributes.skinWeight;
    for (let i = 0; i < J.count; i++) {
      o.getVertexPosition(i, _v);
      _v.applyMatrix4(o.matrixWorld);
      box.expandByPoint(_v);
      let best = 0;
      for (let k = 1; k < 4; k++) if (W.getComponent(i, k) > W.getComponent(i, best)) best = k;
      if (headIdx.has(`${o.uuid}:${J.getComponent(i, best)}`)) head.expandByPoint(_v);
    }
  });
  const info = {
    names, rest, box, head,
    hipY: P('Hips').y,
    minY: box.min.y,
    armL: dir(P('LeftArm'), P('LeftForeArm')), armR: dir(P('RightArm'), P('RightForeArm')),
    foreL: dir(P('LeftForeArm'), P('LeftHand')), foreR: dir(P('RightForeArm'), P('RightHand')),
    eyes: null,
  };
  let eyeL = null, eyeR = null;
  scene.traverse((o) => { if (o.isBone && norm(o.name) === norm('Bip01 LEye')) eyeL = o; if (o.isBone && norm(o.name) === norm('Bip01 REye')) eyeR = o; });
  if (eyeL && eyeR) info.eyes = { l: eyeL.getWorldPosition(new THREE.Vector3()), r: eyeR.getWorldPosition(new THREE.Vector3()) };
  // poses-alvo pré-calculadas
  const down = (x) => new THREE.Vector3(x, -1, 0.05).normalize();
  info.armDownL = new THREE.Quaternion().setFromUnitVectors(info.armL, down(0.13));
  info.armDownR = new THREE.Quaternion().setFromUnitVectors(info.armR, down(-0.13));
  info.bendL = new THREE.Vector3().crossVectors(info.foreL, AZ).normalize();
  info.bendR = new THREE.Vector3().crossVectors(info.foreR, AZ).normalize();
  info.waveArm = new THREE.Quaternion().setFromUnitVectors(info.armR, new THREE.Vector3(-1, 0.18, 0.12).normalize());
  info.waveFore = new THREE.Quaternion().setFromUnitVectors(info.foreR, AY.clone().applyQuaternion(info.waveArm.clone().invert()));
  return info;
}

export function loadModel(id) {
  if (!cache.has(id)) {
    cache.set(id, loader.loadAsync(`/avatars/${id}.glb`).then((g) => ({ scene: g.scene, info: analyze(g.scene) })));
  }
  return cache.get(id);
}

// Pré-carrega um personagem padrão (mantém a API usada no boot).
export async function loadCharacter() { await loadModel(CHARACTERS[0].id); }

function mat(color, opts = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.4, ...opts }); }

export class Avatar {
  constructor(config, { isMe = false } = {}) {
    this.isMe = isMe;
    this.root = new THREE.Group();
    this.t = Math.random() * 100;
    this.walk = 0; this.sit = 0; this.wave = 0; this.speaking = 0; this.opacity = 1;
    this.lookT = Math.random() * 10;
    this.blinkT = 2 + Math.random() * 3;
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

  build(cfg) {
    this.cfg = { ...cfg };
    const token = (this.token = Symbol('build'));
    loadModel(cfg.character || CHARACTERS[0].id).then(({ scene, info }) => {
      if (this.token !== token || this.disposed) return;
      this.mount(scene, info);
    }).catch((e) => console.warn('avatar', e));
  }

  mount(base, info) {
    if (this.inner) { this.root.remove(this.inner); this.disposeModel(); }
    const inner = new THREE.Group();
    inner.scale.setScalar(SCALE);
    const model = SkeletonUtils.clone(base);
    inner.add(model);
    this.inner = inner;
    this.model = model;
    this.info = info;
    this.root.add(inner);
    this.materials = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.userData.baseOpacity = 1;
      if (o.material.alphaTest) o.material.userData.mask = true;
      o.castShadow = true;
      o.receiveShadow = false;
      o.frustumCulled = false;
      this.materials.push(o.material);
    });
    this.bones = boneMap(model);
    model.updateMatrixWorld(true);
    this.buildAccessory();
    this.fade = 0.001;
    this.applyOpacity(this.opacity, true);
  }

  buildAccessory() {
    const kind = this.cfg.accessory;
    if (!kind || kind === 'none' || !this.bones.Head) return;
    const { head, eyes } = this.info;
    const c = head.getCenter(new THREE.Vector3());
    const s = head.getSize(new THREE.Vector3());
    const g = new THREE.Group();
    const dark = mat('#15171c', { roughness: 0.3, metalness: 0.4 });
    if ((kind === 'glasses' || kind === 'sunglasses') && eyes) {
      const mid = eyes.l.clone().add(eyes.r).multiplyScalar(0.5);
      const half = Math.max(0.028, Math.abs(eyes.l.x - eyes.r.x) / 2);
      const z = mid.z + 0.028;
      const lens = kind === 'sunglasses' ? mat('#0c0d10', { roughness: 0.08, metalness: 0.5 }) : new THREE.MeshStandardMaterial({ color: '#b8d4ea', transparent: true, opacity: 0.1, roughness: 0.05, depthWrite: false });
      [-1, 1].forEach((k) => {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0028, 8, 24), dark);
        rim.scale.set(1.15, 0.85, 1);
        rim.position.set(mid.x + k * half, mid.y, z);
        g.add(rim);
        const l = new THREE.Mesh(new THREE.CircleGeometry(0.021, 24), lens);
        l.scale.set(1.15, 0.85, 1);
        l.position.set(mid.x + k * half, mid.y, z + 0.001);
        g.add(l);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.09), dark);
        arm.position.set(mid.x + k * (half + 0.026), mid.y + 0.004, z - 0.045);
        g.add(arm);
      });
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(half * 2 - 0.045, 0.003, 0.003), dark);
      bridge.position.set(mid.x, mid.y + 0.004, z);
      g.add(bridge);
    } else if (kind === 'headphones') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(s.x * 0.53, 0.012, 10, 32, Math.PI), dark);
      band.position.set(c.x, c.y + s.y * 0.06, c.z - s.z * 0.04);
      g.add(band);
      [-1, 1].forEach((k) => {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 20), mat('#2f7bff', { roughness: 0.35 }));
        cup.rotation.z = Math.PI / 2;
        cup.position.set(c.x + k * s.x * 0.53, c.y + s.y * 0.02 - 0.02, c.z - s.z * 0.04);
        g.add(cup);
      });
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; this.materials.push(o.material); } });
    this.model.add(g);
    g.updateMatrixWorld(true);
    this.bones.Head.attach(g);
  }

  setConfig(cfg) {
    if (JSON.stringify(cfg) !== JSON.stringify(this.cfg)) this.build(cfg);
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
      m.transparent = o < 0.99 || base < 1;
      m.opacity = base * o;
      m.depthWrite = o > 0.99 || !m.transparent || !!m.userData.mask;
    }
    this.model?.traverse((c) => { if (c.isMesh) c.castShadow = o > 0.6; });
  }

  emote() { this.wave = 2.2; }

  pose(D) {
    const { rest, names } = this.info;
    const M = {};
    const Wd = {};
    const I = new THREE.Quaternion();
    for (const n of names) {
      const r = rest[n];
      const m = (r.anc ? M[r.anc] : I).clone();
      if (D[n]) m.multiply(D[n]);
      M[n] = m;
      const w = m.clone().multiply(r.world);
      Wd[n] = w;
      const pw = (r.anc ? M[r.anc] : I).clone().multiply(r.parentWorld);
      this.bones[n].quaternion.copy(_q.copy(pw).invert().multiply(w));
    }
  }

  update(dt, { moving = false, seated = false, seatH = 0.41, speaking = 0 } = {}) {
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
    D.LeftUpLeg = qAxis(AX, -legSwing * (1 - s) - 1.52 * s);
    D.RightUpLeg = qAxis(AX, legSwing * (1 - s) - 1.52 * s);
    D.LeftLeg = qAxis(AX, Math.max(0, Math.sin(ph + Math.PI)) * 0.85 * w * (1 - s) + 1.5 * s);
    D.RightLeg = qAxis(AX, Math.max(0, Math.sin(ph)) * 0.85 * w * (1 - s) + 1.5 * s);
    D.LeftFoot = qAxis(AX, -0.05 * s);
    D.RightFoot = qAxis(AX, -0.05 * s);

    // tronco e cabeça
    const breathe = Math.sin(t * 2.1) * 0.018;
    D.Hips = qAxis(AY, sw * 0.06 * w);
    D.Spine = qAxis(AX, 0.04 * w + 0.08 * s + breathe * 0.4);
    D.Chest = qAxis(AX, breathe).multiply(qAxis(AY, -sw * 0.05 * w));
    const look = Math.sin(t * 0.43 + this.lookT) * 0.2 * (1 - w) * (1 - s * 0.6);
    const nod = Math.sin(t * 8.5) * 0.035 * this.speaking;
    D.Head = qEuler(0.06 * s + nod, look, Math.sin(t * 0.7) * 0.025);

    // braços: da pose A para o lado do corpo; balanço ao andar; digitando sentado
    const swing = sw * 0.38 * w;
    const typeL = Math.sin(t * 13) * 0.04 * s, typeR = Math.sin(t * 11 + 1) * 0.04 * s;
    D.LeftArm = qAxis(AX, swing * (1 - s) - 0.62 * s).multiply(info.armDownL);
    D.RightArm = qAxis(AX, -swing * (1 - s) - 0.62 * s).multiply(info.armDownR);
    D.LeftForeArm = qAxis(info.bendL, (0.12 + 0.22 * w) * (1 - s) + (1.05 + typeL) * s);
    D.RightForeArm = qAxis(info.bendR, (0.12 + 0.22 * w) * (1 - s) + (1.05 + typeR) * s);

    if (this.wave > 0) {
      this.wave -= dt;
      const up = Math.min(1, this.wave * 3, (2.2 - this.wave) * 5);
      D.RightArm = D.RightArm.slerp(info.waveArm, up);
      const wav = qAxis(new THREE.Vector3(0, 0, 1), Math.sin(t * 14) * 0.35);
      D.RightForeArm = D.RightForeArm.slerp(wav.multiply(info.waveFore), up);
    }

    // rosto: piscar e boca ao falar
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12 ? 1 : 0;
    if (this.blinkT < 0) this.blinkT = 2.5 + Math.random() * 4;
    if (this.bones.LBlink) { D.LBlink = qAxis(AX, 0.32 * blink); D.RBlink = qAxis(AX, 0.32 * blink); }
    if (this.bones.Jaw) D.Jaw = qAxis(AX, this.speaking * (0.08 + Math.abs(Math.sin(t * 17)) * 0.12));

    this.pose(D);

    // corpo desce ao sentar, quica levemente ao andar
    const bob = Math.abs(Math.sin(ph)) * 0.025 * w;
    const drop = (info.hipY - info.minY) * SCALE - (seatH + 0.06);
    this.inner.position.y = -info.minY * SCALE + bob - drop * s;
    this.inner.position.z = -0.04 * s;
    this.shadow.scale.setScalar(1 - bob * 2);
  }

  disposeModel() {
    this.model?.traverse((o) => { if (o.isMesh) { o.material.dispose?.(); if (!o.isSkinnedMesh) o.geometry.dispose(); } });
  }

  dispose() { this.disposed = true; this.disposeModel(); }
}

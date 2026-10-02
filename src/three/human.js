// Personagem humano estilo jogo (malha "Animated Characters" da Kenney — CC0) com:
// textura pintada por avatar, cabelos/acessórios 3D presos ao osso da cabeça e
// animação procedural por osso (andar, sentar, digitar, acenar, respirar, falar).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { paintAvatarTexture } from './skin-painter.js';
import { blobShadowTexture } from './kit.js';

const TARGET_HEIGHT = 1.58;
const ANIMATED = [
  'Hips', 'Spine', 'Chest', 'UpperChest', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
];

let BASE = null;
let INFO = null;
let shadowTex = null;

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);

function findSkinned(obj) {
  let s = null;
  obj.traverse((o) => { if (o.isSkinnedMesh && !s) s = o; });
  return s;
}

export async function loadCharacter(url = '/models/character.glb') {
  if (BASE) return;
  const gltf = await new GLTFLoader().loadAsync(url);
  BASE = gltf.scene;
  BASE.updateMatrixWorld(true);
  const skinned = findSkinned(BASE);
  const bones = skinned.skeleton.bones;
  const byName = Object.fromEntries(bones.map((b) => [b.name, b]));
  // caixas em pose de repouso (espaço do modelo)
  const all = new THREE.Box3();
  const head = new THREE.Box3();
  const hips = new THREE.Box3();
  const headIdx = bones.indexOf(byName.Head);
  const hipsIdx = bones.indexOf(byName.Hips);
  const J = skinned.geometry.attributes.skinIndex;
  const W = skinned.geometry.attributes.skinWeight;
  for (let i = 0; i < J.count; i++) {
    skinned.getVertexPosition(i, _v);
    _v.applyMatrix4(skinned.matrixWorld);
    all.expandByPoint(_v);
    let best = 0;
    for (let k = 1; k < 4; k++) if (W.getComponent(i, k) > W.getComponent(i, best)) best = k;
    const j = J.getComponent(i, best);
    if (j === headIdx) head.expandByPoint(_v);
    if (j === hipsIdx) hips.expandByPoint(_v);
  }
  const rest = {};
  for (const name of ANIMATED) {
    const b = byName[name];
    const parentName = ANIMATED.includes(b.parent?.name) ? b.parent.name : null;
    rest[name] = {
      local: b.quaternion.clone(),
      world: b.getWorldQuaternion(new THREE.Quaternion()),
      parent: parentName,
      parentWorld: b.parent.getWorldQuaternion(new THREE.Quaternion()),
    };
  }
  const hipsWorld = byName.Hips.getWorldPosition(new THREE.Vector3());
  INFO = {
    scale: TARGET_HEIGHT / (all.max.y - all.min.y),
    minY: all.min.y,
    head, hips, rest,
    hipsWorld,
    hipsParentInv: byName.Hips.parent.matrixWorld.clone().invert(),
  };
}

export function characterReady() { return !!BASE; }

const qAxis = (axis, a) => new THREE.Quaternion().setFromAxisAngle(axis, a);
function qEuler(x, y, z) { _e.set(x, y, z, 'XYZ'); return new THREE.Quaternion().setFromEuler(_e); }

function mat(color, opts = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts }); }

export class Avatar {
  constructor(config, { isMe = false } = {}) {
    if (!BASE) throw new Error('Personagem ainda não carregado');
    this.isMe = isMe;
    this.root = new THREE.Group();
    this.t = Math.random() * 100;
    this.walk = 0; this.sit = 0; this.wave = 0; this.speaking = 0; this.opacity = 1;
    this.lookT = Math.random() * 10;
    this.cfg = null;
    shadowTex ||= blobShadowTexture();
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
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
    if (this.inner) { this.root.remove(this.inner); this.disposeModel(); }
    const inner = new THREE.Group();
    inner.scale.setScalar(INFO.scale);
    inner.position.y = -INFO.minY * INFO.scale;
    const model = SkeletonUtils.clone(BASE);
    inner.add(model);
    this.inner = inner;
    this.model = model;
    this.root.add(inner);
    const skinned = findSkinned(model);
    this.texture = paintAvatarTexture(this.cfg);
    skinned.material = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.72, metalness: 0 });
    skinned.castShadow = true;
    skinned.receiveShadow = false;
    skinned.frustumCulled = false;
    this.skinned = skinned;
    this.bones = Object.fromEntries(skinned.skeleton.bones.map((b) => [b.name, b]));
    model.updateMatrixWorld(true);
    this.extras = [];
    this.buildHair();
    this.buildAccessory();
    this.buildSkirt();
    this.materials = [];
    model.traverse((o) => { if (o.isMesh) this.materials.push(o.material); });
    this.applyOpacity(this.opacity, true);
  }

  // Peças criadas no espaço do modelo (pose de repouso) e presas ao osso com attach().
  attachTo(boneName, obj) {
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    this.model.add(obj);
    obj.updateMatrixWorld(true);
    this.bones[boneName].attach(obj);
    this.extras.push(obj);
  }

  buildHair() {
    const { hairStyle: style, hairColor } = this.cfg;
    const h = INFO.head;
    const c = h.getCenter(new THREE.Vector3());
    const s = h.getSize(new THREE.Vector3());
    const m = mat(hairColor, { roughness: 0.8 });
    const g = new THREE.Group();
    if (style === 'long') {
      const back = new THREE.Mesh(new THREE.CapsuleGeometry(s.x * 0.47, s.y * 0.75, 6, 16), m);
      back.scale.set(1, 1, 0.42);
      back.position.set(c.x, c.y - s.y * 0.32, c.z - s.z * 0.34);
      g.add(back);
      [-1, 1].forEach((k) => {
        const side = new THREE.Mesh(new THREE.CapsuleGeometry(s.x * 0.11, s.y * 0.55, 4, 10), m);
        side.position.set(c.x + k * s.x * 0.47, c.y - s.y * 0.3, c.z - s.z * 0.05);
        g.add(side);
      });
    } else if (style === 'ponytail') {
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(s.x * 0.14, s.y * 0.55, 6, 12), m);
      tail.position.set(c.x, c.y - s.y * 0.05, c.z - s.z * 0.62);
      tail.rotation.x = 0.35;
      g.add(tail);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(s.x * 0.12, s.x * 0.03, 8, 16), mat('#ff6b8b'));
      tie.position.set(c.x, c.y + s.y * 0.2, c.z - s.z * 0.52);
      g.add(tie);
    } else if (style === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(s.x * 0.24, 18, 14), m);
      bun.position.set(c.x, c.y + s.y * 0.5, c.z - s.z * 0.18);
      g.add(bun);
    } else if (style === 'curly') {
      for (let i = 0; i < 26; i++) {
        const phi = Math.acos(1 - ((i + 0.5) / 26) * 1.25);
        const th = i * 2.399;
        const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
        if (dir.z > 0.55 && dir.y < 0.55) continue;
        if (['cap', 'beanie'].includes(this.cfg.accessory) && dir.y > 0.35) continue;
        const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(s.x * 0.17, 1), m);
        ball.position.set(c.x + dir.x * s.x * 0.5, c.y + s.y * 0.08 + dir.y * s.y * 0.5, c.z + dir.z * s.z * 0.5);
        g.add(ball);
      }
    }
    if (g.children.length) this.attachTo('Head', g);
  }

  buildAccessory() {
    const kind = this.cfg.accessory;
    if (!kind || kind === 'none') return;
    const h = INFO.head;
    const c = h.getCenter(new THREE.Vector3());
    const s = h.getSize(new THREE.Vector3());
    const g = new THREE.Group();
    const dark = mat('#1d2129', { roughness: 0.35 });
    const eyeY = c.y + s.y * 0.02;
    const front = h.max.z + s.z * 0.02;
    if (kind === 'glasses' || kind === 'sunglasses') {
      const lensMat = kind === 'sunglasses' ? mat('#111318', { roughness: 0.1, metalness: 0.4 }) : new THREE.MeshStandardMaterial({ color: '#d8ecff', transparent: true, opacity: 0.25, roughness: 0.05 });
      [-1, 1].forEach((k) => {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(s.x * 0.14, s.x * 0.025, 8, 24), dark);
        rim.position.set(c.x + k * s.x * 0.2, eyeY, front);
        g.add(rim);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(s.x * 0.135, 24), lensMat);
        lens.position.set(c.x + k * s.x * 0.2, eyeY, front + 0.005);
        g.add(lens);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(s.x * 0.03, s.x * 0.03, s.z * 0.55), dark);
        arm.position.set(c.x + k * s.x * 0.5, eyeY + s.y * 0.02, c.z + s.z * 0.2);
        g.add(arm);
      });
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(s.x * 0.12, s.x * 0.03, s.x * 0.03), dark);
      bridge.position.set(c.x, eyeY + s.y * 0.02, front);
      g.add(bridge);
    } else if (kind === 'headphones') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(s.x * 0.56, s.x * 0.05, 10, 32, Math.PI), dark);
      band.position.set(c.x, c.y + s.y * 0.02, c.z);
      g.add(band);
      [-1, 1].forEach((k) => {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(s.x * 0.17, s.x * 0.17, s.x * 0.12, 20), mat('#2f7bff', { roughness: 0.4 }));
        cup.rotation.z = Math.PI / 2;
        cup.position.set(c.x + k * s.x * 0.54, c.y - s.y * 0.04, c.z);
        g.add(cup);
      });
    } else if (kind === 'cap' || kind === 'beanie') {
      const color = kind === 'cap' ? '#ff5d6e' : '#7c5cff';
      const dome = new THREE.Mesh(new THREE.SphereGeometry(s.x * 0.56, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, { roughness: 0.85 }));
      dome.scale.set(1, kind === 'beanie' ? 0.95 : 0.75, s.z / s.x * 1.02);
      dome.position.set(c.x, c.y + s.y * 0.14, c.z - s.z * 0.02);
      g.add(dome);
      if (kind === 'cap') {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(s.x * 0.42, s.x * 0.42, s.x * 0.04, 24, 1, false, -Math.PI / 2, Math.PI), mat(color));
        brim.position.set(c.x, c.y + s.y * 0.16, c.z + s.z * 0.36);
        brim.scale.set(1, 1, 1.1);
        g.add(brim);
      } else {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(s.x * 0.55, s.x * 0.07, 10, 32), mat('#6a4be6', { roughness: 0.95 }));
        rim.rotation.x = Math.PI / 2;
        rim.scale.set(1, s.z / s.x, 1);
        rim.position.set(c.x, c.y + s.y * 0.14, c.z - s.z * 0.02);
        g.add(rim);
        const pom = new THREE.Mesh(new THREE.SphereGeometry(s.x * 0.13, 12, 10), mat('#ffffff', { roughness: 1 }));
        pom.position.set(c.x, c.y + s.y * 0.68, c.z - s.z * 0.02);
        g.add(pom);
      }
    }
    this.attachTo('Head', g);
  }

  buildSkirt() {
    if (this.cfg.legwear !== 'skirt') return;
    const h = INFO.hips;
    const c = h.getCenter(new THREE.Vector3());
    const s = h.getSize(new THREE.Vector3());
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(s.x * 0.55, s.x * 0.8, s.y * 1.25, 24, 1, true), mat(this.cfg.pants, { roughness: 0.85, side: THREE.DoubleSide }));
    skirt.scale.z = s.z / s.x * 1.1;
    skirt.position.set(c.x, h.min.y - s.y * 0.35, c.z);
    const g = new THREE.Group();
    g.add(skirt);
    this.attachTo('Hips', g);
  }

  setConfig(cfg) {
    if (JSON.stringify(cfg) !== JSON.stringify(this.cfg)) this.build(cfg);
  }

  applyOpacity(o, force = false) {
    if (!force && Math.abs(o - this.opacity) < 0.01) return;
    this.opacity = o;
    this.model?.traverse((c) => {
      if (!c.isMesh) return;
      const m = c.material;
      if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.opacity;
      m.transparent = o < 0.99 || m.userData.baseOpacity < 1;
      m.opacity = m.userData.baseOpacity * o;
      c.castShadow = o > 0.6;
    });
  }

  emote() { this.wave = 2.2; }

  // Aplica rotações no espaço do modelo (x = esquerda do personagem, y = cima, z = frente).
  pose(deltas, hipsOffset) {
    const M = {};
    const Wd = {};
    for (const name of ANIMATED) {
      const r = INFO.rest[name];
      const m = r.parent ? M[r.parent].clone() : new THREE.Quaternion();
      if (deltas[name]) m.multiply(deltas[name]);
      M[name] = m;
      const w = m.clone().multiply(r.world);
      Wd[name] = w;
      const pw = r.parent ? Wd[r.parent] : r.parentWorld;
      this.bones[name].quaternion.copy(_q.copy(pw).invert().multiply(w));
    }
    // posição do quadril (sentar / quicar)
    _v.copy(INFO.hipsWorld).add(hipsOffset).applyMatrix4(INFO.hipsParentInv);
    this.bones.Hips.position.copy(_v);
  }

  update(dt, { moving = false, seated = false, seatH = 0.41, speaking = 0 } = {}) {
    this.t += dt;
    this.walk += ((moving ? 1 : 0) - this.walk) * (1 - Math.exp(-dt * 10));
    this.sit += ((seated ? 1 : 0) - this.sit) * (1 - Math.exp(-dt * 6));
    this.speaking += (speaking - this.speaking) * (1 - Math.exp(-dt * 16));
    const w = this.walk * (1 - this.sit);
    const s = this.sit;
    const t = this.t;
    const ph = t * 8.2;
    const sw = Math.sin(ph);
    const D = {};

    // pernas
    const legSwing = sw * 0.6 * w;
    const kneeL = Math.max(0, Math.sin(ph + Math.PI)) * 1.0 * w;
    const kneeR = Math.max(0, Math.sin(ph)) * 1.0 * w;
    D.LeftUpLeg = qAxis(AX, -legSwing * (1 - s) - 1.5 * s);
    D.RightUpLeg = qAxis(AX, legSwing * (1 - s) - 1.5 * s);
    D.LeftLeg = qAxis(AX, kneeL * (1 - s) + 1.55 * s);
    D.RightLeg = qAxis(AX, kneeR * (1 - s) + 1.55 * s);
    D.LeftFoot = qAxis(AX, -0.1 * s);
    D.RightFoot = qAxis(AX, -0.1 * s);

    // tronco
    const breathe = Math.sin(t * 2.1) * 0.025;
    D.Spine = qAxis(AX, 0.07 * w + 0.06 * s + breathe * 0.5);
    D.Chest = qAxis(AX, breathe);
    D.Hips = qAxis(AY, sw * 0.08 * w);
    // cabeça: olha em volta parado, acena ao falar
    const look = Math.sin(t * 0.45 + this.lookT) * 0.22 * (1 - w) * (1 - s * 0.5);
    const nod = Math.sin(t * 9) * 0.06 * this.speaking;
    D.Head = qEuler(-0.04 * s + nod - 0.05 * w, look, Math.sin(t * 0.8) * 0.03);

    // braços (pose T → para baixo, balanço ao andar, digitar sentado)
    const armDown = 1.22;
    const swing = sw * 0.5 * w;
    const typeL = Math.sin(t * 13) * 0.05 * s, typeR = Math.sin(t * 11 + 1) * 0.05 * s;
    D.LeftArm = qAxis(AX, swing - 0.55 * s).multiply(qAxis(AZ, -armDown + 0.05 * Math.sin(t * 2.1)));
    D.RightArm = qAxis(AX, -swing - 0.55 * s).multiply(qAxis(AZ, armDown - 0.05 * Math.sin(t * 2.1)));
    D.LeftForeArm = qAxis(AY, -(0.18 + 0.3 * w) * (1 - s) - (1.15 + typeL) * s);
    D.RightForeArm = qAxis(AY, (0.18 + 0.3 * w) * (1 - s) + (1.15 + typeR) * s);

    // aceno (braço direito)
    if (this.wave > 0) {
      this.wave -= dt;
      const up = Math.min(1, this.wave * 3, (2.2 - this.wave) * 5);
      const raised = qAxis(AX, -0.2).multiply(qAxis(AZ, -0.12));
      D.RightArm = D.RightArm.slerp(raised, up);
      D.RightForeArm = D.RightForeArm.slerp(qAxis(AZ, -1.35 + Math.sin(t * 15) * 0.38), up);
    }

    // quadril: quica ao andar, desce ao sentar
    const bob = Math.abs(Math.sin(ph)) * 0.035 * w;
    const sitDrop = ((seatH + 0.075) / INFO.scale + INFO.minY - INFO.hipsWorld.y);
    _v.set(0, bob / INFO.scale + sitDrop * s, -0.05 * s / INFO.scale);
    this.pose(D, _v.clone());

    // anel no chão: pulsa ao falar (verde) ou para "você" (azul)
    const pulse = 0.5 + Math.sin(t * 4) * 0.5;
    const ringOp = Math.max(this.isMe ? 0.35 + pulse * 0.3 : 0, this.speaking * 0.95);
    this.ringMat.opacity = ringOp * this.opacity;
    this.ringMat.color.set(this.speaking > 0.15 ? '#22c58b' : (this.isMe ? '#3b8cff' : '#22c58b'));
    this.ring.scale.setScalar(1 + this.speaking * 0.25 + (this.isMe ? pulse * 0.06 : 0));
    this.shadow.scale.setScalar(1 - bob * 2);
  }

  disposeModel() {
    this.texture?.dispose();
    this.model?.traverse((o) => {
      if (o.isMesh) {
        if (o !== this.skinned) o.geometry.dispose();
        o.material.dispose?.();
      }
    });
  }

  dispose() { this.disposeModel(); }
}

// Miniaturas do rosto de cada personagem: renderizadas fora da tela, uma por vez, e guardadas em cache.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildHuman, disposeHuman } from './mh.js';
import { sanitizeAvatar } from '../../shared/avatar.js';

const cache = new Map(); // chave → dataURL
const waiting = new Map(); // chave → Promise
let ctx = null;
let queue = Promise.resolve();

function setup() {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight('#f4f8ff', '#8a7a6a', 1.1));
  const key = new THREE.DirectionalLight('#fff1e0', 2.2); key.position.set(1.2, 1.6, 2.4); scene.add(key);
  const rim = new THREE.DirectionalLight('#9cc8ff', 1.2); rim.position.set(-2, 1, -1.5); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 10);
  ctx = { renderer, scene, camera };
}

export function thumbKey(cfg) {
  const s = JSON.stringify(sanitizeAvatar(cfg));
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36);
}

export function cachedThumb(cfg) { return cache.get(thumbKey(cfg)) || null; }

export function avatarThumb(cfg, size = 128) {
  const key = thumbKey(cfg);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (waiting.has(key)) return waiting.get(key);
  const p = (queue = queue.then(async () => {
    if (!ctx) setup();
    const { renderer, scene, camera } = ctx;
    renderer.setSize(size, size, false);
    const h = await buildHuman(sanitizeAvatar(cfg));
    scene.add(h.group);
    h.group.updateMatrixWorld(true);
    const eyes = h.info.eyes.l.clone().add(h.info.eyes.r).multiplyScalar(0.5);
    const top = Math.max(h.info.headTop, h.info.head.max.y);
    const target = new THREE.Vector3(0, eyes.y - 0.03, eyes.z - 0.04);
    camera.position.set(0.12, target.y + 0.03, target.z + 0.78 + (top - eyes.y) * 0.4);
    camera.lookAt(target);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/webp', 0.85);
    scene.remove(h.group);
    disposeHuman(h);
    cache.set(key, url);
    waiting.delete(key);
    document.querySelectorAll(`img[data-av="${key}"]`).forEach((img) => { img.src = url; });
    return url;
  }).catch((e) => { console.warn('thumb', e); waiting.delete(key); return null; }));
  waiting.set(key, p);
  return p;
}

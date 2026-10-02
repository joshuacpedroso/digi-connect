import './style.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildOffice } from './three/office.js';
import { Avatar, loadCharacter } from './three/human.js';
import { NavGrid } from './nav.js';
import { PeerMesh } from './rtc.js';
import { api, beacon } from './api.js';
import { icons } from './icons.js';
import { DESKS, SEATS, SPAWN, WORLD, ZONES, PROXIMITY, AVATAR_OPTIONS, zoneAt, randomAvatar } from '../shared/layout.js';

// ============================================================ utilidades
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'Você';
const STATUS = { active: { label: 'Ativo', cls: 'green' }, busy: { label: 'Ocupado', cls: 'red' }, away: { label: 'Ausente', cls: 'amber' } };
const statusOf = (s) => STATUS[s] || STATUS.active;
const angleLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
const lowPower = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4;

function toast(msg, ms = 2800) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), ms);
}

function avatarChip(user, cls = '') {
  const a = user?.avatar || randomAvatar(user?.id || 'x');
  const st = user?.status ? `<i class="st dot ${statusOf(user.status).cls}"></i>` : '';
  return `<span class="p-avatar ${a.hairStyle === 'bald' ? 'bald' : ''} ${cls}" style="--skin:${a.skin};--hair:${a.hairColor};--shirt:${a.shirt}">${st}</span>`;
}

// ícones nos botões
const setIcon = (sel, svg) => { const el = $(sel); if (el) el.innerHTML = svg; };
setIcon('#zoomIn', icons.plus); setIcon('#zoomOut', icons.minus); setIcon('#centerBtn', icons.target);
setIcon('#panelClose', icons.close); setIcon('#newMeetingBtn', icons.plus); setIcon('#searchIcon', icons.search);
setIcon('#mmClose', icons.close); setIcon('#deskBtn .ico', icons.desk); setIcon('#meetBtn .ico', icons.meeting);
setIcon('#avatarBtn .ico', icons.sparkle); setIcon('#logoutBtn .ico', icons.logout);

// ============================================================ estado
const S = {
  me: null, users: new Map(), desks: {}, meetings: [], presence: new Map(), rev: -1,
  sid: Math.random().toString(36).slice(2, 12), status: 'active', micOn: true, camOn: false,
  meetingId: null, inOffice: false, driver: 'file', dismissedInvites: new Set(), lastEmote: null,
};

// ============================================================ render / cena
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;
scene.add(new THREE.HemisphereLight('#eef5ff', '#e2cfb6', 1.15));
const sun = new THREE.DirectionalLight('#fff0d8', 2.5);
sun.position.set(-12, 26, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(lowPower ? 2048 : 4096, lowPower ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#a9ccff', 0.55);
fill.position.set(22, 12, -8);
scene.add(fill);

// Qualidade adaptativa: se o FPS cair, reduz resolução e sombras automaticamente (?q=low força o mínimo).
const quality = { level: new URLSearchParams(location.search).get('q') === 'low' ? 3 : 0, frames: 0, time: 0 };
function applyQuality() {
  const L = quality.level;
  renderer.setPixelRatio(L === 0 ? Math.min(devicePixelRatio, lowPower ? 1.5 : 2) : L === 1 ? Math.min(devicePixelRatio, 1.25) : 1);
  const size = L >= 2 ? 1024 : lowPower ? 2048 : 4096;
  if (sun.shadow.mapSize.x !== size) {
    sun.shadow.mapSize.set(size, size);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  sun.castShadow = L < 3;
  resize();
}
function trackFps(dt) {
  if (quality.level >= 3 || document.hidden) return;
  quality.frames++;
  quality.time += dt;
  if (quality.time < 3) return;
  const fps = quality.frames / quality.time;
  quality.frames = 0;
  quality.time = 0;
  if (fps < 28) { quality.level++; applyQuality(); }
}

const VIEW = 17;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
const CAM_DIR = new THREE.Vector3(1, 1.2, 1).normalize();
const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const cam = { target: new THREE.Vector3(0, 0, 0), zoom: 0.5, zoomGoal: 0.62, mode: 'attract', t: 0, follow: 3 };

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  const view = aspect < 0.8 ? VIEW * 1.35 : VIEW;
  Object.assign(camera, { left: (-view * aspect) / 2, right: (view * aspect) / 2, top: view / 2, bottom: -view / 2 });
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
applyQuality();

let office, nav;
const seatMap = new Map();
for (const d of DESKS) seatMap.set(d.id, { id: d.id, x: d.seat.x, z: d.seat.z, face: d.face, h: 0.41, kind: 'desk', desk: d });
for (const s of SEATS) seatMap.set(s.id, { ...s });
const approachOf = (seat) => {
  const front = seat.kind === 'sofa' || seat.kind === 'armchair';
  const k = front ? 0.8 : -0.75;
  return { x: seat.x + Math.sin(seat.face) * k, z: seat.z + Math.cos(seat.face) * k };
};

// ============================================================ jogador local
const me = { avatar: null, pos: new THREE.Vector3(SPAWN.x, 0, SPAWN.z), ry: Math.PI * 0.75, path: [], seat: null, moving: false, lastSent: 0, lastKey: '' };
const keys = new Set();
const joy = { x: 0, y: 0 };

function tryMove(dx, dz) {
  const p = me.pos;
  if (nav.hit(p.x, p.z)) { p.x += dx; p.z += dz; return; } // escapando de dentro de um móvel (ex.: sofá)
  if (!nav.hit(p.x + dx, p.z)) p.x += dx;
  if (!nav.hit(p.x, p.z + dz)) p.z += dz;
}

function walkTo(x, z, seatId = null) {
  const seat = seatId ? seatMap.get(seatId) : null;
  const goal = seat ? approachOf(seat) : { x, z };
  if (me.seat) standUp(true);
  const path = nav.findPath({ x: me.pos.x, z: me.pos.z }, goal);
  if (!path) { if (!seat) toast('Não dá pra chegar aí 😅'); return false; }
  me.path = path.map((p) => ({ ...p }));
  if (seat) me.path.push({ x: seat.x, z: seat.z, sit: seat.id });
  hideHint();
  return true;
}

function sit(seatId) {
  const seat = seatMap.get(seatId);
  if (!seat) return;
  me.seat = seatId;
  me.path = [];
  me.pos.set(seat.x, 0, seat.z);
  me.ry = seat.face;
  sendPos(true);
  renderDock();
  if (seat.kind === 'desk' && S.desks[seatId] === S.me.id) toast('Você sentou na sua mesa ✨');
}

function standUp(silent = false) {
  if (!me.seat) return;
  const seat = seatMap.get(me.seat);
  me.seat = null;
  if (seat) { const a = approachOf(seat); me.pos.set(a.x, 0, a.z); }
  sendPos(true);
  renderDock();
  if (!silent) hideHint();
}

function goSit(seatId) {
  const occupied = [...remotes.values()].find((r) => r.seat === seatId);
  if (occupied) { toast(`${firstName(S.users.get(occupied.id)?.name)} já está sentado aí.`); return; }
  if (me.seat === seatId) return;
  const seat = seatMap.get(seatId);
  if (Math.hypot(seat.x - me.pos.x, seat.z - me.pos.z) < 1.1) { sit(seatId); return; }
  walkTo(seat.x, seat.z, seatId);
}

function updatePlayer(dt) {
  let ix = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + joy.x;
  let iy = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) + joy.y;
  let moving = false;
  if (Math.abs(ix) > 0.05 || Math.abs(iy) > 0.05) {
    if (me.seat) standUp();
    me.path = [];
    let dx = (ix - iy) * Math.SQRT1_2;
    let dz = (-ix - iy) * Math.SQRT1_2;
    const len = Math.hypot(dx, dz);
    if (len > 1) { dx /= len; dz /= len; }
    const speed = 3.6;
    tryMove(dx * speed * dt, dz * speed * dt);
    me.ry = angleLerp(me.ry, Math.atan2(dx, dz), 1 - Math.exp(-dt * 14));
    moving = true;
  } else if (me.path.length) {
    const wp = me.path[0];
    const dx = wp.x - me.pos.x, dz = wp.z - me.pos.z;
    const d = Math.hypot(dx, dz);
    const step = (wp.sit ? 2.2 : 3.8) * dt;
    if (d <= Math.max(0.04, step)) {
      me.pos.x = wp.x; me.pos.z = wp.z;
      me.path.shift();
      if (wp.sit) sit(wp.sit);
    } else {
      me.pos.x += (dx / d) * step;
      me.pos.z += (dz / d) * step;
      me.ry = angleLerp(me.ry, Math.atan2(dx, dz), 1 - Math.exp(-dt * 12));
      moving = true;
    }
  }
  if (me.seat) {
    const seat = seatMap.get(me.seat);
    me.ry = angleLerp(me.ry, seat.face, 1 - Math.exp(-dt * 10));
  }
  me.moving = moving;
  me.avatar.root.position.copy(me.pos);
  me.avatar.root.rotation.y = me.ry;
  const seat = me.seat ? seatMap.get(me.seat) : null;
  me.avatar.update(dt, { moving, seated: !!seat, seatH: seat?.h ?? 0.41, speaking: media.speaking ? Math.min(1, media.level * 9) : 0 });
  me.avatar.applyOpacity(S.status === 'away' ? 0.55 : 1);
  updateZone();
}

// ============================================================ pessoas remotas
const remotes = new Map();

function ensureRemote(id) {
  let r = remotes.get(id);
  if (r) return r;
  const u = S.users.get(id);
  if (!u) return null;
  const avatar = new Avatar(u.avatar || randomAvatar(id));
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.6, 10), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.8;
  hit.userData = { kind: 'avatar', id };
  avatar.root.add(hit);
  scene.add(avatar.root);
  r = {
    id, avatar, hit, pos: new THREE.Vector3(SPAWN.x, 0, SPAWN.z), ry: 0, target: null, seat: null,
    lastDC: 0, st: { muted: false, cam: false, meeting_id: null }, audio: null, video: null,
    analyser: null, level: 0, vol: 0, inRange: false, lastEmoteT: Date.now(), tag: null, goneAt: 0, placed: false,
  };
  remotes.set(id, r);
  return r;
}

function removeRemote(id) {
  const r = remotes.get(id);
  if (!r) return;
  scene.remove(r.avatar.root);
  r.avatar.dispose();
  r.tag?.remove();
  r.audio?.remove();
  remotes.delete(id);
}

function updateRemotes(dt) {
  for (const r of remotes.values()) {
    const seat = r.seat ? seatMap.get(r.seat) : null;
    const t = seat ? { x: seat.x, z: seat.z, ry: seat.face } : r.target;
    let moving = false;
    if (t) {
      if (!r.placed) { r.pos.set(t.x, 0, t.z); r.ry = t.ry || 0; r.placed = true; }
      const dx = t.x - r.pos.x, dz = t.z - r.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 8) r.pos.set(t.x, 0, t.z);
      else if (d > 0.01) {
        const k = 1 - Math.exp(-dt * 9);
        r.pos.x += dx * k; r.pos.z += dz * k;
        moving = d > 0.08 && !seat;
        if (moving && d > 0.15) r.ry = angleLerp(r.ry, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
      }
      if (!moving || seat) r.ry = angleLerp(r.ry, t.ry ?? r.ry, 1 - Math.exp(-dt * 8));
    }
    r.avatar.root.position.copy(r.pos);
    r.avatar.root.rotation.y = r.ry;
    if (r.analyser && r.inRange) r.level = analyserLevel(r.analyser);
    else r.level *= 0.85;
    const u = S.users.get(r.id);
    r.avatar.update(dt, { moving, seated: !!seat && Math.hypot(seat.x - r.pos.x, seat.z - r.pos.z) < 0.3, seatH: seat?.h ?? 0.41, speaking: Math.min(1, r.level * 9) });
    r.avatar.applyOpacity(u?.status === 'away' ? 0.55 : 1);
    r.avatar.root.visible = !r.goneAt;
  }
}

// ============================================================ mídia local
const media = { mic: null, cam: null, ctx: null, analyser: null, level: 0, speaking: false, speakT: 0, selfVideo: document.createElement('video') };
media.selfVideo.autoplay = true; media.selfVideo.muted = true; media.selfVideo.playsInline = true;

const micEffective = () => !!media.mic && S.micOn && S.status === 'active';

function analyserLevel(an) {
  const buf = an._buf || (an._buf = new Float32Array(an.fftSize));
  an.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

function makeAnalyser(stream) {
  if (!media.ctx) return null;
  try {
    const src = media.ctx.createMediaStreamSource(stream);
    const an = media.ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    return an;
  } catch { return null; }
}

function unlockAudio() {
  try {
    media.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (media.ctx.state === 'suspended') media.ctx.resume();
  } catch { /* sem WebAudio */ }
  $$('#audioSink audio').forEach((a) => a.play().catch(() => {}));
}

async function startMic() {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    media.mic = s.getAudioTracks()[0];
    media.analyser = makeAnalyser(new MediaStream([media.mic]));
    S.micOn = true;
  } catch {
    S.micOn = false;
    toast('Não conseguimos acessar seu microfone. Libere a permissão no navegador 🎙️', 4500);
  }
  refreshLocalMedia();
}

async function setCam(on) {
  if (on) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 320 }, frameRate: { ideal: 15, max: 20 }, facingMode: 'user' } });
      media.cam = s.getVideoTracks()[0];
      media.selfVideo.srcObject = new MediaStream([media.cam]);
      media.selfVideo.play().catch(() => {});
    } catch {
      toast('Não conseguimos acessar sua câmera 📷', 4000);
      return;
    }
  } else {
    media.cam?.stop();
    media.cam = null;
  }
  S.camOn = !!media.cam;
  refreshLocalMedia();
}

function refreshLocalMedia() {
  if (media.mic) media.mic.enabled = micEffective();
  mesh?.setLocalTracks({ audio: media.mic, video: media.cam });
  gateMedia();
  sendState();
  renderDock();
}

function measureMic(dt) {
  if (!media.analyser || !micEffective()) { media.level = 0; media.speaking = false; return; }
  media.level = analyserLevel(media.analyser);
  const loud = media.level > 0.035;
  if (loud) media.speakT = 0.35; else media.speakT -= dt;
  const speaking = media.speakT > 0;
  if (speaking !== media.speaking) { media.speaking = speaking; sendState(); }
}

// ============================================================ WebRTC / proximidade
let mesh = null;

function createMesh() {
  mesh = new PeerMesh({
    selfId: S.me.id,
    sid: S.sid,
    ice: S.ice,
    onData: handlePeerData,
    onTrack: (id, kind, stream) => {
      const r = remotes.get(id) || ensureRemote(id);
      if (!r) return;
      if (kind === 'audio') {
        if (!stream) { r.audio?.remove(); r.audio = null; r.analyser = null; return; }
        if (!r.audio) { r.audio = document.createElement('audio'); r.audio.autoplay = true; $('#audioSink').appendChild(r.audio); }
        r.audio.srcObject = stream;
        r.audio.volume = 0;
        r.audio.play().catch(() => {});
        r.analyser = makeAnalyser(stream);
      } else {
        if (!stream) { r.video = null; return; }
        r.video = document.createElement('video');
        r.video.autoplay = true; r.video.muted = true; r.video.playsInline = true;
        r.video.srcObject = stream;
        r.video.play().catch(() => {});
        if (r.tag) r.tag._bubbleKey = '';
      }
    },
    onChange: () => scheduleSync(mesh.connecting ? 500 : 2500, true),
  });
  mesh.setLocalTracks({ audio: media.mic, video: media.cam });
}

function proximity(r) {
  const u = S.users.get(r.id);
  if (!u || r.goneAt) return 0;
  if (S.status === 'away' || u.status === 'away') return 0;
  const meeting = currentMeeting();
  if (meeting) return r.st.meeting_id === meeting.id ? 1 : 0;
  if (r.st.meeting_id) return 0;
  const zm = zoneAt(me.pos.x, me.pos.z);
  const zr = zoneAt(r.pos.x, r.pos.z);
  if (zm.private || zr.private) return zm.id === zr.id ? 1 : 0;
  const d = Math.hypot(r.pos.x - me.pos.x, r.pos.z - me.pos.z);
  if (d <= PROXIMITY.full) return 1;
  if (d >= PROXIMITY.max) return 0;
  return 1 - (d - PROXIMITY.full) / (PROXIMITY.max - PROXIMITY.full);
}

let lastGate = 0;
function gateMedia(now = performance.now()) {
  lastGate = now;
  if (!mesh) return;
  for (const r of remotes.values()) {
    const v = proximity(r);
    const wasIn = r.inRange;
    r.vol = v;
    r.inRange = v > 0.001;
    mesh.setSending(r.id, { audio: r.inRange && micEffective(), video: r.inRange && S.camOn });
    if (r.audio) {
      r.audio.muted = !r.inRange;
      r.audio.volume = Math.max(0, Math.min(1, v));
    }
    if (wasIn !== r.inRange) renderCallInfo();
  }
}

function handlePeerData(id, msg) {
  const r = remotes.get(id) || ensureRemote(id);
  if (!r) return;
  if (msg.t === 'close') {
    r.goneAt = Date.now();
    r.goneSid = S.presence.get(id)?.sid;
    renderPeopleSoon();
    return;
  }
  if (msg.t === 'open') {
    r.goneAt = 0;
    mesh.send(id, posMsg());
    mesh.send(id, stateMsg());
    return;
  }
  if (msg.t === 'p') {
    r.target = { x: +msg.x || 0, z: +msg.z || 0, ry: +msg.r || 0 };
    r.seat = seatMap.has(msg.s) ? msg.s : null;
    r.lastDC = Date.now();
  } else if (msg.t === 's') {
    r.st = { ...r.st, muted: !!msg.muted, cam: !!msg.cam, meeting_id: msg.meeting || null, speaking: !!msg.speaking };
    const u = S.users.get(id);
    if (u && msg.status && STATUS[msg.status] && u.status !== msg.status) { u.status = msg.status; renderPeopleSoon(); }
    if (r.tag) r.tag._key = '';
  } else if (msg.t === 'e') {
    showEmote(r, msg.e);
    if (msg.to === S.me.id) toast(`${firstName(S.users.get(id)?.name)} acenou pra você ${msg.e}`);
  } else if (msg.t === 'inv') {
    scheduleSync(50, true);
  }
}

const posMsg = () => ({ t: 'p', x: +me.pos.x.toFixed(3), z: +me.pos.z.toFixed(3), r: +me.ry.toFixed(3), s: me.seat });
const stateMsg = () => ({ t: 's', muted: !micEffective(), cam: S.camOn, meeting: S.meetingId, speaking: media.speaking, status: S.status });

function sendPos(force = false) {
  if (!mesh) return;
  const now = performance.now();
  const key = `${me.pos.x.toFixed(2)}|${me.pos.z.toFixed(2)}|${me.ry.toFixed(2)}|${me.seat}`;
  if (force || (key !== me.lastKey && now - me.lastSent > 66) || now - me.lastSent > 1000) {
    me.lastKey = key;
    me.lastSent = now;
    mesh.broadcast(posMsg());
  }
}

function sendState() { mesh?.broadcast(stateMsg()); }

// ============================================================ sincronização com o servidor (banco JSON)
const tickerSrc = 'let t=null;onmessage=e=>{clearTimeout(t);t=setTimeout(()=>postMessage(0),e.data)}';
const ticker = new Worker(URL.createObjectURL(new Blob([tickerSrc], { type: 'text/javascript' })));
let syncing = false;
let nextSyncAt = 0;
ticker.onmessage = () => sync();

function scheduleSync(ms, sooner = false) {
  const at = Date.now() + ms;
  if (sooner && nextSyncAt && at >= nextSyncAt) return;
  nextSyncAt = at;
  ticker.postMessage(ms);
}

async function sync() {
  if (!S.inOffice) return;
  if (syncing) { scheduleSync(300); return; }
  syncing = true;
  nextSyncAt = 0;
  const signals = mesh.takeOutbox();
  try {
    const j = await api('sync', {
      sid: S.sid, x: me.pos.x, z: me.pos.z, ry: me.ry, seat: me.seat,
      muted: !micEffective(), cam: S.camOn, speaking: media.speaking, meeting_id: S.meetingId,
      emote: S.lastEmote && Date.now() - S.lastEmote.t < 6000 ? S.lastEmote : null,
      signals, rev: S.rev,
    });
    setNet(true);
    if (j.users) applyBundle(j);
    S.rev = j.rev;
    S.presence = new Map(j.presence.map((p) => [p.user_id, p]));
    applyPresence();
    for (const s of j.signals || []) mesh.handleSignal(s);
    mesh.reconcile(new Map(j.presence.filter((p) => p.user_id !== S.me.id).map((p) => [p.user_id, p.sid])));
  } catch (e) {
    if (e.status === 401) { location.reload(); return; }
    mesh.outbox.unshift(...signals);
    setNet(false);
  } finally {
    syncing = false;
  }
  if (!nextSyncAt) scheduleSync(mesh.connecting || mesh.outbox.length ? 700 : 2500);
}

function setNet(ok) {
  const p = $('#netPill');
  p.classList.toggle('online', ok);
  const n = [...remotes.values()].filter((r) => mesh?.isOpen(r.id)).length;
  $('span', p).textContent = ok ? (n ? `Online · ${n} P2P` : 'Online') : 'Reconectando…';
}

function applyBundle(j) {
  S.users = new Map(j.users.map((u) => [u.id, u]));
  S.desks = j.desks || {};
  S.meetings = j.meetings || [];
  const mine = S.users.get(S.me.id);
  if (mine) { S.me = mine; S.status = mine.status; }
  if (S.meetingId && !currentMeeting()) S.meetingId = null;
  for (const r of remotes.values()) {
    const u = S.users.get(r.id);
    if (u) r.avatar.setConfig(u.avatar);
  }
  refreshDesks();
  renderMeetings();
  renderPeopleSoon();
  renderDock();
}

function applyPresence() {
  const now = Date.now();
  for (const [id, p] of S.presence) {
    if (id === S.me.id) continue;
    const r = ensureRemote(id);
    if (!r) continue;
    if (r.goneAt && p.sid === r.goneSid && now - r.goneAt < 40000) continue;
    r.goneAt = 0;
    if (!mesh.isOpen(id) || now - r.lastDC > 3000) {
      r.target = { x: p.x, z: p.z, ry: p.ry };
      r.seat = p.seat;
      r.st = { ...r.st, muted: p.muted, cam: p.cam, meeting_id: p.meeting_id };
    }
    if (p.emote && p.emote.t > r.lastEmoteT && !mesh.isOpen(id)) { r.lastEmoteT = p.emote.t; showEmote(r, p.emote.e); }
  }
  for (const id of [...remotes.keys()]) if (!S.presence.has(id)) removeRemote(id);
  renderPeopleSoon();
  renderCallInfo();
  renderOnline();
}

// ============================================================ mesas
function refreshDesks() {
  if (!office) return;
  for (const [id, d] of office.desks) {
    const owner = S.desks[id];
    const u = owner ? S.users.get(owner) : null;
    if (owner && owner === S.me?.id) { d.ringMat.color.set('#3b8cff'); d.ringMat.opacity = 0.9; }
    else if (u) { d.ringMat.color.set(u.avatar?.shirt || '#22c58b'); d.ringMat.opacity = 0.7; }
    else { d.ringMat.color.set('#ffffff'); d.ringMat.opacity = 0.35; }
    d.mine = owner === S.me?.id;
  }
  const myDesk = myDeskId();
  $('#meDesk').textContent = myDesk ? `${seatMap.get(myDesk).desk.label} · ${seatMap.get(myDesk).desk.zone}` : 'Sem mesa ainda — clique numa mesa livre';
}

const myDeskId = () => Object.keys(S.desks).find((id) => S.desks[id] === S.me?.id) || null;

async function assignDesk(deskId) {
  try {
    await api('assign_desk', { desk_id: deskId });
    S.desks = Object.fromEntries(Object.entries(S.desks).filter(([, v]) => v !== S.me.id));
    S.desks[deskId] = S.me.id;
    refreshDesks();
    renderDock();
    toast(`${seatMap.get(deskId).desk.label} agora é sua! Indo sentar… 🪑`);
    goSit(deskId);
    scheduleSync(100, true);
  } catch (e) { toast(e.message); }
}

async function releaseDesk() {
  try {
    await api('unassign_desk');
    const id = myDeskId();
    if (id) delete S.desks[id];
    if (me.seat === id) standUp(true);
    refreshDesks();
    renderDock();
    toast('Mesa liberada.');
  } catch (e) { toast(e.message); }
}

// ============================================================ popovers
function openPop(html, x, y) {
  const pop = $('#pop');
  pop.innerHTML = html;
  pop.hidden = false;
  const w = 280, h = pop.offsetHeight || 220;
  pop.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, x + 14))}px`;
  pop.style.top = `${Math.max(12, Math.min(innerHeight - h - 12, y + 10))}px`;
  return pop;
}
function closePop() { $('#pop').hidden = true; $('#statusMenu').hidden = true; }

function openDeskPop(deskId, x, y) {
  const desk = seatMap.get(deskId).desk;
  const owner = S.desks[deskId];
  const u = owner ? S.users.get(owner) : null;
  if (owner && owner !== S.me.id) {
    const online = S.presence.has(owner);
    const pop = openPop(`
      <div class="pop-head">${avatarChip(u)}<div><strong>Mesa de ${esc(u?.name || 'alguém')}</strong><small>${esc(desk.label)} · ${esc(desk.zone)} · ${online ? 'online' : 'offline'}</small></div></div>
      ${online ? `<button data-a="go"><span class="i">${icons.walk}</span>Ir até ${esc(firstName(u?.name))}</button><button data-a="wave"><span class="i">👋</span>Acenar</button><button data-a="meet"><span class="i">${icons.meeting}</span>Chamar para reunião</button>` : '<p>Essa pessoa está offline agora.</p>'}`, x, y);
    pop.onclick = (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'go') goToPerson(owner);
      if (a === 'wave') waveAt(owner);
      if (a === 'meet') openMeetingModal(owner);
      if (a) closePop();
    };
    return;
  }
  const mine = owner === S.me.id;
  const current = myDeskId();
  const pop = openPop(`
    <div class="pop-head"><span class="pop-ico">${icons.desk}</span><div><strong>${esc(desk.label)} · ${esc(desk.zone)}</strong><small><i class="dot ${mine ? 'green' : 'gray'}"></i>${mine ? 'Sua mesa' : 'Livre'}</small></div></div>
    ${mine
    ? `<button class="primary" data-a="sit">Sentar na minha mesa</button><button data-a="release"><span class="i">${icons.close}</span>Liberar esta mesa</button>`
    : `<button class="primary" data-a="assign">Atribuir a mim e sentar 🪑</button>${current ? `<p>Sua mesa atual (${esc(seatMap.get(current).desk.label)}) será liberada.</p>` : '<p>Ela fica guardada no seu nome — sua equipe vê onde você senta.</p>'}`}`, x, y);
  pop.onclick = (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'sit') goSit(deskId);
    if (a === 'assign') assignDesk(deskId);
    if (a === 'release') releaseDesk();
    if (a) closePop();
  };
}

function openPersonPop(id, x, y) {
  const u = S.users.get(id);
  if (!u || id === S.me.id) return;
  const r = remotes.get(id);
  const online = !!r;
  const desk = Object.keys(S.desks).find((d) => S.desks[d] === id);
  const pop = openPop(`
    <div class="pop-head">${avatarChip(u, 'big')}<div><strong>${esc(u.name)}</strong><small><i class="dot ${online ? statusOf(u.status).cls : 'gray'}"></i>${online ? statusOf(u.status).label : 'Offline'}${r?.st.muted ? ' · mudo' : ''}${online ? ` · ${esc(zoneAt(r.pos.x, r.pos.z).label)}` : ''}</small></div></div>
    ${online ? `<button data-a="go"><span class="i">${icons.walk}</span>Ir até ${esc(firstName(u.name))}</button><button data-a="wave"><span class="i">👋</span>Acenar</button><button data-a="meet"><span class="i">${icons.meeting}</span>Reunião privada</button>` : ''}
    ${desk ? `<button data-a="desk"><span class="i">${icons.pin}</span>Ver mesa (${esc(seatMap.get(desk).desk.label)})</button>` : ''}
    ${!online && !desk ? '<p>Offline e sem mesa atribuída.</p>' : ''}`, x, y);
  pop.onclick = (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'go') goToPerson(id);
    if (a === 'wave') waveAt(id);
    if (a === 'meet') openMeetingModal(id);
    if (a === 'desk') { const s = seatMap.get(desk); walkTo(approachOf(s).x, approachOf(s).z); }
    if (a) closePop();
  };
}

function goToPerson(id) {
  const r = remotes.get(id);
  if (!r) return;
  const ang = Math.atan2(me.pos.x - r.pos.x, me.pos.z - r.pos.z);
  for (const rad of [1.1, 1.5, 2.0]) {
    for (let k = 0; k < 8; k++) {
      const a = ang + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.6;
      const x = r.pos.x + Math.sin(a) * rad, z = r.pos.z + Math.cos(a) * rad;
      if (!nav.hit(x, z) && walkTo(x, z)) return;
    }
  }
  toast('Não achei caminho até essa pessoa 😅');
}

function waveAt(id) {
  emote('👋');
  mesh?.send(id, { t: 'e', e: '👋', to: id });
}

// ============================================================ emotes
function emote(e) {
  if (!S.inOffice) return;
  S.lastEmote = { e, t: Date.now() };
  me.avatar.emote();
  showEmote({ tag: me.tag, avatar: me.avatar }, e, true);
  mesh?.broadcast({ t: 'e', e });
}

function showEmote(r, e) {
  if (!r.tag) return;
  if (e === '👋') r.avatar?.emote();
  const el = document.createElement('span');
  el.className = 'emote';
  el.textContent = e;
  el.style.setProperty('--p', `translate(${-50 + (Math.random() * 30 - 15)}%, 0)`);
  el.style.left = '50%';
  el.style.top = '-46px';
  r.tag.appendChild(el);
  setTimeout(() => el.remove(), 2300);
}

// ============================================================ etiquetas (nomes, bolhas de vídeo)
const overlay = $('#overlay');
const tmpV = new THREE.Vector3();

function makeTag(isMe) {
  const el = document.createElement('div');
  el.className = 'tag' + (isMe ? ' me' : '');
  el.innerHTML = '<div class="bubble" hidden></div><div class="name"></div>';
  overlay.appendChild(el);
  return el;
}

function project(pos, y) {
  tmpV.set(pos.x, y, pos.z).project(camera);
  return { x: (tmpV.x * 0.5 + 0.5) * innerWidth, y: (-tmpV.y * 0.5 + 0.5) * innerHeight, ok: tmpV.z < 1 && tmpV.z > -1 };
}

function placeTag(el, pos, y, z = 0) {
  const p = project(pos, y);
  const off = p.x < -120 || p.x > innerWidth + 120 || p.y < -120 || p.y > innerHeight + 160;
  el.style.display = off || !p.ok ? 'none' : '';
  if (!off) {
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    el.style.zIndex = String(Math.round(p.y) + z);
  }
}

function renderTag(el, { name, status, muted, speaking, away, video, mirror, isMe }) {
  el.classList.toggle('speaking', !!speaking);
  el.classList.toggle('away', !!away);
  const key = `${name}|${status}|${muted}|${away}|${isMe}`;
  if (el._key !== key) {
    el._key = key;
    el.querySelector('.name').innerHTML = `<i class="dot ${statusOf(status).cls}"></i><span>${esc(name)}</span>${muted ? `<span class="mi">${icons.micOff}</span>` : ''}${away ? '<span class="zz">z<sup>z</sup></span>' : ''}`;
  }
  const bubble = el.querySelector('.bubble');
  const bkey = video ? (video.srcObject?.id || 'v') : '';
  if (el._bubbleKey !== bkey) {
    el._bubbleKey = bkey;
    bubble.innerHTML = '';
    bubble.hidden = !video;
    bubble.classList.toggle('remote', !mirror);
    if (video) { bubble.appendChild(video); video.play().catch(() => {}); }
  }
}

function updateOverlay() {
  if (!S.inOffice) return;
  const zoomScale = Math.max(0.75, Math.min(1.15, cam.zoom));
  overlay.style.setProperty('--zs', zoomScale);
  // eu
  if (!me.tag) me.tag = makeTag(true);
  renderTag(me.tag, {
    name: firstName(S.me.name), status: S.status, muted: !micEffective(), speaking: media.speaking,
    away: S.status === 'away', video: S.camOn ? media.selfVideo : null, mirror: true, isMe: true,
  });
  placeTag(me.tag, me.pos, me.seat ? 1.5 : 1.62, 2);
  // remotos
  for (const r of remotes.values()) {
    if (!r.tag) r.tag = makeTag(false);
    const u = S.users.get(r.id);
    const speaking = r.inRange && r.level > 0.02;
    renderTag(r.tag, {
      name: firstName(u?.name), status: u?.status, muted: r.st.muted, speaking,
      away: u?.status === 'away', video: r.st.cam && r.inRange && r.video ? r.video : null, mirror: false,
    });
    if (r.goneAt) { r.tag.style.display = 'none'; continue; }
    placeTag(r.tag, r.pos, r.seat ? 1.5 : 1.62, 1);
  }
  // nomes nas mesas
  const showDesk = cam.zoom > 1.1;
  for (const [id, d] of office.desks) {
    const owner = S.desks[id];
    let el = d.tagEl;
    if (!owner || !showDesk) { if (el) el.style.display = 'none'; continue; }
    if (!el) { el = d.tagEl = document.createElement('div'); el.className = 'desk-tag'; overlay.appendChild(el); }
    const u = S.users.get(owner);
    const txt = owner === S.me.id ? 'Minha mesa' : `Mesa de ${firstName(u?.name)}`;
    if (el.textContent !== txt) el.textContent = txt;
    el.classList.toggle('mine', owner === S.me.id);
    const seatTaken = me.seat === id || [...remotes.values()].some((r) => r.seat === id);
    tmpV.set(d.desk.x, 0, d.desk.z);
    placeTag(el, tmpV, seatTaken ? 0.05 : 0.9, -400);
    if (seatTaken) el.style.display = 'none';
  }
}

// ============================================================ zona atual + chamada
let currentZone = null;
function updateZone() {
  const z = zoneAt(me.pos.x, me.pos.z);
  if (currentZone?.id === z.id) return;
  const prev = currentZone;
  currentZone = z;
  const el = $('#zoneName');
  el.classList.toggle('private', !!z.private);
  $('span', el).textContent = z.label;
  if (prev && z.private) toast(`🔒 ${z.label} — só quem está aqui dentro te escuta`);
  gateMedia();
  renderCallInfo();
}

const currentMeeting = () => (S.meetingId ? S.meetings.find((m) => m.id === S.meetingId && m.status === 'open') : null);

function renderCallInfo() {
  if (!S.inOffice) return;
  const box = $('#callInfo');
  const inRange = [...remotes.values()].filter((r) => r.inRange);
  const names = inRange.map((r) => firstName(S.users.get(r.id)?.name));
  const meeting = currentMeeting();
  const list = (n) => (n.length > 3 ? `${n.slice(0, 3).join(', ')} +${n.length - 3}` : n.join(', '));
  box.classList.toggle('private', !!meeting || !!currentZone?.private);
  $('#leaveMeetingBtn').hidden = !meeting;
  if (meeting) {
    box.hidden = false;
    $('#callTitle').textContent = `🔒 ${meeting.title}`;
    $('#callSub').textContent = names.length ? `Na chamada: ${list(names)}` : 'Aguardando os convidados entrarem…';
  } else if (currentZone?.private) {
    box.hidden = false;
    $('#callTitle').textContent = `${currentZone.label} · conversa privada`;
    $('#callSub').textContent = names.length ? `Aqui com você: ${list(names)}` : 'Só você por aqui';
  } else if (names.length) {
    box.hidden = false;
    $('#callTitle').textContent = 'Conversa por proximidade';
    $('#callSub').textContent = `Ouvindo: ${list(names)}`;
  } else box.hidden = true;
}

// ============================================================ HUD: dock, pessoas, reuniões
function renderDock() {
  if (!S.me) return;
  const mic = $('#micBtn');
  const forced = S.status !== 'active';
  const micOn = micEffective();
  mic.classList.toggle('off', !micOn);
  mic.classList.toggle('speaking', media.speaking);
  $('.ico', mic).innerHTML = micOn ? icons.mic : icons.micOff;
  $('small', mic).textContent = micOn ? 'Mic' : forced ? 'Mudo (status)' : 'Mudo';
  const camB = $('#camBtn');
  camB.classList.toggle('on', S.camOn);
  camB.classList.toggle('off', !S.camOn);
  $('.ico', camB).innerHTML = S.camOn ? icons.cam : icons.camOff;
  $('small', camB).textContent = S.camOn ? 'Câmera' : 'Câm. off';
  const desk = $('#deskBtn');
  if (me.seat) { $('.ico', desk).innerHTML = icons.stand; $('small', desk).textContent = 'Levantar'; desk.title = 'Levantar'; }
  else { $('.ico', desk).innerHTML = icons.desk; $('small', desk).textContent = 'Minha mesa'; desk.title = 'Ir para minha mesa'; }
  desk.classList.toggle('active', !!me.seat);
  $('#meetBtn').classList.toggle('active', !!currentMeeting());
  const st = statusOf(S.status);
  $('#statusBtn .ico').innerHTML = `<i class="dot ${st.cls}"></i>`;
  $('#statusLabel').textContent = st.label;
  $$('#statusSeg button').forEach((b) => b.classList.toggle('on', b.dataset.status === S.status));
  $('#meName').textContent = S.me.name;
  $('#meAvatar').outerHTML = avatarChip(S.me, 'big').replace('<span class="p-avatar', '<span id="meAvatar" class="p-avatar');
}

function renderOnline() {
  const online = [S.me, ...[...remotes.keys()].map((id) => S.users.get(id)).filter(Boolean)];
  $('#onlineCount').textContent = online.length;
  $('#onlineStack').innerHTML = online.slice(0, 4).map((u) => avatarChip(u)).join('');
}

let peopleTimer = null;
function renderPeopleSoon() { clearTimeout(peopleTimer); peopleTimer = setTimeout(renderPeople, 120); }

function renderPeople() {
  if (!S.me) return;
  const q = $('#peopleSearch').value.trim().toLowerCase();
  const users = [...S.users.values()].filter((u) => !q || u.name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
  const onlineIds = new Set([S.me.id, ...remotes.keys()]);
  const row = (u) => {
    const online = onlineIds.has(u.id);
    const isMe = u.id === S.me.id;
    const r = remotes.get(u.id);
    const desk = Object.keys(S.desks).find((d) => S.desks[d] === u.id);
    const where = isMe ? zoneAt(me.pos.x, me.pos.z).label : r ? zoneAt(r.pos.x, r.pos.z).label : desk ? seatMap.get(desk).desk.label : 'Offline';
    const muted = isMe ? !micEffective() : r?.st.muted;
    const speaking = isMe ? media.speaking : r?.inRange && r.level > 0.02;
    return `<button class="person ${online ? '' : 'offline'}" data-id="${u.id}">
      ${avatarChip({ ...u, status: online ? u.status : null })}
      <span><strong>${esc(u.name)}${isMe ? '<em>Você</em>' : ''}</strong><small>${online ? `<i class="dot ${statusOf(u.status).cls}"></i>${statusOf(u.status).label} · ` : ''}${esc(where)}</small></span>
      <span class="flags">${online && muted ? `<span class="off">${icons.micOff}</span>` : ''}${speaking ? `<span class="speaking">${icons.mic}</span>` : ''}</span>
    </button>`;
  };
  const on = users.filter((u) => onlineIds.has(u.id)).sort((a, b) => (a.id === S.me.id ? -1 : b.id === S.me.id ? 1 : a.name.localeCompare(b.name)));
  const off = users.filter((u) => !onlineIds.has(u.id)).sort((a, b) => a.name.localeCompare(b.name));
  $('#peopleCount').textContent = on.length;
  $('#peopleList').innerHTML = `<div class="group-title">Online · ${on.length}</div>${on.map(row).join('')}${off.length ? `<div class="group-title">Offline · ${off.length}</div>${off.map(row).join('')}` : ''}`;
}

$('#peopleList').addEventListener('click', (e) => {
  const b = e.target.closest('.person');
  if (!b) return;
  const id = b.dataset.id;
  if (id === S.me.id) { cam.snap = 0.4; return; }
  openPersonPop(id, e.clientX - 300, e.clientY - 40);
});
$('#peopleSearch').addEventListener('input', renderPeople);

function renderMeetings() {
  if (!S.me) return;
  const active = currentMeeting();
  const pending = S.meetings.filter((m) => m.status === 'open' && !(m.joined || []).includes(S.me.id) && m.id !== S.meetingId);
  const names = (m) => m.participants.map((id) => (id === S.me.id ? 'você' : firstName(S.users.get(id)?.name))).join(', ');
  let html = '';
  if (active) html += `<div class="meeting-item"><div class="row"><strong>🔒 ${esc(active.title)}</strong><button class="btn-danger sm" data-leave="${active.id}">Sair</button></div><small>Com ${esc(names(active))}</small></div>`;
  for (const m of pending) html += `<div class="meeting-item"><div class="row"><strong>${esc(m.title)}</strong><button class="btn-primary sm" data-join="${m.id}">Entrar</button></div><small>Convite de ${esc(firstName(S.users.get(m.host_id)?.name))} · ${esc(names(m))}</small></div>`;
  $('#meetingList').innerHTML = html || '<div class="meeting-empty">Nenhuma reunião agora. Clique em + para chamar alguém.</div>';
  // card de convite
  const invite = pending.find((m) => !S.dismissedInvites.has(m.id));
  const card = $('#inviteCard');
  if (invite && !active) {
    const host = S.users.get(invite.host_id);
    card.dataset.id = invite.id;
    $('#icAvatar').outerHTML = avatarChip(host, 'big').replace('<span class="p-avatar', '<span id="icAvatar" class="p-avatar');
    $('#icTitle').textContent = invite.title;
    $('#icFrom').textContent = `${firstName(host?.name)} chamou você para uma reunião privada`;
    if (card.hidden) { card.hidden = false; playDing(); }
  } else card.hidden = true;
  renderCallInfo();
  renderDock();
}

$('#meetingList').addEventListener('click', (e) => {
  const j = e.target.closest('[data-join]')?.dataset.join;
  const l = e.target.closest('[data-leave]')?.dataset.leave;
  if (j) joinMeeting(j);
  if (l) leaveMeeting();
});

async function joinMeeting(id) {
  try {
    const j = await api('join_meeting', { meeting_id: id });
    S.meetings = S.meetings.filter((m) => m.id !== id).concat(j.meeting);
    S.meetingId = id;
    $('#inviteCard').hidden = true;
    renderMeetings();
    gateMedia(); sendState();
    toast('Você entrou na reunião privada 🔒');
    scheduleSync(100, true);
  } catch (e) { toast(e.message); }
}

async function leaveMeeting() {
  const id = S.meetingId;
  if (!id) return;
  S.meetingId = null;
  renderMeetings();
  gateMedia(); sendState();
  try { await api('leave_meeting', { meeting_id: id }); } catch { /* */ }
  toast('Você saiu da reunião.');
  scheduleSync(100, true);
}

$('#icJoin').onclick = () => joinMeeting($('#inviteCard').dataset.id);
$('#icDecline').onclick = async () => {
  const id = $('#inviteCard').dataset.id;
  S.dismissedInvites.add(id);
  $('#inviteCard').hidden = true;
  try { await api('decline_meeting', { meeting_id: id }); } catch { /* */ }
  scheduleSync(100, true);
};
$('#leaveMeetingBtn').onclick = leaveMeeting;

function openMeetingModal(preselect = null) {
  closePop();
  const candidates = [...remotes.keys()].map((id) => S.users.get(id)).filter(Boolean);
  $('#inviteList').innerHTML = candidates.map((u) => `<label class="invite">${avatarChip(u)}<span><strong>${esc(u.name)}</strong><small><i class="dot ${statusOf(u.status).cls}"></i>${statusOf(u.status).label}</small></span><input type="checkbox" value="${u.id}" ${u.id === preselect ? 'checked' : ''} /></label>`).join('')
    || '<div class="empty">Ninguém mais está online agora 😴<br />Chame sua equipe pelo link do escritório!</div>';
  $('#mmSubject').value = '';
  $('#meetingModal').hidden = false;
}
$('#mmClose').onclick = () => { $('#meetingModal').hidden = true; };
$('#meetingModal').addEventListener('pointerdown', (e) => { if (e.target.id === 'meetingModal') $('#meetingModal').hidden = true; });
$('#mmCreate').onclick = async () => {
  const participants = $$('#inviteList input:checked').map((i) => i.value);
  if (!participants.length) { toast('Selecione pelo menos uma pessoa.'); return; }
  try {
    const j = await api('create_meeting', { participants, title: $('#mmSubject').value || 'Reunião privada' });
    S.meetings.push(j.meeting);
    S.meetingId = j.meeting.id;
    $('#meetingModal').hidden = true;
    participants.forEach((id) => mesh?.send(id, { t: 'inv' }));
    renderMeetings();
    gateMedia(); sendState();
    toast('Reunião criada! Convites enviados 📨');
    scheduleSync(100, true);
  } catch (e) { toast(e.message); }
};
$('#newMeetingBtn').onclick = () => openMeetingModal();

function playDing() {
  if (!media.ctx) return;
  try {
    const t = media.ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = media.ctx.createOscillator(), g = media.ctx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0, t + i * 0.12);
      g.gain.linearRampToValueAtTime(0.12, t + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.4);
      o.connect(g).connect(media.ctx.destination);
      o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.45);
    });
  } catch { /* */ }
}

// ---------------------------------------------------- dock / status
$('#micBtn').onclick = async () => {
  unlockAudio();
  if (S.status !== 'active') { toast(`Seu status está "${statusOf(S.status).label}" — mude para Ativo para falar.`); return; }
  if (!media.mic) { await startMic(); return; }
  S.micOn = !S.micOn;
  refreshLocalMedia();
};
$('#camBtn').onclick = () => { unlockAudio(); setCam(!S.camOn); };
$('#deskBtn').onclick = () => {
  if (me.seat) { standUp(); return; }
  const id = myDeskId();
  if (!id) { toast('Clique numa mesa livre (anel branco) para torná-la sua 🪑'); return; }
  goSit(id);
};
$('#meetBtn').onclick = () => (currentMeeting() ? leaveMeeting() : openMeetingModal());
$('#emotes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) emote(b.dataset.e); });

async function setStatus(status) {
  closePop();
  if (status === S.status) return;
  const prev = S.status;
  S.status = status;
  S.me.status = status;
  refreshLocalMedia();
  try { await api('set_status', { status }); scheduleSync(100, true); } catch (e) { S.status = prev; refreshLocalMedia(); toast(e.message); }
  if (status === 'busy') toast('Ocupado: seu microfone fica sempre mudo 🔇');
  if (status === 'away') toast('Ausente: você sai das conversas até voltar 💤');
}
$('#statusBtn').onclick = (e) => {
  const m = $('#statusMenu');
  if (!m.hidden) { m.hidden = true; return; }
  m.hidden = false;
  const r = e.currentTarget.getBoundingClientRect();
  m.style.left = `${Math.min(innerWidth - 252, r.left - 90)}px`;
  m.style.top = `${r.top - m.offsetHeight - 10}px`;
};
$('#statusMenu').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setStatus(b.dataset.status); });
$('#statusSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setStatus(b.dataset.status); });
$('#peopleToggle').onclick = () => $('#hud').classList.toggle('panel-open');
$('#panelClose').onclick = () => $('#hud').classList.remove('panel-open');
$('#zoomIn').onclick = () => { cam.zoomGoal = Math.min(3, cam.zoomGoal * 1.2); };
$('#zoomOut').onclick = () => { cam.zoomGoal = Math.max(0.5, cam.zoomGoal / 1.2); };
$('#centerBtn').onclick = () => { cam.snap = 0.4; cam.zoomGoal = innerWidth < 860 ? 1.5 : 1.9; };
$('#avatarBtn').onclick = () => openCustomizer(false);
$('#logoutBtn').onclick = async () => {
  if (!confirm('Sair do escritório?')) return;
  mesh?.closeAll();
  try { await api('logout'); } catch { /* */ }
  location.reload();
};

let hintHidden = false;
function hideHint() { if (!hintHidden) { hintHidden = true; $('#hint').classList.add('fade'); } }

// ============================================================ entrada (teclado, mouse, joystick, minimapa)
const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closePop(); $('#meetingModal').hidden = true; return; }
  if (!S.inOffice || typing() || !$('#customizer').hidden) return;
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { e.preventDefault(); keys.add(k); hideHint(); closePop(); }
  if (e.repeat) return;
  if (k === 'm') $('#micBtn').click();
  if (k === 'v') $('#camBtn').click();
  const em = ['👋', '❤️', '😂', '🎉', '👍'][Number(k) - 1];
  if (em) emote(em);
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function pick(cx, cy) {
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const av = raycaster.intersectObjects([...remotes.values()].filter((r) => !r.goneAt).map((r) => r.hit), false)[0];
  if (av) return av.object.userData;
  const h = raycaster.intersectObjects(office.clickables, false)[0];
  if (h) return h.object.userData;
  const p = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(floorPlane, p)) return { kind: 'floor', x: p.x, z: p.z };
  return null;
}

let downAt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; unlockAudio(); });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || !S.inOffice) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 8) return;
  closePop();
  const hit = pick(e.clientX, e.clientY);
  if (!hit) return;
  if (hit.kind === 'avatar') openPersonPop(hit.id, e.clientX, e.clientY);
  else if (hit.kind === 'desk') openDeskPop(hit.id, e.clientX, e.clientY);
  else if (hit.kind === 'seat') goSit(hit.id);
  else if (hit.kind === 'floor') {
    if (hit.x < WORLD.minX || hit.x > WORLD.maxX || hit.z < WORLD.minZ || hit.z > WORLD.maxZ) return;
    walkTo(hit.x, hit.z);
    spawnClickRipple(hit.x, hit.z);
  }
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (!S.inOffice) return;
  cam.zoomGoal = Math.max(0.5, Math.min(3, cam.zoomGoal * Math.exp(-e.deltaY * 0.0012)));
}, { passive: false });

let hoverQueued = null;
canvas.addEventListener('pointermove', (e) => {
  if (!S.inOffice || e.pointerType === 'touch') return;
  if (hoverQueued) { hoverQueued = e; return; }
  hoverQueued = e;
  requestAnimationFrame(() => {
    const ev = hoverQueued;
    hoverQueued = null;
    const hit = pick(ev.clientX, ev.clientY);
    const tip = $('#hoverTip');
    let text = '';
    if (hit?.kind === 'desk') {
      const owner = S.desks[hit.id];
      const d = seatMap.get(hit.id).desk;
      text = owner === S.me.id ? `${d.label} · sua mesa — clique para sentar` : owner ? `${d.label} · mesa de ${firstName(S.users.get(owner)?.name)}` : `${d.label} · ${d.zone} — livre, clique para atribuir`;
    } else if (hit?.kind === 'seat') text = 'Clique para sentar';
    else if (hit?.kind === 'avatar') text = `${S.users.get(hit.id)?.name || 'Pessoa'} — clique para opções`;
    canvas.style.cursor = text ? 'pointer' : 'default';
    tip.hidden = !text;
    if (text) { tip.textContent = text; tip.style.left = `${ev.clientX + 16}px`; tip.style.top = `${ev.clientY + 16}px`; }
  });
});
canvas.addEventListener('pointerleave', () => { $('#hoverTip').hidden = true; });
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.pop') && !e.target.closest('#statusBtn')) closePop();
}, true);

// marcador de clique no chão
const ripples = [];
function spawnClickRipple(x, z) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 32), new THREE.MeshBasicMaterial({ color: '#3b8cff', transparent: true, opacity: 0.9, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.03, z);
  scene.add(m);
  ripples.push({ m, t: 0 });
}
function updateRipples(dt) {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.t += dt;
    r.m.scale.setScalar(1 + r.t * 3);
    r.m.material.opacity = Math.max(0, 0.9 - r.t * 1.6);
    if (r.t > 0.6) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); ripples.splice(i, 1); }
  }
}

// joystick (toque)
(() => {
  const pad = $('#joystick'), knob = $('i', pad);
  let id = null;
  const move = (e) => {
    const r = pad.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    joy.x = dx; joy.y = -dy;
    knob.style.transform = `translate(${dx * 32}px, ${dy * 32}px)`;
  };
  pad.addEventListener('pointerdown', (e) => { id = e.pointerId; pad.setPointerCapture(id); move(e); unlockAudio(); hideHint(); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  const end = () => { id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
})();

// minimapa
const mini = $('#minimap canvas');
const mctx = mini.getContext('2d');
const MS = mini.width / (WORLD.maxX - WORLD.minX);
const mx = (x) => (x - WORLD.minX) * MS;
const mz = (z) => (z - WORLD.minZ) * MS;
function drawMinimap() {
  if (!S.inOffice || mini.offsetParent === null) return;
  const c = mctx;
  c.clearRect(0, 0, mini.width, mini.height);
  c.fillStyle = '#e9dcc9'; c.fillRect(0, 0, mini.width, mini.height);
  const zoneColors = { meeting: '#5d6c96', booth1: '#a79dd8', booth2: '#a79dd8', cafe: '#f5efe6', lounge: '#f0dcc0', reception: '#d8e6ff', work: '#efe4d3' };
  for (const z of ZONES) { c.fillStyle = zoneColors[z.id] || '#eee'; c.fillRect(mx(z.x0), mz(z.z0), (z.x1 - z.x0) * MS, (z.z1 - z.z0) * MS); }
  c.fillStyle = 'rgba(40,50,75,.28)';
  for (const o of office.obstacles) c.fillRect(mx(o.x0), mz(o.z0), Math.max(1, (o.x1 - o.x0) * MS), Math.max(1, (o.z1 - o.z0) * MS));
  for (const [id, d] of office.desks) {
    const owner = S.desks[id];
    c.fillStyle = owner === S.me.id ? '#3b8cff' : owner ? (S.users.get(owner)?.avatar?.shirt || '#22c58b') : '#ffffff';
    c.fillRect(mx(d.desk.x) - 4, mz(d.desk.z) - 2, 8, 4);
  }
  for (const r of remotes.values()) {
    if (r.goneAt) continue;
    c.beginPath(); c.arc(mx(r.pos.x), mz(r.pos.z), 4, 0, Math.PI * 2);
    c.fillStyle = S.users.get(r.id)?.avatar?.shirt || '#22c58b'; c.fill();
    c.lineWidth = 1.5; c.strokeStyle = '#fff'; c.stroke();
  }
  c.beginPath(); c.arc(mx(me.pos.x), mz(me.pos.z), 7, 0, Math.PI * 2); c.fillStyle = 'rgba(59,140,255,.25)'; c.fill();
  c.beginPath(); c.arc(mx(me.pos.x), mz(me.pos.z), 4.5, 0, Math.PI * 2); c.fillStyle = '#3b8cff'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke();
}
mini.addEventListener('click', (e) => {
  const r = mini.getBoundingClientRect();
  const x = WORLD.minX + ((e.clientX - r.left) / r.width) * (WORLD.maxX - WORLD.minX);
  const z = WORLD.minZ + ((e.clientY - r.top) / r.height) * (WORLD.maxZ - WORLD.minZ);
  walkTo(x, z);
});

// ============================================================ figurantes da tela inicial
const npcs = [];
function spawnNpcs() {
  const seats = ['desk-02', 'desk-07', 'desk-11', 'desk-16', 'sofa-1', 'meet-n1', 'meet-s0', 'bar-1'];
  const names = ['ana', 'joão', 'bia', 'leo', 'duda', 'rafa', 'gabi', 'theo', 'nina', 'caio'];
  seats.forEach((sid, i) => {
    const s = seatMap.get(sid);
    const a = new Avatar(randomAvatar(names[i] + 'digi'));
    a.root.position.set(s.x, 0, s.z);
    a.root.rotation.y = s.face;
    scene.add(a.root);
    npcs.push({ a, seat: s, pos: new THREE.Vector3(s.x, 0, s.z), ry: s.face, path: [] });
  });
  [[-3, 6], [9, -1], [-12, 4]].forEach(([x, z], i) => {
    const a = new Avatar(randomAvatar(names[i + 7] + 'walk'));
    a.root.position.set(x, 0, z);
    scene.add(a.root);
    npcs.push({ a, seat: null, pos: new THREE.Vector3(x, 0, z), ry: 0, path: [], wait: Math.random() * 2 });
  });
}
function updateNpcs(dt) {
  for (const n of npcs) {
    let moving = false;
    if (!n.seat) {
      if (!n.path.length) {
        n.wait -= dt;
        if (n.wait < 0) {
          for (let k = 0; k < 10 && !n.path.length; k++) {
            const x = THREE.MathUtils.randFloat(-15, 15), z = THREE.MathUtils.randFloat(-2, 10);
            if (!nav.hit(x, z)) n.path = nav.findPath({ x: n.pos.x, z: n.pos.z }, { x, z }) || [];
          }
          n.wait = 1.5 + Math.random() * 3;
        }
      } else {
        const wp = n.path[0];
        const dx = wp.x - n.pos.x, dz = wp.z - n.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.05) n.path.shift();
        else { n.pos.x += (dx / d) * 2.2 * dt; n.pos.z += (dz / d) * 2.2 * dt; n.ry = angleLerp(n.ry, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10)); moving = true; }
      }
    }
    n.a.root.position.copy(n.pos);
    n.a.root.rotation.y = n.ry;
    n.a.update(dt, { moving, seated: !!n.seat, seatH: n.seat?.h ?? 0.41 });
    if (Math.random() < dt * 0.04) n.a.emote();
  }
}
function removeNpcs() { npcs.forEach((n) => { scene.remove(n.a.root); n.a.dispose(); }); npcs.length = 0; }

// ============================================================ câmera
function updateCamera(dt) {
  cam.t += dt;
  if (cam.mode === 'attract') {
    const wide = innerWidth > 860;
    cam.target.set(-1 + Math.sin(cam.t * 0.06) * 5, 0, 1 + Math.cos(cam.t * 0.045) * 3);
    if (wide) cam.target.addScaledVector(SCREEN_RIGHT, -Math.min(9, innerWidth / 140));
    cam.zoomGoal = wide ? 0.6 : 0.5;
  } else {
    const k = cam.snap > 0 ? 1 - Math.exp(-dt * 12) : 1 - Math.exp(-dt * cam.follow);
    cam.snap = Math.max(0, (cam.snap || 0) - dt);
    cam.follow = Math.min(5, cam.follow + dt * 1.2);
    tmpV.set(me.pos.x, 0.5, me.pos.z);
    // compensa o painel lateral aberto para o avatar não ficar escondido atrás dele
    const ppu = innerHeight / ((camera.top - camera.bottom) / camera.zoom);
    const panelPx = $('#hud').classList.contains('panel-open') && innerWidth > 860 ? 336 : 0;
    tmpV.addScaledVector(SCREEN_RIGHT, panelPx / 2 / ppu);
    cam.target.lerp(tmpV, k);
  }
  cam.zoom += (cam.zoomGoal - cam.zoom) * (1 - Math.exp(-dt * (cam.mode === 'attract' ? 1 : 2.4)));
  camera.position.copy(cam.target).addScaledVector(CAM_DIR, 80);
  camera.lookAt(cam.target);
  if (Math.abs(camera.zoom - cam.zoom) > 1e-4) { camera.zoom = cam.zoom; camera.updateProjectionMatrix(); }
}

// ============================================================ customização do avatar
const LABELS = {
  hairStyle: { short: 'Curto', fringe: 'Franja', buzz: 'Raspado', long: 'Longo', ponytail: 'Rabo de cavalo', bun: 'Coque', curly: 'Cacheado', bald: 'Careca' },
  face: { smile: 'Sorriso', calm: 'Sereno', lashes: 'Cílios', beard: 'Barba', mustache: 'Bigode', stubble: 'Barba rala', freckles: 'Sardas' },
  top: { tshirt: 'Camiseta', polo: 'Polo', hoodie: 'Moletom', social: 'Camisa social', blazer: 'Blazer + gravata', sweater: 'Suéter' },
  legwear: { jeans: 'Jeans', social: 'Social', shorts: 'Bermuda', skirt: 'Saia' },
  accessory: { none: 'Nenhum', glasses: 'Óculos', sunglasses: 'Óculos escuros', headphones: 'Headphone', cap: 'Boné', beanie: 'Gorro' },
};
let cz = null;

function initCustomizerRenderer() {
  const c = $('#czCanvas');
  const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = true;
  const sc = new THREE.Scene();
  sc.environment = scene.environment;
  sc.environmentIntensity = 0.5;
  sc.add(new THREE.HemisphereLight('#eef5ff', '#5a6a9a', 1.4));
  const d = new THREE.DirectionalLight('#fff0d8', 2.4);
  d.position.set(2, 5, 4); d.castShadow = true; d.shadow.mapSize.set(1024, 1024);
  sc.add(d);
  const rim = new THREE.DirectionalLight('#7cc0ff', 1.6);
  rim.position.set(-3, 2, -3);
  sc.add(rim);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.82, 0.16, 48), new THREE.MeshStandardMaterial({ color: '#2a4a8f', roughness: 0.4 }));
  ped.position.y = -0.08; ped.receiveShadow = true;
  sc.add(ped);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.79, 0.015, 8, 64), new THREE.MeshBasicMaterial({ color: '#5aa8ff' }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.0;
  sc.add(ring);
  const pc = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  pc.position.set(0, 1.15, 5.6);
  pc.lookAt(0, 0.8, 0);
  const avatar = new Avatar(S.me?.avatar || randomAvatar());
  sc.add(avatar.root);
  let drag = null, spin = 0.5;
  c.addEventListener('pointerdown', (e) => { drag = e.clientX; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', (e) => { if (drag !== null) { spin += (e.clientX - drag) * 0.012; drag = e.clientX; } });
  c.addEventListener('pointerup', () => { drag = null; });
  cz = { renderer: r, scene: sc, camera: pc, avatar, cfg: null, get spin() { return spin; }, set spin(v) { spin = v; }, dragging: () => drag !== null };
}

function renderCustomizerOptions() {
  for (const group of $$('.cz-group')) {
    const key = group.dataset.key;
    const box = $('.swatches, .chips', group);
    box.innerHTML = AVATAR_OPTIONS[key].map((v) => (LABELS[key]
      ? `<button class="chip ${cz.cfg[key] === v ? 'on' : ''}" data-v="${v}">${LABELS[key][v]}</button>`
      : `<button class="swatch ${cz.cfg[key] === v ? 'on' : ''}" data-v="${v}" style="--c:${v}" title="${v}"></button>`)).join('');
  }
}

function openCustomizer(first) {
  if (!cz) initCustomizerRenderer();
  cz.cfg = { ...(S.me?.avatar || randomAvatar()) };
  cz.avatar.setConfig(cz.cfg);
  cz.first = first;
  $('#czName').value = S.me?.name || '';
  $('#czNameTag').textContent = S.me?.name || 'Você';
  $('#czSave').innerHTML = first ? 'Entrar no escritório <span>→</span>' : 'Salvar avatar';
  $('#czCancel').hidden = first;
  renderCustomizerOptions();
  $('#customizer').hidden = false;
  setTimeout(() => cz.avatar.emote(), 400);
}

$('#customizer').addEventListener('click', (e) => {
  const b = e.target.closest('[data-v]');
  if (!b) return;
  const key = b.closest('.cz-group').dataset.key;
  cz.cfg[key] = b.dataset.v;
  cz.avatar.setConfig(cz.cfg);
  renderCustomizerOptions();
});
$('#czName').addEventListener('input', (e) => { $('#czNameTag').textContent = e.target.value || 'Você'; });
$('#czRandom').onclick = () => { cz.cfg = randomAvatar(Math.random().toString()); cz.avatar.setConfig(cz.cfg); cz.avatar.emote(); renderCustomizerOptions(); };
$('#czCancel').onclick = () => { $('#customizer').hidden = true; };
$('#czSave').onclick = async () => {
  const btn = $('#czSave');
  btn.disabled = true;
  try {
    const j = await api('save_avatar', { avatar: cz.cfg, name: $('#czName').value });
    S.me = j.me;
    $('#customizer').hidden = true;
    if (S.inOffice) {
      me.avatar.setConfig(S.me.avatar);
      me.avatar.emote();
      if (me.tag) me.tag._key = '';
      renderDock();
      scheduleSync(100, true);
      toast('Avatar atualizado ✨');
    } else enterOffice();
  } catch (e) { toast(e.message); } finally { btn.disabled = false; }
};

function renderCustomizer(dt) {
  if (!cz || $('#customizer').hidden) return;
  const c = cz.renderer.domElement;
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.floor(w * cz.renderer.getPixelRatio()) || c.height !== Math.floor(h * cz.renderer.getPixelRatio())) {
    cz.renderer.setSize(w, h, false);
    cz.camera.aspect = w / h;
    cz.camera.updateProjectionMatrix();
  }
  if (!cz.dragging()) cz.spin += dt * 0.5;
  cz.avatar.root.rotation.y = Math.sin(cz.spin) * 0.7;
  cz.avatar.update(dt, {});
  cz.renderer.render(cz.scene, cz.camera);
}

// ============================================================ autenticação
const forms = { login: $('#loginForm'), register: $('#registerForm') };
$$('.tab').forEach((t) => {
  t.onclick = () => {
    $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
    $('.tabs').dataset.active = t.dataset.tab;
    Object.entries(forms).forEach(([k, f]) => f.classList.toggle('active', k === t.dataset.tab));
  };
});

async function submitAuth(form, action) {
  const err = $('.form-error', form);
  err.textContent = '';
  const btn = $('button[type=submit]', form);
  btn.disabled = true;
  unlockAudio();
  try {
    const j = await api(action, Object.fromEntries(new FormData(form)));
    S.me = j.me;
    if (j.firstTime) openCustomizer(true);
    else enterOffice();
  } catch (e) { err.textContent = e.message; } finally { btn.disabled = false; }
}
forms.login.onsubmit = (e) => { e.preventDefault(); submitAuth(forms.login, 'login'); };
forms.register.onsubmit = (e) => { e.preventDefault(); submitAuth(forms.register, 'register'); };
$('#enterBtn').onclick = () => { unlockAudio(); enterOffice(); };
$('#switchAccount').onclick = async () => {
  try { await api('logout'); } catch { /* */ }
  S.me = null;
  $('#welcomeBack').hidden = true;
  $('#authForms').hidden = false;
};

function showWelcome(user) {
  $('#wbName').textContent = user.name;
  $('#wbAvatar').outerHTML = avatarChip(user, 'big wb-avatar').replace('<span class="p-avatar', '<span id="wbAvatar" class="p-avatar');
  $('#welcomeBack').hidden = false;
  $('#authForms').hidden = true;
}

let entering = false;
async function enterOffice() {
  if (entering || S.inOffice) return;
  entering = true;
  unlockAudio();
  const enterBtn = $('#enterBtn');
  enterBtn.disabled = true;
  try {
    const j = await api('bootstrap');
    S.me = j.me;
    S.driver = j.driver;
    S.ice = j.ice;
    S.rev = j.rev;
    applyBundleRaw(j);
    S.status = S.me.status || 'active';
    await startMic();
    removeNpcs();
    me.avatar = new Avatar(S.me.avatar, { isMe: true });
    scene.add(me.avatar.root);
    const desk = myDeskId();
    if (desk) { const s = seatMap.get(desk); me.seat = desk; me.pos.set(s.x, 0, s.z); me.ry = s.face; }
    else {
      // nasce perto da recepção, num ponto livre aleatório (pra ninguém nascer em cima do outro)
      me.pos.set(SPAWN.x, 0, SPAWN.z);
      for (let k = 0; k < 20; k++) {
        const a = Math.random() * Math.PI * 2, d = 0.6 + Math.random() * 1.6;
        const x = SPAWN.x + Math.cos(a) * d, z = SPAWN.z + Math.sin(a) * d;
        if (!nav.hit(x, z)) { me.pos.set(x, 0, z); break; }
      }
      me.ry = Math.PI * 0.75;
    }
    createMesh();
    S.inOffice = true;
    $('#auth').hidden = true;
    $('#hud').hidden = false;
    $('#demoBanner').hidden = S.driver !== 'tmp';
    cam.mode = 'follow';
    cam.follow = 0.6;
    cam.zoomGoal = innerWidth < 860 ? 1.5 : 1.9;
    if (innerWidth > 1200) $('#hud').classList.add('panel-open');
    refreshDesks();
    renderDock();
    renderMeetings();
    renderPeople();
    renderOnline();
    setTimeout(hideHint, 15000);
    setTimeout(() => { me.avatar.emote(); toast(desk ? `Bom te ver, ${firstName(S.me.name)}! Você já está na sua mesa 👋` : `Bem-vindo(a), ${firstName(S.me.name)}! Clique numa mesa livre para torná-la sua 🪑`, 4200); }, 900);
    sync();
  } catch (e) {
    toast(e.message);
    if (e.status === 401) { $('#welcomeBack').hidden = true; $('#authForms').hidden = false; }
  } finally {
    entering = false;
    enterBtn.disabled = false;
  }
}

function applyBundleRaw(j) {
  S.users = new Map(j.users.map((u) => [u.id, u]));
  S.desks = j.desks || {};
  S.meetings = j.meetings || [];
}

addEventListener('pagehide', () => { if (S.inOffice) beacon('leave', { sid: S.sid }); });

// ============================================================ loop principal
let last = performance.now();
let lastSlow = 0;
function frame(now) {
  const raw = (now - last) / 1000;
  const dt = Math.min(0.1, raw);
  last = now;
  trackFps(raw);
  if (S.inOffice) {
    updatePlayer(dt);
    updateRemotes(dt);
    measureMic(dt);
    sendPos();
    if (now - lastGate > 150) gateMedia(now);
    if (now - lastSlow > 300) {
      lastSlow = now;
      drawMinimap();
      if (media.speaking !== $('#micBtn').classList.contains('speaking')) renderDock();
    }
    const pulse = 0.55 + Math.sin(now * 0.004) * 0.35;
    for (const d of office.desks.values()) if (d.mine) d.ringMat.opacity = pulse;
  } else updateNpcs(dt);
  updateRipples(dt);
  updateCamera(dt);
  office.animate(now);
  renderer.render(scene, camera);
  updateOverlay();
  renderCustomizer(dt);
  requestAnimationFrame(frame);
}

// ============================================================ boot
async function boot() {
  const bar = $('#loaderText');
  try { await Promise.race([document.fonts.load('800 40px "Plus Jakarta Sans"'), new Promise((r) => setTimeout(r, 1500))]); } catch { /* */ }
  bar.textContent = 'Chamando a equipe…';
  try { await loadCharacter(); } catch (e) { console.error(e); bar.textContent = 'Não foi possível carregar os personagens 😕'; return; }
  bar.textContent = 'Arrumando as mesas…';
  await new Promise((r) => setTimeout(r, 30));
  office = buildOffice(scene);
  nav = new NavGrid(office.obstacles);
  spawnNpcs();
  requestAnimationFrame(frame);
  let session = null;
  try { session = await api('session'); } catch { /* servidor offline */ }
  S.driver = session?.driver || 'file';
  if (session?.me) { S.me = session.me; showWelcome(session.me); }
  $('#auth').hidden = false;
  $('#demoBanner').hidden = S.driver !== 'tmp';
  setTimeout(() => $('#loader').classList.add('hide'), 250);
  setTimeout(() => $('#loader').remove(), 1000);
}
boot();

if (import.meta.env.DEV) {
  window.__digi = { S, me, remotes, get mesh() { return mesh; }, seatMap, cam, media, renderer, scene, camera };
  window.__project = (x, y, z) => project({ x, z }, y);
  window.__goToFirst = () => goToPerson([...remotes.keys()][0]);
}

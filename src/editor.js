// Editor do escritório (admins): adicionar, mover, girar, recolorir, duplicar e apagar móveis.
import * as THREE from 'three';
import { CATALOG, CATEGORIES, ITEM_COLORS, itemFootprint } from '../shared/catalog.js';
import { WORLD } from '../shared/layout.js';
import { buildFurniture } from './three/furniture.js';

const SNAP = 0.25;
const snap = (v, fine) => (fine ? Math.round(v * 20) / 20 : Math.round(v / SNAP) * SNAP);
const clone = (items) => items.map((i) => ({ ...i }));
const uidFor = (type) => `${type === 'desk' || type === 'desk_exec' ? 'desk' : type}-${Math.random().toString(36).slice(2, 7)}`;

export function createEditor(ctx) {
  const { scene, camera, canvas, office, applyLayout, api, toast, onEnter, onExit, getSaved, setSaved, cam } = ctx;
  const $ = (s) => document.querySelector(s);
  const ui = $('#editorUI');
  const tools = $('#edTools');
  const state = { active: false, draft: [], selected: null, placing: null, ghost: null, drag: null, dirty: false, box: null, panning: null, keys: new Set() };
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // ------------------------------------------------------------ catálogo
  const cat = $('#edCatalog');
  cat.innerHTML = CATEGORIES.map((c) => `<div class="ed-cat"><b>${c}</b><div class="ed-grid">${Object.entries(CATALOG).filter(([, d]) => d.cat === c)
    .map(([type, d]) => `<button class="ed-card" data-type="${type}" title="${d.label}"><span>${d.icon}</span><small>${d.label}</small></button>`).join('')}</div></div>`).join('');
  cat.addEventListener('click', (e) => {
    const b = e.target.closest('.ed-card');
    if (!b) return;
    startPlacing(b.dataset.type);
  });

  function floorAt(cx, cy) {
    ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, p) ? p : null;
  }

  function itemAt(cx, cy) {
    ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const meshes = [];
    office.furniture.root.traverse((o) => { if (o.isMesh && o.visible !== false && !o.userData.kind) meshes.push(o); });
    const hits = raycaster.intersectObjects(meshes, false);
    // prioriza itens com volume (não tapetes)
    let best = null;
    for (const h of hits) {
      let g = h.object;
      while (g && !g.userData.itemId) g = g.parent;
      if (!g) continue;
      const it = state.draft.find((i) => i.id === g.userData.itemId);
      if (!it) continue;
      if (!best) best = it;
      if (!['rug_rect', 'rug_round', 'welcome_mat'].includes(it.type)) return it;
    }
    return best;
  }

  function rebuild() {
    applyLayout(state.draft, { merge: false, force: true });
    refreshSelection();
  }

  // ------------------------------------------------------------ seleção
  function select(item) {
    state.selected = item ? item.id : null;
    refreshSelection();
  }

  function refreshSelection() {
    if (state.box) { scene.remove(state.box); state.box.geometry.dispose(); state.box = null; }
    const it = state.draft.find((i) => i.id === state.selected);
    if (!it) { tools.hidden = true; return; }
    const g = office.furniture.groups.get(it.id);
    if (g) {
      state.box = new THREE.BoxHelper(g, 0xffd479);
      state.box.material.depthTest = false;
      state.box.renderOrder = 10;
      scene.add(state.box);
    }
    const def = CATALOG[it.type];
    tools.innerHTML = `<strong>${def.icon} ${def.label}</strong>
      <button data-a="rotl" title="Girar (Shift+R)">↺</button><button data-a="rotr" title="Girar (R)">↻</button>
      <button data-a="dup" title="Duplicar (D)">⧉</button><button data-a="del" class="danger" title="Apagar (Del)">🗑</button>
      ${def.color ? `<span class="ed-colors">${ITEM_COLORS.map((c) => `<button class="ed-sw ${it.color === c ? 'on' : ''}" data-color="${c}" style="--c:${c}"></button>`).join('')}</span>` : ''}`;
    tools.hidden = false;
    placeTools();
  }

  function placeTools() {
    const it = state.draft.find((i) => i.id === state.selected);
    if (!it || tools.hidden) return;
    const v = new THREE.Vector3(it.x, 1.6, it.z).project(camera);
    const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
    tools.style.left = `${Math.max(250, Math.min(innerWidth - tools.offsetWidth - 12, x - tools.offsetWidth / 2))}px`;
    tools.style.top = `${Math.max(70, y - 70)}px`;
  }

  tools.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const it = state.draft.find((i) => i.id === state.selected);
    if (!it) return;
    if (b.dataset.color) { it.color = b.dataset.color; change(); return; }
    act(b.dataset.a, it);
  });

  function act(a, it) {
    if (a === 'rotl') { it.rot = +(((it.rot || 0) + Math.PI / 4)).toFixed(4); change(); }
    if (a === 'rotr') { it.rot = +(((it.rot || 0) - Math.PI / 4)).toFixed(4); change(); }
    if (a === 'dup') {
      const copy = { ...it, id: uidFor(it.type), x: Math.min(WORLD.maxX - 0.5, it.x + 1), z: Math.min(WORLD.maxZ - 0.5, it.z + 1) };
      state.draft.push(copy);
      state.selected = copy.id;
      change();
    }
    if (a === 'del') {
      state.draft = state.draft.filter((i) => i.id !== it.id);
      state.selected = null;
      change();
    }
  }

  function change() { state.dirty = true; rebuild(); }

  // ------------------------------------------------------------ colocar item novo (fantasma)
  function startPlacing(type) {
    cancelPlacing();
    select(null);
    state.placing = { id: uidFor(type), type, x: 0, z: 0, rot: 0, ...(CATALOG[type].color ? { color: ITEM_COLORS[0] } : {}) };
    const g = buildFurniture([state.placing], { merge: false }).root;
    g.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.kind) { o.visible = false; return; }
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = 0.55;
      o.castShadow = false;
    });
    state.ghost = g;
    scene.add(g);
    toast(`Clique no chão para colocar: ${CATALOG[type].label} (R gira, Esc cancela)`);
  }

  function cancelPlacing() {
    if (state.ghost) { scene.remove(state.ghost); state.ghost = null; }
    state.placing = null;
  }

  // ------------------------------------------------------------ mouse
  function onDown(e) {
    if (!state.active || e.target !== canvas) return;
    if (e.button === 2 || e.button === 1) { state.panning = { x: e.clientX, y: e.clientY }; return; }
    const p = floorAt(e.clientX, e.clientY);
    if (state.placing) {
      if (!p) return;
      const it = { ...state.placing, x: snap(p.x, e.altKey), z: snap(p.z, e.altKey) };
      state.draft.push(it);
      if (!e.shiftKey) { cancelPlacing(); state.selected = it.id; } else state.placing = { ...state.placing, id: uidFor(it.type) };
      change();
      return;
    }
    const it = itemAt(e.clientX, e.clientY);
    if (it) {
      select(it);
      state.drag = { id: it.id, start: p, ox: it.x, oz: it.z, moved: false };
      canvas.setPointerCapture(e.pointerId);
    } else {
      select(null);
      state.panning = { x: e.clientX, y: e.clientY };
    }
  }

  function onMove(e) {
    if (!state.active) return;
    if (state.panning) {
      const dx = e.clientX - state.panning.x, dy = e.clientY - state.panning.y;
      state.panning = { x: e.clientX, y: e.clientY };
      const ppu = innerHeight / ((camera.top - camera.bottom) / camera.zoom);
      const right = new THREE.Vector3(1, 0, -1).normalize();
      const up = new THREE.Vector3(-1, 0, -1).normalize();
      cam.target.addScaledVector(right, -dx / ppu).addScaledVector(up, dy / ppu / 0.65);
      return;
    }
    const p = floorAt(e.clientX, e.clientY);
    if (state.ghost && p) {
      state.ghost.position.set(snap(p.x, e.altKey), 0, snap(p.z, e.altKey));
      state.ghost.rotation.y = state.placing.rot;
      state.placing.x = state.ghost.position.x;
      state.placing.z = state.ghost.position.z;
    }
    if (state.drag && p && state.drag.start) {
      const it = state.draft.find((i) => i.id === state.drag.id);
      const nx = Math.max(WORLD.minX + 0.3, Math.min(WORLD.maxX - 0.3, snap(state.drag.ox + p.x - state.drag.start.x, e.altKey)));
      const nz = Math.max(WORLD.minZ + 0.3, Math.min(WORLD.maxZ - 0.3, snap(state.drag.oz + p.z - state.drag.start.z, e.altKey)));
      if (nx !== it.x || nz !== it.z) {
        it.x = nx; it.z = nz;
        state.drag.moved = true;
        const g = office.furniture.groups.get(it.id);
        if (g) { g.position.set(nx, 0, nz); g.updateMatrixWorld(true); state.box?.update(); }
        placeTools();
      }
    }
  }

  function onUp() {
    if (!state.active) return;
    state.panning = null;
    if (state.drag) {
      const moved = state.drag.moved;
      state.drag = null;
      if (moved) change();
    }
  }

  function onKey(e) {
    if (!state.active || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) && !(k === 'd' && state.selected)) {
      if (e.type === 'keydown') state.keys.add(k); else state.keys.delete(k);
      e.preventDefault();
      return;
    }
    if (e.type !== 'keydown') return;
    if (k === 'escape') { if (state.placing) cancelPlacing(); else select(null); }
    if (k === 'r') {
      if (state.placing) { state.placing.rot = +((state.placing.rot || 0) + (e.shiftKey ? 1 : -1) * Math.PI / 4).toFixed(4); if (state.ghost) state.ghost.rotation.y = state.placing.rot; }
      else { const it = state.draft.find((i) => i.id === state.selected); if (it) act(e.shiftKey ? 'rotl' : 'rotr', it); }
    }
    const it = state.draft.find((i) => i.id === state.selected);
    if (!it) return;
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); act('del', it); }
    if (k === 'd') act('dup', it);
  }

  canvas.addEventListener('pointerdown', onDown, true);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);
  canvas.addEventListener('contextmenu', (e) => { if (state.active) e.preventDefault(); });

  // ------------------------------------------------------------ entrar / sair / salvar
  function enter() {
    state.active = true;
    state.draft = clone(getSaved());
    state.dirty = false;
    state.selected = null;
    document.body.classList.add('editing');
    ui.hidden = false;
    onEnter?.();
    rebuild();
  }

  function exit(apply = true) {
    cancelPlacing();
    select(null);
    state.active = false;
    document.body.classList.remove('editing');
    ui.hidden = true;
    tools.hidden = true;
    if (apply) applyLayout(getSaved(), { merge: true, force: true });
    onExit?.();
  }

  $('#edCancel').onclick = () => {
    if (state.dirty && !confirm('Descartar as mudanças no escritório?')) return;
    exit(true);
  };
  $('#edSave').onclick = async () => {
    const btn = $('#edSave');
    btn.disabled = true;
    try {
      const j = await api('save_layout', { items: state.draft });
      setSaved(j.layout.items);
      exit(true);
      toast('Escritório salvo! Todo mundo já vê o novo layout ✨');
    } catch (e) { toast(e.message); } finally { btn.disabled = false; }
  };
  $('#edReset').onclick = async () => {
    if (!confirm('Voltar o escritório para o layout padrão? (as mesas removidas perdem a atribuição)')) return;
    try {
      const j = await api('save_layout', { reset: true });
      setSaved(j.layout.items);
      exit(true);
      toast('Layout padrão restaurado.');
    } catch (e) { toast(e.message); }
  };

  return {
    get active() { return state.active; },
    enter, exit,
    update(dt) {
      if (!state.active) return;
      let ix = 0, iy = 0;
      if (state.keys.has('d') || state.keys.has('arrowright')) ix += 1;
      if (state.keys.has('a') || state.keys.has('arrowleft')) ix -= 1;
      if (state.keys.has('w') || state.keys.has('arrowup')) iy += 1;
      if (state.keys.has('s') || state.keys.has('arrowdown')) iy -= 1;
      if (ix || iy) {
        const sp = 12 * dt / camera.zoom;
        cam.target.x += (ix - iy) * Math.SQRT1_2 * sp;
        cam.target.z += (-ix - iy) * Math.SQRT1_2 * sp;
      }
      cam.target.x = Math.max(WORLD.minX, Math.min(WORLD.maxX, cam.target.x));
      cam.target.z = Math.max(WORLD.minZ, Math.min(WORLD.maxZ, cam.target.z));
      placeTools();
    },
    footprintOk(it) { return !!itemFootprint(it); },
  };
}

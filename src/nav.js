// Grade de navegação + A* com suavização de caminho (para clicar e andar desviando dos móveis).
import { WORLD } from '../shared/layout.js';

const CELL = 0.25;
const RADIUS = 0.24;

export class NavGrid {
  constructor(obstacles) {
    this.w = Math.ceil((WORLD.maxX - WORLD.minX) / CELL);
    this.h = Math.ceil((WORLD.maxZ - WORLD.minZ) / CELL);
    this.blocked = new Uint8Array(this.w * this.h);
    this.obstacles = obstacles;
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const x = WORLD.minX + (i + 0.5) * CELL;
        const z = WORLD.minZ + (j + 0.5) * CELL;
        if (this.hit(x, z, RADIUS)) this.blocked[j * this.w + i] = 1;
      }
    }
  }

  hit(x, z, r = RADIUS) {
    if (x < WORLD.minX + r || x > WORLD.maxX - r || z < WORLD.minZ + r || z > WORLD.maxZ - r) return true;
    for (const o of this.obstacles) if (x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r) return true;
    return false;
  }

  cellOf(x, z) {
    return [
      Math.max(0, Math.min(this.w - 1, Math.floor((x - WORLD.minX) / CELL))),
      Math.max(0, Math.min(this.h - 1, Math.floor((z - WORLD.minZ) / CELL))),
    ];
  }

  center(i, j) { return { x: WORLD.minX + (i + 0.5) * CELL, z: WORLD.minZ + (j + 0.5) * CELL }; }
  isFree(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && !this.blocked[j * this.w + i]; }

  nearestFree(i, j) {
    if (this.isFree(i, j)) return [i, j];
    for (let r = 1; r < 12; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        if (this.isFree(i + di, j + dj)) return [i + di, j + dj];
      }
    }
    return null;
  }

  lineFree(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / (CELL * 0.5));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const [i, j] = this.cellOf(ax + (bx - ax) * t, az + (bz - az) * t);
      if (!this.isFree(i, j)) return false;
    }
    return true;
  }

  // Retorna lista de pontos {x,z} ou null.
  findPath(from, to) {
    let start = this.cellOf(from.x, from.z);
    start = this.nearestFree(...start);
    let goal = this.nearestFree(...this.cellOf(to.x, to.z));
    if (!start || !goal) return null;
    if (this.lineFree(from.x, from.z, to.x, to.z) && this.isFree(...this.cellOf(to.x, to.z))) return [{ x: to.x, z: to.z }];
    const W = this.w;
    const idx = (i, j) => j * W + i;
    const g = new Float32Array(W * this.h).fill(Infinity);
    const came = new Int32Array(W * this.h).fill(-1);
    const closed = new Uint8Array(W * this.h);
    const heap = [];
    const push = (n, f) => {
      heap.push([f, n]);
      let c = heap.length - 1;
      while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          const l = c * 2 + 1, r = l + 1;
          let m = c;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]]; c = m;
        }
      }
      return top[1];
    };
    const [gi, gj] = goal;
    const hfn = (i, j) => { const dx = Math.abs(i - gi), dy = Math.abs(j - gj); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const s = idx(...start);
    g[s] = 0;
    push(s, hfn(...start));
    const goalIdx = idx(gi, gj);
    let found = false;
    let guard = 0;
    while (heap.length && guard++ < 60000) {
      const cur = pop();
      if (cur === goalIdx) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const ci = cur % W, cj = (cur / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!this.isFree(ni, nj)) continue;
        if (di && dj && (!this.isFree(ci + di, cj) || !this.isFree(ci, cj + dj))) continue;
        const n = idx(ni, nj);
        const ng = g[cur] + (di && dj ? 1.414 : 1);
        if (ng < g[n]) { g[n] = ng; came[n] = cur; push(n, ng + hfn(ni, nj)); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = goalIdx; c !== -1; c = came[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map((c) => this.center(c % W, (c / W) | 0));
    const goalFree = this.isFree(...this.cellOf(to.x, to.z));
    if (goalFree) pts[pts.length - 1] = { x: to.x, z: to.z };
    // suavização (string pulling)
    const out = [];
    let anchor = { x: from.x, z: from.z };
    let k = 0;
    while (k < pts.length) {
      let far = k;
      for (let t = pts.length - 1; t > k; t--) {
        if (this.lineFree(anchor.x, anchor.z, pts[t].x, pts[t].z)) { far = t; break; }
      }
      out.push(pts[far]);
      anchor = pts[far];
      k = far + 1;
    }
    return out;
  }
}

// "Banco de dados" em JSON.
// Cada coleção é um documento JSON { id: registro } — users, desks, meetings, presence.
//
// Drivers:
//  - file  → data/<coleção>.json (desenvolvimento local / servidores com disco).
//  - redis → mesmos documentos JSON guardados no Upstash Redis via REST (Vercel).
//            Ativado automaticamente quando existem KV_REST_API_URL/KV_REST_API_TOKEN
//            ou UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.
//  - Sem Redis na Vercel cai em /tmp (modo demonstração: os dados são temporários).
import fs from 'node:fs';
import path from 'node:path';

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = process.env.DB_PREFIX || 'digi';

export const DRIVER = REDIS_URL && REDIS_TOKEN ? 'redis' : process.env.VERCEL ? 'tmp' : 'file';
const DATA_DIR = process.env.DATA_DIR || (DRIVER === 'tmp' ? '/tmp/digi-connect-data' : path.join(process.cwd(), 'data'));

// ---------------------------------------------------------------- file driver
const cache = new Map();
const dirty = new Set();
let flushTimer = null;

function filePath(name) { return path.join(DATA_DIR, `${name}.json`); }

function load(name) {
  if (cache.has(name)) return cache.get(name);
  let doc = {};
  try {
    const raw = fs.readFileSync(filePath(name), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') doc = parsed;
  } catch { /* coleção nova */ }
  cache.set(name, doc);
  return doc;
}

function flushNow() {
  flushTimer = null;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const name of dirty) {
    const tmp = filePath(name) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cache.get(name) ?? {}, null, 2));
    fs.renameSync(tmp, filePath(name));
  }
  dirty.clear();
}

function markDirty(name) {
  dirty.add(name);
  // Coleções quentes (presença/sinais) são gravadas com debounce; o resto na hora.
  if (name === 'presence' || name === 'signals') {
    if (!flushTimer) flushTimer = setTimeout(flushNow, 400);
  } else {
    flushNow();
  }
}

const fileDriver = {
  async all(name) { return { ...load(name) }; },
  async get(name, id) { return load(name)[id] ?? null; },
  async put(name, id, value) { load(name)[id] = value; markDirty(name); },
  async del(name, ...ids) { const doc = load(name); ids.forEach((id) => delete doc[id]); markDirty(name); },
  // Cria somente se ainda não existe (usado para travar e-mail único).
  async putIfAbsent(name, id, value) {
    const doc = load(name);
    if (doc[id] !== undefined) return false;
    doc[id] = value; markDirty(name); return true;
  },
  async pushSignals(to, list) {
    const doc = load('signals');
    doc[to] = [...(doc[to] || []), ...list].slice(-200);
    markDirty('signals');
  },
  async takeSignals(to) {
    const doc = load('signals');
    const list = doc[to] || [];
    if (list.length) { delete doc[to]; markDirty('signals'); }
    const cutoff = Date.now() - 60_000;
    return list.filter((s) => s.ts >= cutoff);
  },
  async getRev() { return load('meta').rev || 0; },
  async bumpRev() { const m = load('meta'); m.rev = (m.rev || 0) + 1; markDirty('meta'); return m.rev; },
};

// ---------------------------------------------------------------- redis driver
async function redis(commands) {
  const res = await fetch(`${REDIS_URL.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}
const key = (name) => `${PREFIX}:${name}`;
const parse = (v) => { try { return JSON.parse(v); } catch { return null; } };

const redisDriver = {
  async all(name) {
    const [flat] = await redis([['HGETALL', key(name)]]);
    const out = {};
    for (let i = 0; i < (flat?.length || 0); i += 2) out[flat[i]] = parse(flat[i + 1]);
    return out;
  },
  async get(name, id) { const [v] = await redis([['HGET', key(name), id]]); return v == null ? null : parse(v); },
  async put(name, id, value) { await redis([['HSET', key(name), id, JSON.stringify(value)]]); },
  async del(name, ...ids) { if (ids.length) await redis([['HDEL', key(name), ...ids]]); },
  async putIfAbsent(name, id, value) {
    const [ok] = await redis([['HSETNX', key(name), id, JSON.stringify(value)]]);
    return ok === 1;
  },
  async pushSignals(to, list) {
    const k = key(`sig:${to}`);
    await redis([['RPUSH', k, ...list.map((s) => JSON.stringify(s))], ['LTRIM', k, -200, -1], ['EXPIRE', k, 60]]);
  },
  async takeSignals(to) {
    const [list] = await redis([['LPOP', key(`sig:${to}`), 200]]);
    const cutoff = Date.now() - 60_000;
    return (list || []).map(parse).filter((s) => s && s.ts >= cutoff);
  },
  async getRev() { const [v] = await redis([['GET', key('rev')]]); return Number(v) || 0; },
  async bumpRev() { const [v] = await redis([['INCR', key('rev')]]); return Number(v); },
  // Sync em uma única ida ao Redis: grava presença, lê todo mundo, pega sinais e a revisão.
  async syncBundle(userId, presence) {
    const [, flat, sigs, rev] = await redis([
      ['HSET', key('presence'), userId, JSON.stringify(presence)],
      ['HGETALL', key('presence')],
      ['LPOP', key(`sig:${userId}`), 200],
      ['GET', key('rev')],
    ]);
    const all = {};
    for (let i = 0; i < (flat?.length || 0); i += 2) all[flat[i]] = parse(flat[i + 1]);
    const cutoff = Date.now() - 60_000;
    return { presence: all, signals: (sigs || []).map(parse).filter((s) => s && s.ts >= cutoff), rev: Number(rev) || 0 };
  },
};

export const db = DRIVER === 'redis' ? redisDriver : fileDriver;

if (!db.syncBundle) {
  db.syncBundle = async (userId, presence) => {
    await db.put('presence', userId, presence);
    const [all, signals, rev] = await Promise.all([db.all('presence'), db.takeSignals(userId), db.getRev()]);
    return { presence: all, signals, rev };
  };
}

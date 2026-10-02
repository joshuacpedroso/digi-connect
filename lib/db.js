// "Banco de dados" em JSON.
// Cada coleção é um documento JSON { id: registro } — users, desks, meetings, presence, channels…
// Listas (mensagens do chat) são arrays JSON em ordem de chegada.
//
// Drivers (escolhidos sozinhos pelas variáveis de ambiente):
//  - supabase → Postgres do Supabase: cada registro é um JSON (jsonb). Ativado com POSTGRES_URL
//               (integração Supabase da Vercel), SUPABASE_DB_URL ou DATABASE_URL. Tabelas criadas sozinhas.
//  - redis    → os mesmos documentos JSON no Upstash Redis (KV_REST_API_URL/KV_REST_API_TOKEN).
//  - file     → data/<coleção>.json (desenvolvimento local).
//  - tmp      → na Vercel sem banco: /tmp (modo demonstração, os dados somem).
import fs from 'node:fs';
import path from 'node:path';

const PG_URL = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = process.env.DB_PREFIX || 'digi';

export const DRIVER = PG_URL ? 'supabase' : REDIS_URL && REDIS_TOKEN ? 'redis' : process.env.VERCEL ? 'tmp' : 'file';
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
  // listas: guardadas em lists.json → { nome: [itens] }
  async listPush(name, item, max = 20000) {
    const doc = load('lists');
    const list = (doc[name] ||= []);
    list.push(item);
    if (list.length > max) list.splice(0, list.length - max);
    markDirty('lists');
    return list.length;
  },
  async listRange(name, start, stop) {
    const list = load('lists')[name] || [];
    const n = list.length;
    const a = start < 0 ? Math.max(0, n + start) : start;
    const b = stop < 0 ? n + stop : Math.min(n - 1, stop);
    return b < a ? [] : list.slice(a, b + 1);
  },
  async listLen(name) { return (load('lists')[name] || []).length; },
  async listDel(name) { const doc = load('lists'); delete doc[name]; markDirty('lists'); },
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
  async listPush(name, item, max = 20000) {
    const [n] = await redis([['RPUSH', key(`l:${name}`), JSON.stringify(item)], ['LTRIM', key(`l:${name}`), -max, -1]]);
    return Math.min(n, max);
  },
  async listRange(name, start, stop) { const [v] = await redis([['LRANGE', key(`l:${name}`), start, stop]]); return (v || []).map(parse).filter(Boolean); },
  async listLen(name) { const [v] = await redis([['LLEN', key(`l:${name}`)]]); return Number(v) || 0; },
  async listDel(name) { await redis([['DEL', key(`l:${name}`)]]); },
  async getRev() { const [v] = await redis([['GET', key('rev')]]); return Number(v) || 0; },
  async bumpRev() { const [v] = await redis([['INCR', key('rev')]]); return Number(v); },
  // Sync em uma única ida ao Redis: grava presença, lê todo mundo, pega sinais e a revisão.
  async syncBundle(userId, presence) {
    const [, flat, sigs, rev, chFlat, reads] = await redis([
      ['HSET', key('presence'), userId, JSON.stringify(presence)],
      ['HGETALL', key('presence')],
      ['LPOP', key(`sig:${userId}`), 200],
      ['GET', key('rev')],
      ['HGETALL', key('channels')],
      ['HGET', key('reads'), userId],
    ]);
    const hash = (f) => { const o = {}; for (let i = 0; i < (f?.length || 0); i += 2) o[f[i]] = parse(f[i + 1]); return o; };
    const cutoff = Date.now() - 60_000;
    return {
      presence: hash(flat), signals: (sigs || []).map(parse).filter((s) => s && s.ts >= cutoff), rev: Number(rev) || 0,
      channels: hash(chFlat), reads: reads ? parse(reads) || {} : {},
    };
  },
};

// ---------------------------------------------------------------- supabase (postgres) driver
// Tabelas: digi_kv (coleção, id, JSON) · digi_list (listas em ordem) · digi_meta (contadores).
// RLS ligado e sem políticas: a API pública do Supabase (anon) não enxerga nada; só o servidor acessa.
let pg = null;
let pgReady = null;
async function sql() {
  if (!pg) {
    const { default: postgres } = await import('postgres');
    const u = new URL(PG_URL);
    const local = /^(localhost|127\.|::1)/.test(u.hostname);
    for (const k of [...u.searchParams.keys()]) u.searchParams.delete(k); // parâmetros do pooler (ex.: supa=) não são do Postgres
    pg = postgres(u.toString(), { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10, ssl: local ? false : 'require', onnotice: () => {} });
  }
  pgReady ||= pg.unsafe(`
    create table if not exists ${PREFIX}_kv (coll text not null, id text not null, value jsonb, primary key (coll, id));
    create table if not exists ${PREFIX}_list (name text not null, seq bigint generated always as identity, value jsonb not null, primary key (name, seq));
    create table if not exists ${PREFIX}_meta (key text primary key, num bigint not null default 0);
    alter table ${PREFIX}_kv enable row level security;
    alter table ${PREFIX}_list enable row level security;
    alter table ${PREFIX}_meta enable row level security;
  `).catch((e) => { pgReady = null; throw e; });
  await pgReady;
  return pg;
}
const KV = `${PREFIX}_kv`, LIST = `${PREFIX}_list`, META = `${PREFIX}_meta`;

const pgDriver = {
  async all(name) {
    const q = await sql();
    const rows = await q.unsafe(`select id, value from ${KV} where coll = $1`, [name]);
    return Object.fromEntries(rows.map((r) => [r.id, r.value]));
  },
  async get(name, id) {
    const q = await sql();
    const [r] = await q.unsafe(`select value from ${KV} where coll = $1 and id = $2`, [name, String(id)]);
    return r ? r.value : null;
  },
  async put(name, id, value) {
    const q = await sql();
    await q.unsafe(`insert into ${KV} (coll, id, value) values ($1, $2, $3) on conflict (coll, id) do update set value = excluded.value`, [name, String(id), q.json(value)]);
  },
  async del(name, ...ids) {
    if (!ids.length) return;
    const q = await sql();
    await q.unsafe(`delete from ${KV} where coll = $1 and id = any($2)`, [name, ids.map(String)]);
  },
  async putIfAbsent(name, id, value) {
    const q = await sql();
    const rows = await q.unsafe(`insert into ${KV} (coll, id, value) values ($1, $2, $3) on conflict (coll, id) do nothing returning id`, [name, String(id), q.json(value)]);
    return rows.length > 0;
  },
  async pushSignals(to, list) {
    const q = await sql();
    for (const s of list) await q.unsafe(`insert into ${LIST} (name, value) values ($1, $2)`, [`sig:${to}`, q.json(s)]);
  },
  async takeSignals(to) {
    const q = await sql();
    const rows = await q.unsafe(`delete from ${LIST} where name = $1 returning seq, value`, [`sig:${to}`]);
    const cutoff = Date.now() - 60_000;
    return rows.sort((a, b) => Number(a.seq) - Number(b.seq)).map((r) => r.value).filter((s) => s && s.ts >= cutoff);
  },
  async getRev() {
    const q = await sql();
    const [r] = await q.unsafe(`select num from ${META} where key = 'rev'`);
    return Number(r?.num) || 0;
  },
  async bumpRev() {
    const q = await sql();
    const [r] = await q.unsafe(`insert into ${META} (key, num) values ('rev', 1) on conflict (key) do update set num = ${META}.num + 1 returning num`);
    return Number(r.num);
  },
  async listPush(name, item) {
    const q = await sql();
    const [r] = await q.unsafe(`with ins as (insert into ${LIST} (name, value) values ($1, $2) returning 1) select count(*)::int + 1 as n from ${LIST} where name = $1`, [name, q.json(item)]);
    return Number(r.n);
  },
  // índices como no Redis (negativos contam do fim)
  async listRange(name, start, stop) {
    const q = await sql();
    if (start < 0 && stop < 0) {
      const rows = await q.unsafe(`select value from ${LIST} where name = $1 order by seq desc offset $2 limit $3`, [name, -stop - 1, Math.max(0, stop - start + 1)]);
      return rows.reverse().map((r) => r.value);
    }
    const n = start < 0 || stop < 0 ? await pgDriver.listLen(name) : 0;
    const a = start < 0 ? Math.max(0, n + start) : start;
    const b = stop < 0 ? n + stop : stop;
    if (b < a) return [];
    const rows = await q.unsafe(`select value from ${LIST} where name = $1 order by seq asc offset $2 limit $3`, [name, a, b - a + 1]);
    return rows.map((r) => r.value);
  },
  async listLen(name) {
    const q = await sql();
    const [r] = await q.unsafe(`select count(*)::int as n from ${LIST} where name = $1`, [name]);
    return Number(r.n);
  },
  async listDel(name) {
    const q = await sql();
    await q.unsafe(`delete from ${LIST} where name = $1`, [name]);
  },
  // sync em paralelo: grava presença, lê todo mundo, sinais, revisão e conversas
  async syncBundle(userId, presence) {
    await pgDriver.put('presence', userId, presence);
    const [all, signals, rev, channels, reads] = await Promise.all([
      pgDriver.all('presence'), pgDriver.takeSignals(userId), pgDriver.getRev(), pgDriver.all('channels'), pgDriver.get('reads', userId),
    ]);
    return { presence: all, signals, rev, channels, reads: reads || {} };
  },
};

export const db = DRIVER === 'supabase' ? pgDriver : DRIVER === 'redis' ? redisDriver : fileDriver;

if (!db.syncBundle) {
  db.syncBundle = async (userId, presence) => {
    await db.put('presence', userId, presence);
    const [all, signals, rev, channels, reads] = await Promise.all([db.all('presence'), db.takeSignals(userId), db.getRev(), db.all('channels'), db.get('reads', userId)]);
    return { presence: all, signals, rev, channels, reads: reads || {} };
  };
}

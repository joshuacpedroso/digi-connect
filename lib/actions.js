// Ações da API — POST /api { action, ...dados }
import { db, DRIVER } from './db.js';
import { hashPassword, verifyPassword, makeSessionCookie, clearSessionCookie, readSession, uid } from './auth.js';
import { WORLD, SPAWN, sanitizeAvatar, randomAvatar, defaultLayout, desksOf } from '../shared/layout.js';
import { CATALOG, ITEM_COLORS } from '../shared/catalog.js';

const STATUSES = ['active', 'busy', 'away'];
const PRESENCE_TTL = 20_000;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const isAdmin = (u) => u?.role === 'Admin' || ADMIN_EMAILS.includes(u?.email);

async function getLayout() {
  const doc = await db.get('layout', 'main');
  return doc?.items ? doc : { items: defaultLayout(), updated_at: 0 };
}

function cleanItems(input) {
  if (!Array.isArray(input) || input.length > 800) fail(422, 'Layout inválido.');
  const ids = new Set();
  const out = [];
  for (const raw of input) {
    if (!raw || !CATALOG[raw.type]) continue;
    let id = String(raw.id || '').replace(/[^\w-]/g, '').slice(0, 40);
    if (!id || ids.has(id)) id = `${raw.type}-${Math.random().toString(36).slice(2, 8)}`;
    ids.add(id);
    const item = {
      id, type: raw.type,
      x: clamp(raw.x, WORLD.minX, WORLD.maxX, 0),
      z: clamp(raw.z, WORLD.minZ, WORLD.maxZ, 0),
      rot: clamp(raw.rot, -20, 20, 0),
    };
    if (typeof raw.color === 'string' && (ITEM_COLORS.includes(raw.color) || /^#[0-9a-f]{6}$/i.test(raw.color))) item.color = raw.color;
    if (typeof raw.team === 'string') item.team = raw.team.slice(0, 30);
    out.push(item);
  }
  return out;
}

// Servidores ICE (STUN/TURN). Em redes corporativas um TURN ajuda a chamada a conectar.
// Configure ICE_SERVERS (JSON) ou TURN_URL + TURN_USERNAME + TURN_CREDENTIAL nas variáveis de ambiente.
function iceServers() {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  try { if (process.env.ICE_SERVERS) return JSON.parse(process.env.ICE_SERVERS); } catch { /* JSON inválido */ }
  if (process.env.TURN_URL) {
    list.push({ urls: process.env.TURN_URL.split(',').map((u) => u.trim()), username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  }
  return list;
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

const clamp = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 40);
const cleanEmail = (s) => String(s || '').trim().toLowerCase().slice(0, 120);

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: isAdmin(u) ? 'Admin' : (u.role || 'Membro'), status: u.status || 'active', avatar: u.avatar || randomAvatar(u.id) };
}

async function loadBundle(meId) {
  const [users, desks, meetings, layout] = await Promise.all([db.all('users'), db.all('desks'), db.all('meetings'), getLayout()]);
  const deskIds = new Set(desksOf(layout.items).map((d) => d.id));
  const now = Date.now();
  const myMeetings = Object.values(meetings).filter((m) => m && m.status === 'open'
    && (m.participants || []).includes(meId) && now - (m.created_ts || 0) < 12 * 3600_000);
  return {
    users: Object.values(users).filter(Boolean).map(publicUser),
    desks: Object.fromEntries(Object.entries(desks).filter(([id, v]) => deskIds.has(id) && v?.user_id).map(([id, v]) => [id, v.user_id])),
    meetings: myMeetings,
    layout: { items: layout.items, updated_at: layout.updated_at || 0 },
  };
}

async function requireUser(ctx) {
  const id = readSession(ctx.cookie);
  if (!id) fail(401, 'unauthorized');
  const user = await db.get('users', id);
  if (!user) fail(401, 'unauthorized');
  return user;
}

const handlers = {
  async session(input, ctx) {
    const id = readSession(ctx.cookie);
    const user = id ? await db.get('users', id) : null;
    return { me: user ? publicUser(user) : null, driver: DRIVER };
  },

  async register(input, ctx) {
    const name = cleanName(input.name);
    const email = cleanEmail(input.email);
    const password = String(input.password || '');
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
      fail(422, 'Confira nome, e-mail e senha (mínimo 6 caracteres).');
    }
    const id = uid();
    const firstUser = Object.keys(await db.all('users')).length === 0;
    const claimed = await db.putIfAbsent('emails', email, id);
    if (!claimed) fail(409, 'Esse e-mail já está cadastrado.');
    const user = {
      id, name, email, password_hash: hashPassword(password), role: firstUser ? 'Admin' : 'Membro', status: 'active',
      avatar: randomAvatar(email), onboarded: false, created_at: new Date().toISOString(),
    };
    await db.put('users', id, user);
    await db.bumpRev();
    ctx.setCookie(makeSessionCookie(id, ctx.secure));
    return { me: publicUser(user), firstTime: true };
  },

  async login(input, ctx) {
    const email = cleanEmail(input.email);
    const id = await db.get('emails', email);
    const user = id ? await db.get('users', id) : null;
    if (!user || !verifyPassword(String(input.password || ''), user.password_hash)) fail(401, 'E-mail ou senha inválidos.');
    ctx.setCookie(makeSessionCookie(user.id, ctx.secure));
    return { me: publicUser(user), firstTime: !user.onboarded };
  },

  async logout(input, ctx) {
    const id = readSession(ctx.cookie);
    if (id) await db.del('presence', id);
    ctx.setCookie(clearSessionCookie());
    return {};
  },

  // Saída da página (sendBeacon): some do escritório na hora, mas continua logado.
  async leave(input, ctx) {
    const id = readSession(ctx.cookie);
    if (id) {
      const p = await db.get('presence', id);
      if (p && (!input.sid || p.sid === input.sid)) await db.del('presence', id);
    }
    return {};
  },

  async save_avatar(input, ctx) {
    const me = await requireUser(ctx);
    me.avatar = sanitizeAvatar(input.avatar);
    me.onboarded = true;
    const name = cleanName(input.name);
    if (name.length >= 2) me.name = name;
    await db.put('users', me.id, me);
    await db.bumpRev();
    return { me: publicUser(me) };
  },

  async set_status(input, ctx) {
    const me = await requireUser(ctx);
    const status = String(input.status || 'active');
    if (!STATUSES.includes(status)) fail(422, 'Status inválido.');
    me.status = status;
    await db.put('users', me.id, me);
    await db.bumpRev();
    return { me: publicUser(me) };
  },

  async bootstrap(input, ctx) {
    const me = await requireUser(ctx);
    const [bundle, rev] = await Promise.all([loadBundle(me.id), db.getRev()]);
    return { me: publicUser(me), rev, ...bundle, driver: DRIVER, ice: iceServers() };
  },

  async sync(input, ctx) {
    const me = await requireUser(ctx);
    const now = Date.now();
    const seat = typeof input.seat === 'string' && /^[\w#-]{1,48}$/.test(input.seat) ? input.seat : null;
    const emote = input.emote && typeof input.emote.e === 'string' ? { e: input.emote.e.slice(0, 8), t: Number(input.emote.t) || now } : null;
    const presence = {
      user_id: me.id,
      sid: String(input.sid || '').slice(0, 24),
      x: clamp(input.x, WORLD.minX, WORLD.maxX, SPAWN.x),
      z: clamp(input.z, WORLD.minZ, WORLD.maxZ, SPAWN.z),
      ry: clamp(input.ry, -10, 10, 0),
      seat,
      muted: !!input.muted,
      cam: !!input.cam,
      speaking: !!input.speaking,
      meeting_id: typeof input.meeting_id === 'string' ? input.meeting_id.slice(0, 32) : null,
      emote,
      last_seen: now,
    };

    // Sinais WebRTC de saída (offer/answer/ice).
    const outgoing = Array.isArray(input.signals) ? input.signals.slice(0, 40) : [];
    const byTarget = new Map();
    for (const s of outgoing) {
      if (!s || typeof s.to !== 'string' || !['offer', 'answer', 'ice', 'bye'].includes(s.kind)) continue;
      const size = JSON.stringify(s.payload ?? null).length;
      if (size > 24_000) continue;
      const sig = { from: me.id, fromSid: presence.sid, to: s.to, toSid: String(s.toSid || ''), kind: s.kind, payload: s.payload ?? null, ts: now };
      if (!byTarget.has(s.to)) byTarget.set(s.to, []);
      byTarget.get(s.to).push(sig);
    }
    await Promise.all([...byTarget].map(([to, list]) => db.pushSignals(to, list)));

    const { presence: all, signals, rev } = await db.syncBundle(me.id, presence);
    const fresh = [];
    const stale = [];
    for (const [id, p] of Object.entries(all)) {
      if (p && now - (p.last_seen || 0) < PRESENCE_TTL) fresh.push(p); else stale.push(id);
    }
    if (stale.length && Math.random() < 0.2) db.del('presence', ...stale).catch(() => {});

    const out = { presence: fresh, signals: signals.filter((s) => !s.toSid || s.toSid === presence.sid), rev, now };
    if (Number(input.rev) !== rev) Object.assign(out, await loadBundle(me.id));
    return out;
  },

  async assign_desk(input, ctx) {
    const me = await requireUser(ctx);
    const deskId = String(input.desk_id || '');
    const layout = await getLayout();
    if (!desksOf(layout.items).some((d) => d.id === deskId)) fail(404, 'Mesa não encontrada.');
    const desks = await db.all('desks');
    const owner = desks[deskId]?.user_id;
    if (owner && owner !== me.id) fail(409, 'Essa mesa já pertence a outra pessoa.');
    if (owner === me.id) return { desk_id: deskId };
    const mine = Object.entries(desks).filter(([, v]) => v?.user_id === me.id).map(([id]) => id);
    if (!(await db.putIfAbsent('desks', deskId, { user_id: me.id, at: Date.now() }))) {
      fail(409, 'Alguém pegou essa mesa agora mesmo.');
    }
    if (mine.length) await db.del('desks', ...mine);
    await db.bumpRev();
    return { desk_id: deskId };
  },

  async unassign_desk(input, ctx) {
    const me = await requireUser(ctx);
    const desks = await db.all('desks');
    const mine = Object.entries(desks).filter(([, v]) => v?.user_id === me.id).map(([id]) => id);
    if (mine.length) { await db.del('desks', ...mine); await db.bumpRev(); }
    return {};
  },

  async save_layout(input, ctx) {
    const me = await requireUser(ctx);
    if (!isAdmin(me)) fail(403, 'Só administradores podem editar o escritório.');
    const items = input.reset ? defaultLayout() : cleanItems(input.items);
    const doc = { items, updated_at: Date.now(), by: me.id };
    if (input.reset) await db.del('layout', 'main'); else await db.put('layout', 'main', doc);
    // libera atribuições de mesas que deixaram de existir
    const ids = new Set(desksOf(items).map((d) => d.id));
    const desks = await db.all('desks');
    const gone = Object.keys(desks).filter((id) => !ids.has(id));
    if (gone.length) await db.del('desks', ...gone);
    await db.bumpRev();
    return { layout: doc };
  },

  async set_role(input, ctx) {
    const me = await requireUser(ctx);
    if (!isAdmin(me)) fail(403, 'Só administradores podem mudar permissões.');
    const u = await db.get('users', String(input.user_id || ''));
    if (!u) fail(404, 'Pessoa não encontrada.');
    u.role = input.role === 'Admin' ? 'Admin' : 'Membro';
    await db.put('users', u.id, u);
    await db.bumpRev();
    return { user: publicUser(u) };
  },

  async create_meeting(input, ctx) {
    const me = await requireUser(ctx);
    const users = await db.all('users');
    const requested = Array.isArray(input.participants) ? input.participants : [];
    const participants = [me.id, ...new Set(requested.filter((id) => users[id] && id !== me.id))];
    if (participants.length < 2) fail(422, 'Convide pelo menos uma pessoa.');
    const title = cleanName(input.title) || 'Reunião privada';
    const meeting = {
      id: uid(), title, host_id: me.id, participants, joined: [me.id], declined: [],
      status: 'open', created_at: new Date().toISOString(), created_ts: Date.now(),
    };
    await db.put('meetings', meeting.id, meeting);
    await db.bumpRev();
    return { meeting };
  },

  async join_meeting(input, ctx) {
    const me = await requireUser(ctx);
    const m = await db.get('meetings', String(input.meeting_id || ''));
    if (!m || m.status !== 'open' || !m.participants.includes(me.id)) fail(404, 'Reunião indisponível.');
    m.joined = [...new Set([...(m.joined || []), me.id])];
    await db.put('meetings', m.id, m);
    await db.bumpRev();
    return { meeting: m };
  },

  async leave_meeting(input, ctx) {
    const me = await requireUser(ctx);
    const m = await db.get('meetings', String(input.meeting_id || ''));
    if (m) {
      m.joined = (m.joined || []).filter((id) => id !== me.id);
      if (!m.joined.length) m.status = 'closed';
      await db.put('meetings', m.id, m);
      await db.bumpRev();
    }
    return {};
  },

  async decline_meeting(input, ctx) {
    const me = await requireUser(ctx);
    const m = await db.get('meetings', String(input.meeting_id || ''));
    if (m) {
      m.participants = m.participants.filter((id) => id !== me.id);
      m.joined = (m.joined || []).filter((id) => id !== me.id);
      if (m.participants.length < 2 || !m.joined.length) m.status = 'closed';
      await db.put('meetings', m.id, m);
      await db.bumpRev();
    }
    return {};
  },
};

// Adaptador HTTP genérico (Vercel Functions e servidor local usam o mesmo).
export async function handle(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const cookies = [];
  try {
    if (req.method !== 'POST') fail(405, 'Use POST.');
    let input = req.body;
    if (typeof input === 'string') input = JSON.parse(input || '{}');
    input = input && typeof input === 'object' ? input : {};
    const fn = handlers[input.action];
    if (!fn) fail(404, 'Ação inválida.');
    const proto = req.headers['x-forwarded-proto'] || '';
    const ctx = {
      cookie: req.headers.cookie,
      secure: proto.includes('https'),
      setCookie: (c) => cookies.push(c),
    };
    const data = await fn(input, ctx);
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, ...data }));
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    res.statusCode = status;
    res.end(JSON.stringify({ ok: false, error: status === 500 ? 'Erro interno no servidor.' : e.message }));
  }
}

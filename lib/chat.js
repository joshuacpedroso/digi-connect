// Chat: conversas privadas (DM) e canais (#nome) com quem você escolher.
// Coleções JSON: channels { id: canal }, reads { userId: { canal: nº lido } }, push { userId: [inscrições] }
// Listas: m:<canal> (mensagens em ordem) · x:<canal> (hash com alterações: apagada, visualização única aberta)
import { db } from './db.js';
import { uploadTicket, isOurFile, deleteFile, FILE_MODE } from './files.js';
import { vapidKeys, subscribe, unsubscribe, sendPush } from './push.js';

const KINDS = ['text', 'image', 'video', 'audio', 'vnote', 'file', 'gif'];
const dmId = (a, b) => `dm_${[a, b].sort().join('_')}`;
const cleanText = (s, n = 4000) => String(s ?? '').replace(/\r\n/g, '\n').slice(0, n);
const channelName = (s) => String(s || '').replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 32);

const PREVIEW = { image: '📷 Foto', video: '🎬 Vídeo', audio: '🎤 Áudio', vnote: '📹 Recado de vídeo', file: '📎 Arquivo', gif: 'GIF' };
const preview = (m) => (m.deleted ? 'Mensagem apagada' : m.once ? (m.kind === 'video' ? '🎬 Vídeo (visualização única)' : '📷 Foto (visualização única)')
  : m.kind === 'text' ? m.text.slice(0, 120) : `${PREVIEW[m.kind] || '📎'}${m.text ? ` · ${m.text.slice(0, 80)}` : ''}`);

export function publicChannel(c) {
  return { id: c.id, type: c.type, name: c.name || '', members: c.members, created_by: c.created_by, last: c.last || null, n: c.n || 0, updated: c.updated || 0 };
}

// Assinatura das conversas de alguém: muda quando chega mensagem, entra/sai gente ou o canal é renomeado.
export function chatDigest(channels, userId, reads) {
  const mine = Object.values(channels || {}).filter((c) => c?.members?.includes(userId));
  let max = 0;
  for (const c of mine) max = Math.max(max, c.updated || 0);
  return { mine, sig: `${max}:${mine.length}:${reads?._t || 0}` };
}

export function chatHandlers({ requireUser, fail, uid }) {
  async function channelFor(me, cid) {
    const c = await db.get('channels', String(cid || ''));
    if (!c || !c.members.includes(me.id)) fail(404, 'Conversa não encontrada.');
    return c;
  }

  // Como cada pessoa vê a mensagem (visualização única esconde o arquivo de quem ainda não abriu/já abriu).
  function view(m, x, meId) {
    const out = { ...m, ...(x || {}) };
    if (out.deleted) { delete out.file; delete out.text; out.kind = 'text'; return out; }
    if (out.once) {
      const opened = (out.opened || []).includes(meId);
      out.openedByMe = opened;
      // o endereço do arquivo nunca vai na lista: só chat_open_once entrega, uma vez
      out.file = out.file ? { type: out.file.type, dur: out.file.dur, w: out.file.w, h: out.file.h } : null;
      if (out.from !== meId) delete out.opened;
    }
    return out;
  }

  async function messages(cid, meId, { skip = 0, limit = 60 } = {}) {
    const [list, patches] = await Promise.all([db.listRange(`m:${cid}`, -(skip + limit), -(skip + 1)), db.all(`x:${cid}`)]);
    return list.map((m) => view(m, patches[m.id], meId));
  }

  async function touch(c, msg) {
    c.updated = Date.now();
    if (msg) { c.last = { ts: msg.ts, from: msg.from, kind: msg.kind, preview: preview(msg), id: msg.id }; }
    await db.put('channels', c.id, c);
  }

  return {
    async chat_list(input, ctx) {
      const me = await requireUser(ctx);
      const [channels, reads] = await Promise.all([db.all('channels'), db.get('reads', me.id)]);
      const { mine, sig } = chatDigest(channels, me.id, reads);
      return { channels: mine.map(publicChannel), reads: reads || {}, sig };
    },

    async chat_open_dm(input, ctx) {
      const me = await requireUser(ctx);
      const other = await db.get('users', String(input.user_id || ''));
      if (!other) fail(404, 'Pessoa não encontrada.');
      const id = other.id === me.id ? `dm_${me.id}` : dmId(me.id, other.id);
      let c = await db.get('channels', id);
      if (!c) {
        c = { id, type: 'dm', members: [...new Set([me.id, other.id])], created_by: me.id, created_at: Date.now(), n: 0, updated: Date.now() };
        await db.putIfAbsent('channels', id, c);
        c = (await db.get('channels', id)) || c;
      }
      return { channel: publicChannel(c) };
    },

    async chat_create(input, ctx) {
      const me = await requireUser(ctx);
      const name = channelName(input.name);
      if (name.length < 2) fail(422, 'Dê um nome ao canal (mínimo 2 letras).');
      const users = await db.all('users');
      const members = [me.id, ...new Set((Array.isArray(input.members) ? input.members : []).filter((id) => users[id] && id !== me.id))];
      const c = { id: `ch_${uid()}`, type: 'channel', name, members, created_by: me.id, created_at: Date.now(), n: 0, updated: Date.now() };
      await db.put('channels', c.id, c);
      await addSystem(c, me, `criou o canal #${name}`);
      return { channel: publicChannel(c) };
    },

    async chat_update(input, ctx) {
      const me = await requireUser(ctx);
      const c = await channelFor(me, input.cid);
      if (c.type !== 'channel') fail(422, 'Só canais podem ser editados.');
      const users = await db.all('users');
      const add = (Array.isArray(input.add) ? input.add : []).filter((id) => users[id] && !c.members.includes(id));
      const notes = [];
      if (add.length) { c.members.push(...add); notes.push(`adicionou ${add.map((id) => users[id].name.split(' ')[0]).join(', ')}`); }
      if (Array.isArray(input.remove) && input.remove.length) {
        if (c.created_by !== me.id) fail(403, 'Só quem criou o canal pode remover pessoas.');
        const rm = input.remove.filter((id) => c.members.includes(id) && id !== me.id);
        c.members = c.members.filter((id) => !rm.includes(id));
        if (rm.length) notes.push(`removeu ${rm.map((id) => users[id]?.name.split(' ')[0] || 'alguém').join(', ')}`);
      }
      if (typeof input.name === 'string') {
        const name = channelName(input.name);
        if (name.length >= 2 && name !== c.name) { c.name = name; notes.push(`renomeou o canal para #${name}`); }
      }
      if (!notes.length) return { channel: publicChannel(c) };
      await db.put('channels', c.id, c);
      await addSystem(c, me, notes.join(' e '));
      return { channel: publicChannel(c) };
    },

    async chat_leave(input, ctx) {
      const me = await requireUser(ctx);
      const c = await channelFor(me, input.cid);
      if (c.type !== 'channel') fail(422, 'Não dá para sair de uma conversa privada.');
      c.members = c.members.filter((id) => id !== me.id);
      if (!c.members.length) { await db.del('channels', c.id); await db.listDel(`m:${c.id}`); return {}; }
      await addSystem(c, me, 'saiu do canal');
      return {};
    },

    async chat_history(input, ctx) {
      const me = await requireUser(ctx);
      const c = await channelFor(me, input.cid);
      const skip = Math.max(0, Math.floor(Number(input.skip) || 0));
      const list = await messages(c.id, me.id, { skip, limit: 60 });
      return { channel: publicChannel(c), messages: list, more: (c.n || 0) > skip + list.length };
    },

    async chat_since(input, ctx) {
      const me = await requireUser(ctx);
      const c = await channelFor(me, input.cid);
      const after = Number(input.after) || 0;
      let limit = 30;
      let list = await messages(c.id, me.id, { limit });
      while (list.length === limit && list[0].ts > after && limit < 600) { limit *= 2; list = await messages(c.id, me.id, { limit }); }
      return { messages: list.filter((m) => m.ts > after || Number(input.patchSince) <= (m.patched || 0)) };
    },

    async chat_send(input, ctx) {
      const me = await requireUser(ctx);
      const c = await channelFor(me, input.cid);
      const kind = KINDS.includes(input.kind) ? input.kind : 'text';
      const text = cleanText(input.text).trim();
      const msg = { id: `${Date.now().toString(36)}${uid().slice(0, 6)}`, cid: c.id, from: me.id, ts: Date.now(), kind, text };
      if (kind === 'gif') {
        const g = input.gif || {};
        if (typeof g.url !== 'string' || !/^https:\/\/(media\d?\.giphy\.com|i\.giphy\.com)\//.test(g.url)) fail(422, 'GIF inválido.');
        msg.file = { url: g.url, type: 'image/gif', w: Number(g.w) || 0, h: Number(g.h) || 0, mp4: typeof g.mp4 === 'string' && /^https:\/\/(media\d?\.giphy\.com|i\.giphy\.com)\//.test(g.mp4) ? g.mp4 : undefined };
      } else if (kind !== 'text') {
        const f = input.file || {};
        if (!isOurFile(f.url)) fail(422, 'Arquivo inválido.');
        msg.file = {
          url: f.url, name: cleanText(f.name, 120) || 'arquivo', size: Number(f.size) || 0, type: cleanText(f.type, 100),
          w: Number(f.w) || undefined, h: Number(f.h) || undefined, dur: Number(f.dur) || undefined,
          wave: Array.isArray(f.wave) ? f.wave.slice(0, 64).map((v) => Math.max(0, Math.min(1, Number(v) || 0))) : undefined,
          poster: isOurFile(f.poster) ? f.poster : undefined,
        };
        if (input.once && (kind === 'image' || kind === 'video')) { msg.once = true; msg.opened = []; }
      } else if (!text) fail(422, 'Mensagem vazia.');
      c.n = await db.listPush(`m:${c.id}`, msg);
      await touch(c, msg);
      // lido até aqui por quem enviou
      const reads = (await db.get('reads', me.id)) || {};
      reads[c.id] = c.n; reads._t = Date.now();
      await db.put('reads', me.id, reads);
      // push para os outros membros
      const others = c.members.filter((id) => id !== me.id);
      const title = c.type === 'dm' ? me.name : `#${c.name} · ${me.name.split(' ')[0]}`;
      sendPush(others, { title, body: preview(msg), cid: c.id, tag: c.id, ts: msg.ts }).catch((e) => console.warn('push', e.message));
      return { message: view(msg, null, me.id), channel: publicChannel(c) };
    },

    async chat_read(input, ctx) {
      const me = await requireUser(ctx);
      const c = await channelFor(me, input.cid);
      const reads = (await db.get('reads', me.id)) || {};
      if ((reads[c.id] || 0) >= (c.n || 0)) return {};
      reads[c.id] = c.n || 0; reads._t = Date.now();
      await db.put('reads', me.id, reads);
      return {};
    },

    // Visualização única: entrega o arquivo uma vez para cada destinatário.
    async chat_open_once(input, ctx) {
      const me = await requireUser(ctx);
      const c = await channelFor(me, input.cid);
      const mid = String(input.mid || '');
      const list = await db.listRange(`m:${c.id}`, -400, -1);
      const m = list.find((x) => x.id === mid);
      if (!m || !m.once) fail(404, 'Mensagem não encontrada.');
      if (m.from === me.id) fail(403, 'Você enviou com visualização única — só quem recebe pode abrir.');
      const x = (await db.get(`x:${c.id}`, mid)) || {};
      if (x.deleted) fail(410, 'Mensagem apagada.');
      const opened = x.opened || [];
      if (opened.includes(me.id)) fail(410, 'Você já abriu essa mídia. Visualização única 👀');
      x.opened = [...opened, me.id];
      x.patched = Date.now();
      await db.put(`x:${c.id}`, mid, x);
      c.updated = Date.now();
      await db.put('channels', c.id, c);
      return { file: m.file };
    },

    // Quem abriu terminou de ver: se todos os destinatários já viram, o arquivo é apagado.
    async chat_once_done(input, ctx) {
      const me = await requireUser(ctx);
      const c = await channelFor(me, input.cid);
      const mid = String(input.mid || '');
      const list = await db.listRange(`m:${c.id}`, -400, -1);
      const m = list.find((x) => x.id === mid);
      const x = (await db.get(`x:${c.id}`, mid)) || {};
      if (m?.once && !x.gone && c.members.filter((id) => id !== m.from).every((id) => (x.opened || []).includes(id))) {
        await deleteFile(m.file.url);
        x.gone = true;
        await db.put(`x:${c.id}`, mid, x);
      }
      return {};
    },

    async chat_delete(input, ctx) {
      const me = await requireUser(ctx);
      const c = await channelFor(me, input.cid);
      const mid = String(input.mid || '');
      const list = await db.listRange(`m:${c.id}`, -400, -1);
      const m = list.find((x) => x.id === mid);
      if (!m) fail(404, 'Mensagem não encontrada.');
      if (m.from !== me.id) fail(403, 'Você só pode apagar suas mensagens.');
      const x = (await db.get(`x:${c.id}`, mid)) || {};
      x.deleted = true; x.patched = Date.now();
      await db.put(`x:${c.id}`, mid, x);
      if (m.file?.url && isOurFile(m.file.url)) deleteFile(m.file.url);
      if (c.last?.id === mid) c.last = { ...c.last, preview: 'Mensagem apagada', kind: 'text' };
      c.updated = Date.now();
      await db.put('channels', c.id, c);
      return {};
    },

    async upload_ticket(input, ctx) {
      const me = await requireUser(ctx);
      const t = await uploadTicket(me.id, { name: input.name, size: input.size, type: input.type });
      if (t.error) fail(413, t.error);
      return t;
    },

    async gif_search(input, ctx) {
      await requireUser(ctx);
      const key = process.env.GIPHY_API_KEY;
      if (!key) return { gifs: [], disabled: true };
      const q = cleanText(input.q, 60).trim();
      const url = q
        ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13&lang=pt`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=24&rating=pg-13`;
      const r = await fetch(url);
      if (!r.ok) fail(502, 'Não deu para buscar GIFs agora.');
      const j = await r.json();
      return {
        gifs: (j.data || []).map((g) => ({
          id: g.id, title: g.title,
          url: g.images?.fixed_height?.url, w: Number(g.images?.fixed_height?.width) || 0, h: Number(g.images?.fixed_height?.height) || 0,
          mp4: g.images?.fixed_height?.mp4, thumb: g.images?.fixed_height_small?.url || g.images?.fixed_height?.url,
        })).filter((g) => g.url),
      };
    },

    async push_key(input, ctx) {
      await requireUser(ctx);
      const k = await vapidKeys();
      return { key: k.publicKey, files: FILE_MODE, gifs: !!process.env.GIPHY_API_KEY };
    },
    async push_subscribe(input, ctx) {
      const me = await requireUser(ctx);
      return { ok: await subscribe(me.id, input.sub) };
    },
    async push_unsubscribe(input, ctx) {
      const me = await requireUser(ctx);
      if (typeof input.endpoint === 'string') await unsubscribe(me.id, input.endpoint);
      return {};
    },
  };

  async function addSystem(c, me, text) {
    const msg = { id: `${Date.now().toString(36)}${uid().slice(0, 6)}`, cid: c.id, from: me.id, ts: Date.now(), kind: 'system', text };
    c.n = await db.listPush(`m:${c.id}`, msg);
    c.updated = Date.now();
    c.last = { ts: msg.ts, from: me.id, kind: 'system', preview: `${me.name.split(' ')[0]} ${text}`, id: msg.id };
    await db.put('channels', c.id, c);
  }
}

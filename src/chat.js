// Chat do DIGI CONNECT: conversas privadas, canais (#nome), fotos, vídeos, arquivos, GIFs,
// recados de áudio (segure para gravar, igual WhatsApp), recados de vídeo, visualização única e notificações.
import { icons } from './icons.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'Alguém';
const fmtSize = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b > 1e3 ? `${Math.round(b / 1e3)} KB` : `${b} B`);
const fmtDur = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtTime = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
function fmtDay(ts) {
  const d = new Date(ts); const t = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(t) - day(d)) / 864e5);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: diff < 7 ? 'long' : undefined, day: '2-digit', month: 'long' });
}
function fmtListTime(ts) {
  if (!ts) return '';
  const d = new Date(ts); const now = new Date();
  if (d.toDateString() === now.toDateString()) return fmtTime(ts);
  if (now - d < 6 * 864e5) return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\n/g, '<br>');
const pickMime = (list) => list.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';

export function createChat(ctx) {
  const { api, toast, avatarChip, statusOf, onBadge, broadcast, scheduleSync } = ctx;
  const S = ctx.S;
  const st = {
    channels: new Map(), reads: {}, sig: null, open: null, msgs: [], more: false, loading: false,
    known: new Map(), filter: '', visible: false, pending: [], once: false, gifs: null, first: true,
  };
  const root = document.createElement('section');
  root.id = 'chat';
  root.hidden = true;
  root.innerHTML = `
    <div class="ch-list">
      <div class="ch-head">
        <div><span class="eyebrow">DIGI CONNECT</span><h3>Mensagens</h3></div>
        <div class="ch-head-btns">
          <button class="icon-btn" id="chNew" title="Novo canal">${icons.plus}</button>
          <button class="icon-btn ch-close" id="chClose" title="Fechar">${icons.close}</button>
        </div>
      </div>
      <button class="ch-notify" id="chNotify" hidden>${icons.bell}<span><b>Ativar notificações</b><small>Receba mensagens mesmo com o app fechado</small></span></button>
      <label class="search ch-search"><span>${icons.search}</span><input id="chSearch" placeholder="Buscar conversas e pessoas…" /></label>
      <div class="ch-scroll" id="chConvs"></div>
    </div>
    <div class="ch-thread" id="chThread">
      <div class="ch-empty" id="chEmpty">
        <div class="ch-empty-ico">${icons.chat}</div>
        <h3>Suas conversas</h3>
        <p>Escolha alguém para conversar no privado ou crie um canal com quem você quiser.</p>
        <button class="btn-primary sm" id="chEmptyNew">${icons.hash} Criar canal</button>
      </div>
      <header class="ch-thead" hidden>
        <button class="icon-btn ch-back" id="chBack" title="Voltar">${icons.back}</button>
        <div class="ch-title" id="chTitle"></div>
        <div class="ch-tactions" id="chTActions"></div>
      </header>
      <div class="ch-msgs" id="chMsgs" hidden></div>
      <div class="ch-drop" id="chDrop" hidden><div>${icons.paperclip}<b>Solte para enviar</b></div></div>
      <footer class="ch-composer" id="chComposer" hidden>
        <div class="ch-pending" id="chPending"></div>
        <div class="ch-row">
          <div class="ch-attach-wrap">
            <button class="icon-btn" id="chAttach" title="Anexar">${icons.plus}</button>
            <div class="ch-menu glass" id="chMenu" hidden>
              <button data-act="media">${icons.image}<span>Foto ou vídeo</span></button>
              <button data-act="camera" class="mobile-only">${icons.cam}<span>Câmera</span></button>
              <button data-act="file">${icons.file}<span>Arquivo</span></button>
              <button data-act="once">${icons.once}<span>Visualização única</span></button>
              <button data-act="vnote">${icons.video}<span>Recado de vídeo</span></button>
              <button data-act="gif"><b class="gif-ico">GIF</b><span>GIF</span></button>
            </div>
          </div>
          <div class="ch-input-wrap">
            <textarea id="chInput" rows="1" placeholder="Escreva uma mensagem…" maxlength="4000"></textarea>
            <button class="ch-gif-btn" id="chGifBtn" title="GIF">GIF</button>
          </div>
          <button class="ch-send" id="chSend" title="Enviar" hidden>${icons.send}</button>
          <button class="ch-mic" id="chMic" title="Segure para gravar um áudio">${icons.mic}</button>
        </div>
        <div class="ch-rec" id="chRec" hidden>
          <button class="icon-btn ch-rec-cancel" id="chRecCancel" title="Descartar">${icons.trash}</button>
          <i class="rec-dot"></i><span class="rec-time" id="chRecTime">0:00</span>
          <canvas class="rec-wave" id="chRecWave" width="300" height="36"></canvas>
          <span class="rec-hint" id="chRecHint">◀ deslize para cancelar · ▲ trava</span>
          <button class="ch-send" id="chRecSend" title="Enviar áudio" hidden>${icons.send}</button>
        </div>
      </footer>
      <div class="ch-gifs glass" id="chGifs" hidden>
        <div class="ch-gifs-head"><input id="chGifQ" placeholder="Buscar GIFs…" /><button class="icon-btn" id="chGifClose">${icons.close}</button></div>
        <div class="ch-gifs-grid" id="chGifGrid"></div>
        <small class="giphy">Powered by GIPHY</small>
      </div>
    </div>
    <input type="file" id="chFileMedia" accept="image/*,video/*" multiple hidden />
    <input type="file" id="chFileAny" multiple hidden />
    <input type="file" id="chFileCam" accept="image/*" capture="environment" hidden />
    <input type="file" id="chFileOnce" accept="image/*,video/*" hidden />
  `;
  document.body.appendChild(root);

  // modais e visualizadores
  const modal = document.createElement('section');
  modal.className = 'modal ch-modal';
  modal.hidden = true;
  document.body.appendChild(modal);
  const viewer = document.createElement('div');
  viewer.id = 'chViewer';
  viewer.hidden = true;
  document.body.appendChild(viewer);
  const notes = document.createElement('div');
  notes.id = 'chToasts';
  document.body.appendChild(notes);

  // ------------------------------------------------------------------ helpers de dados
  const me = () => S.me;
  const userOf = (id) => S.users.get(id);
  const isOnline = (id) => S.presence?.has?.(id);
  const otherOf = (c) => c.members.find((id) => id !== me().id) || me().id;
  const titleOf = (c) => (c.type === 'dm' ? (userOf(otherOf(c))?.name || 'Pessoa') : `#${c.name}`);
  const unreadOf = (c) => Math.max(0, (c.n || 0) - (st.reads[c.id] || 0));
  const totalUnread = () => [...st.channels.values()].reduce((s, c) => s + unreadOf(c), 0);

  function badge() {
    const n = totalUnread();
    onBadge?.(n);
    document.title = n ? `(${n}) DIGI CONNECT` : 'DIGI CONNECT';
    try { if (n) navigator.setAppBadge?.(n); else navigator.clearAppBadge?.(); } catch { /* */ }
  }

  // ------------------------------------------------------------------ sincronização
  function applySync(chat) {
    if (!chat) return;
    st.sig = chat.sig;
    st.reads = chat.reads || {};
    const prev = st.channels;
    st.channels = new Map(chat.channels.map((c) => [c.id, c]));
    for (const c of st.channels.values()) {
      const old = st.known.get(c.id);
      const lastId = c.last?.id;
      if (!st.first && lastId && lastId !== old && c.last.from !== me().id && c.last.kind !== 'system') notify(c);
      st.known.set(c.id, lastId);
    }
    st.first = false;
    if (st.open) {
      const c = st.channels.get(st.open);
      if (!c) closeThread();
      else if (c.updated !== prev.get(st.open)?.updated) { fetchNew(); renderHeader(); }
    }
    renderList();
    badge();
  }

  async function loadList() {
    try { applySync(await api('chat_list')); } catch { /* offline */ }
  }

  // ------------------------------------------------------------------ notificações
  let audioCtx = null;
  function ding() {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime;
      [880, 1320].forEach((f, i) => {
        const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.09); g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.09 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.22);
        o.connect(g).connect(audioCtx.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.25);
      });
    } catch { /* */ }
  }

  function notify(c) {
    const watching = st.visible && st.open === c.id && document.visibilityState === 'visible';
    if (watching) return;
    const from = userOf(c.last.from);
    const title = c.type === 'dm' ? (from?.name || 'Mensagem') : `#${c.name} · ${firstName(from?.name)}`;
    if (document.visibilityState === 'visible') {
      ding();
      const el = document.createElement('button');
      el.className = 'ch-toast glass';
      el.innerHTML = `${avatarChip(from || { id: c.last.from })}<span><b>${esc(title)}</b><small>${esc(c.last.preview)}</small></span>`;
      el.onclick = () => { open(); openThread(c.id); el.remove(); };
      notes.appendChild(el);
      setTimeout(() => el.classList.add('out'), 4800);
      setTimeout(() => el.remove(), 5300);
    } else if (!st.pushOn && Notification?.permission === 'granted') {
      navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, { body: c.last.preview, tag: c.id, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', data: { cid: c.id } })).catch(() => {});
    }
  }

  // Push: inscreve o aparelho (precisa de permissão; no iPhone, só com o app instalado na tela inicial)
  const b64ToBytes = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (ch) => ch.charCodeAt(0)); };
  async function setupPush(ask = false) {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    $('#chNotify', root).hidden = !supported || Notification.permission === 'granted' || Notification.permission === 'denied';
    if (!supported) return;
    if (ask && Notification.permission === 'default') {
      const p = await Notification.requestPermission();
      $('#chNotify', root).hidden = p !== 'default';
      if (p !== 'granted') { toast('Sem permissão para notificações. Dá para liberar nas configurações do navegador.'); return; }
    }
    if (Notification.permission !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const { key, gifs } = await api('push_key');
      st.gifsOn = gifs;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
      await api('push_subscribe', { sub: sub.toJSON() });
      st.pushOn = true;
      if (ask) toast('Notificações ativadas 🔔');
    } catch (e) { console.warn('push', e); }
  }
  $('#chNotify', root).onclick = () => setupPush(true);

  // ------------------------------------------------------------------ lista de conversas
  function renderList() {
    if (!S.me) return;
    const q = st.filter.trim().toLowerCase();
    const all = [...st.channels.values()].sort((a, b) => (b.last?.ts || b.updated || 0) - (a.last?.ts || a.updated || 0));
    const match = (c) => !q || titleOf(c).toLowerCase().includes(q);
    const chans = all.filter((c) => c.type === 'channel' && match(c));
    const dms = all.filter((c) => c.type === 'dm' && match(c) && (c.n || c.id === st.open));
    const withDm = new Set(dms.map(otherOf));
    const people = [...S.users.values()].filter((u) => u.id !== me().id && !withDm.has(u.id) && (!q || u.name.toLowerCase().includes(q)))
      .sort((a, b) => (isOnline(b.id) - isOnline(a.id)) || a.name.localeCompare(b.name));
    const row = (c) => {
      const un = unreadOf(c);
      const dm = c.type === 'dm';
      const u = dm ? userOf(otherOf(c)) : null;
      const who = c.last && c.last.from === me().id ? 'Você: ' : c.last && !dm && c.last.kind !== 'system' ? `${firstName(userOf(c.last.from)?.name)}: ` : '';
      return `<button class="ch-conv ${st.open === c.id ? 'on' : ''} ${un ? 'unread' : ''}" data-cid="${c.id}">
        ${dm ? avatarChip({ ...(u || { id: c.id }), status: isOnline(u?.id) ? u?.status : null }) : `<span class="ch-hash">${icons.hash}</span>`}
        <span class="ch-conv-main"><span class="ch-conv-top"><b>${esc(dm ? u?.name || 'Pessoa' : c.name)}</b><small>${fmtListTime(c.last?.ts)}</small></span>
        <span class="ch-conv-bot"><small>${esc(c.last ? who + c.last.preview : dm ? 'Diga oi 👋' : `${c.members.length} pessoas`)}</small>${un ? `<i class="ch-badge">${un > 99 ? '99+' : un}</i>` : ''}</span></span>
      </button>`;
    };
    $('#chConvs', root).innerHTML = `
      <div class="ch-sec"><span>Canais</span><button class="mini-btn" data-new-channel title="Novo canal">${icons.plus}</button></div>
      ${chans.map(row).join('') || '<p class="ch-none">Nenhum canal ainda. Crie um com o + 😉</p>'}
      <div class="ch-sec"><span>Mensagens diretas</span></div>
      ${dms.map(row).join('')}
      ${people.map((u) => `<button class="ch-conv person" data-user="${u.id}">${avatarChip({ ...u, status: isOnline(u.id) ? u.status : null })}<span class="ch-conv-main"><span class="ch-conv-top"><b>${esc(u.name)}</b></span><span class="ch-conv-bot"><small>${isOnline(u.id) ? statusOf(u.status).label : 'Offline'}</small></span></span></button>`).join('')}
      ${!dms.length && !people.length ? '<p class="ch-none">Ninguém por aqui ainda.</p>' : ''}`;
  }

  $('#chSearch', root).addEventListener('input', (e) => { st.filter = e.target.value; renderList(); });
  $('#chConvs', root).addEventListener('click', async (e) => {
    if (e.target.closest('[data-new-channel]')) return newChannel();
    const b = e.target.closest('.ch-conv');
    if (!b) return;
    if (b.dataset.cid) openThread(b.dataset.cid);
    else if (b.dataset.user) openDM(b.dataset.user);
  });

  // ------------------------------------------------------------------ conversa aberta
  function renderHeader() {
    const c = st.channels.get(st.open);
    if (!c) return;
    const dm = c.type === 'dm';
    const u = dm ? userOf(otherOf(c)) : null;
    $('#chTitle', root).innerHTML = dm
      ? `${avatarChip({ ...(u || { id: c.id }), status: isOnline(u?.id) ? u?.status : null })}<span><b>${esc(u?.name || 'Pessoa')}</b><small>${isOnline(u?.id) ? statusOf(u.status).label : 'Offline'}</small></span>`
      : `<span class="ch-hash big">${icons.hash}</span><span><b>${esc(c.name)}</b><small>${c.members.length} pessoas · ${esc(c.members.slice(0, 4).map((id) => firstName(userOf(id)?.name)).join(', '))}${c.members.length > 4 ? '…' : ''}</small></span>`;
    $('#chTActions', root).innerHTML = dm ? '' : `<button class="icon-btn" data-members title="Pessoas do canal">${icons.people}</button>`;
  }
  $('#chTActions', root).addEventListener('click', (e) => { if (e.target.closest('[data-members]')) channelInfo(); });

  async function openThread(cid) {
    if (!st.channels.has(cid)) await loadList();
    const c = st.channels.get(cid);
    if (!c) return;
    st.open = cid;
    root.classList.add('thread-open');
    $('#chEmpty', root).hidden = true;
    $('.ch-thead', root).hidden = false;
    $('#chMsgs', root).hidden = false;
    $('#chComposer', root).hidden = false;
    renderHeader();
    renderList();
    st.msgs = [];
    $('#chMsgs', root).innerHTML = '<div class="ch-loading"><i></i></div>';
    try {
      const j = await api('chat_history', { cid });
      if (st.open !== cid) return;
      st.msgs = j.messages;
      st.more = j.more;
      renderMsgs(true);
      markRead();
    } catch (e) { toast(e.message); }
    if (matchMedia('(pointer: fine)').matches) $('#chInput', root).focus();
  }

  function closeThread() {
    st.open = null;
    root.classList.remove('thread-open');
    $('#chEmpty', root).hidden = false;
    $('.ch-thead', root).hidden = true;
    $('#chMsgs', root).hidden = true;
    $('#chComposer', root).hidden = true;
    renderList();
  }
  $('#chBack', root).onclick = closeThread;

  async function openDM(userId) {
    try {
      const { channel } = await api('chat_open_dm', { user_id: userId });
      st.channels.set(channel.id, channel);
      open();
      openThread(channel.id);
    } catch (e) { toast(e.message); }
  }

  async function fetchNew() {
    const cid = st.open;
    if (!cid || st.loading) return;
    st.loading = true;
    try {
      const after = st.msgs.filter((m) => !m.local).at(-1)?.ts || 0;
      const j = await api('chat_since', { cid, after, patchSince: st.patchT || 0 });
      st.patchT = Date.now() - 5000;
      if (st.open !== cid) return;
      const byId = new Map(st.msgs.map((m, i) => [m.id, i]));
      let added = false;
      for (const m of j.messages) {
        if (byId.has(m.id)) st.msgs[byId.get(m.id)] = m;
        else { st.msgs.push(m); added = true; }
      }
      st.msgs.sort((a, b) => a.ts - b.ts);
      renderMsgs(added);
      markRead();
    } catch { /* */ } finally { st.loading = false; }
  }

  let readT = null;
  function markRead() {
    const c = st.channels.get(st.open);
    if (!c || !st.visible || document.visibilityState !== 'visible') return;
    if ((st.reads[c.id] || 0) >= (c.n || 0)) return;
    st.reads[c.id] = c.n;
    renderList();
    badge();
    clearTimeout(readT);
    readT = setTimeout(() => api('chat_read', { cid: c.id }).catch(() => {}), 300);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { markRead(); if (st.open) fetchNew(); } });

  // ------------------------------------------------------------------ mensagens
  function bubbleBody(m) {
    const f = m.file;
    if (m.deleted) return '<span class="ch-deleted">🚫 Mensagem apagada</span>';
    if (m.once) {
      const kind = f?.type?.startsWith('video') ? 'Vídeo' : 'Foto';
      if (m.from === me().id) {
        const seen = (m.opened || []).length;
        return `<span class="ch-once mine">${icons.once}<span><b>${kind} · visualização única</b><small>${seen ? 'Aberta ✓' : 'Ainda não aberta'}</small></span></span>`;
      }
      if (m.openedByMe) return `<span class="ch-once done">${icons.once}<span><b>${kind} aberta</b><small>Visualização única</small></span></span>`;
      return `<button class="ch-once" data-once="${m.id}">${icons.once}<span><b>${kind} · visualização única</b><small>Toque para abrir — só uma vez 👀</small></span></button>`;
    }
    const cap = m.text ? `<div class="ch-cap">${linkify(m.text)}</div>` : '';
    switch (m.kind) {
      case 'image': {
        const ar = f.w && f.h ? `style="aspect-ratio:${f.w}/${f.h}"` : '';
        return `<button class="ch-img" data-view="${esc(f.url)}" data-type="image"><img src="${esc(f.url)}" alt="" loading="lazy" ${ar} /></button>${cap}`;
      }
      case 'gif':
        return f.mp4 ? `<video class="ch-gif" src="${esc(f.mp4)}" autoplay loop muted playsinline ${f.w && f.h ? `style="aspect-ratio:${f.w}/${f.h}"` : ''}></video>` : `<img class="ch-gif" src="${esc(f.url)}" alt="GIF" loading="lazy" />`;
      case 'video': {
        const ar = f.w && f.h ? `style="aspect-ratio:${f.w}/${f.h}"` : '';
        return `<video class="ch-video" src="${esc(f.url)}#t=0.1" controls playsinline preload="metadata" ${ar}></video>${cap}`;
      }
      case 'vnote':
        return `<button class="ch-vnote" data-vnote="${m.id}"><video src="${esc(f.url)}#t=0.1" playsinline preload="metadata" muted></video><span class="vn-play">${icons.play}</span><span class="vn-dur">${fmtDur(f.dur)}</span></button>`;
      case 'audio': {
        const wave = (f.wave?.length ? f.wave : Array.from({ length: 40 }, (_, i) => 0.3 + 0.4 * Math.abs(Math.sin(i * 1.7)))).map((v) => `<i style="height:${Math.round(12 + v * 88)}%"></i>`).join('');
        return `<div class="ch-audio" data-audio="${esc(f.url)}" data-dur="${f.dur || 0}">${avatarChip(userOf(m.from) || { id: m.from })}<button class="au-play">${icons.play}</button><span class="au-wave">${wave}</span><span class="au-meta"><span class="au-time">${fmtDur(f.dur)}</span><button class="au-speed">1×</button></span></div>${cap}`;
      }
      case 'file':
        return `<a class="ch-file" href="${esc(f.url)}" target="_blank" rel="noopener" download="${esc(f.name)}"><span class="cf-ico">${icons.file}</span><span><b>${esc(f.name)}</b><small>${fmtSize(f.size || 0)}${f.type ? ` · ${esc(f.type.split('/').pop().toUpperCase().slice(0, 8))}` : ''}</small></span><span class="cf-dl">${icons.download}</span></a>${cap}`;
      default:
        return `<div class="ch-text">${linkify(m.text)}</div>`;
    }
  }

  function renderMsgs(scroll) {
    const box = $('#chMsgs', root);
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    const c = st.channels.get(st.open);
    let html = st.more ? '<button class="ch-more" id="chMore">Carregar mensagens anteriores</button>' : '';
    if (!st.more && c) html += `<div class="ch-intro">${c.type === 'dm' ? `${avatarChip({ ...(userOf(otherOf(c)) || { id: c.id }), status: null }, 'big')}<b>${esc(titleOf(c))}</b><small>Início da sua conversa privada.</small>` : `<span class="ch-hash big">${icons.hash}</span><b>#${esc(c.name)}</b><small>Este é o começo do canal.</small>`}</div>`;
    let lastDay = '', prev = null;
    for (const m of st.msgs) {
      const day = fmtDay(m.ts);
      if (day !== lastDay) { html += `<div class="ch-day"><span>${day}</span></div>`; lastDay = day; prev = null; }
      if (m.kind === 'system') { html += `<div class="ch-sys">${esc(firstName(userOf(m.from)?.name))} ${esc(m.text)}</div>`; prev = null; continue; }
      const mine = m.from === me().id;
      const grouped = prev && prev.from === m.from && m.ts - prev.ts < 5 * 60_000;
      const u = userOf(m.from);
      const media = ['image', 'video', 'gif', 'vnote'].includes(m.kind) && !m.once && !m.deleted;
      html += `<div class="ch-msg ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''} ${media ? 'media' : ''} k-${m.kind} ${m.local ? 'sending' : ''}" data-mid="${m.id}">
        ${!mine && !grouped && c?.type !== 'dm' ? avatarChip(u || { id: m.from }) : '<span class="ch-gap"></span>'}
        <div class="ch-bubble">
          ${!mine && !grouped && c?.type !== 'dm' ? `<span class="ch-from">${esc(u?.name || 'Alguém')}</span>` : ''}
          ${bubbleBody(m)}
          <span class="ch-meta">${m.local ? (m.progress != null ? `${Math.round(m.progress * 100)}%` : '⏳') : fmtTime(m.ts)}</span>
        </div>
        ${mine && !m.deleted && !m.local ? `<button class="ch-del" data-del="${m.id}" title="Apagar">${icons.trash}</button>` : ''}
      </div>`;
      prev = m;
    }
    const prevH = box.scrollHeight, prevTop = box.scrollTop;
    box.innerHTML = html;
    if (scroll === 'keep') box.scrollTop = box.scrollHeight - prevH + prevTop;
    else if (scroll || atBottom) box.scrollTop = box.scrollHeight;
    $$('img, video', box).forEach((el) => el.addEventListener(el.tagName === 'IMG' ? 'load' : 'loadedmetadata', () => { if (scroll || atBottom) box.scrollTop = box.scrollHeight; }, { once: true }));
  }

  $('#chMsgs', root).addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('#chMore')) {
      const j = await api('chat_history', { cid: st.open, skip: st.msgs.filter((m) => !m.local).length });
      st.msgs = [...j.messages, ...st.msgs]; st.more = j.more; renderMsgs('keep');
      return;
    }
    const del = t.closest('[data-del]');
    if (del) {
      if (!confirm('Apagar esta mensagem para todos?')) return;
      try { await api('chat_delete', { cid: st.open, mid: del.dataset.del }); const m = st.msgs.find((x) => x.id === del.dataset.del); if (m) { m.deleted = true; renderMsgs(); } } catch (err) { toast(err.message); }
      return;
    }
    const img = t.closest('[data-view]');
    if (img) return showViewer({ url: img.dataset.view, type: 'image' });
    const once = t.closest('[data-once]');
    if (once) return openOnce(once.dataset.once);
    const vn = t.closest('[data-vnote]');
    if (vn) return playVnote(vn);
    const au = t.closest('.ch-audio');
    if (au) {
      if (t.closest('.au-speed')) return cycleSpeed(au);
      if (t.closest('.au-wave')) return seekAudio(au, e);
      return toggleAudio(au);
    }
  });

  // áudio estilo WhatsApp
  let playing = null;
  function toggleAudio(box) {
    if (playing && playing.box !== box) stopAudio();
    if (playing?.box === box) { if (playing.a.paused) playing.a.play(); else playing.a.pause(); return; }
    const a = new Audio(box.dataset.audio);
    a.playbackRate = Number(box.dataset.rate || 1);
    playing = { box, a };
    const btn = $('.au-play', box);
    const bars = $$('.au-wave i', box);
    const dur = () => (Number.isFinite(a.duration) && a.duration > 0 ? a.duration : Number(box.dataset.dur) || 1);
    a.ontimeupdate = () => {
      const p = a.currentTime / dur();
      bars.forEach((b, i) => b.classList.toggle('on', i / bars.length <= p));
      $('.au-time', box).textContent = fmtDur(a.currentTime);
    };
    a.onplay = () => { btn.innerHTML = icons.pause; box.classList.add('playing'); };
    a.onpause = () => { btn.innerHTML = icons.play; box.classList.remove('playing'); };
    a.onended = () => { stopAudio(); };
    a.play().catch(() => toast('Não foi possível tocar o áudio.'));
  }
  function stopAudio() {
    if (!playing) return;
    const { a, box } = playing;
    a.pause();
    $$('.au-wave i', box).forEach((b) => b.classList.remove('on'));
    $('.au-time', box).textContent = fmtDur(Number(box.dataset.dur));
    $('.au-play', box).innerHTML = icons.play;
    box.classList.remove('playing');
    playing = null;
  }
  function cycleSpeed(box) {
    const next = { 1: 1.5, 1.5: 2, 2: 1 }[box.dataset.rate || 1];
    box.dataset.rate = next;
    $('.au-speed', box).textContent = `${next}×`;
    if (playing?.box === box) playing.a.playbackRate = next;
  }
  function seekAudio(box, e) {
    if (playing?.box !== box) toggleAudio(box);
    const r = $('.au-wave', box).getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const a = playing.a;
    const go = () => { a.currentTime = p * (Number.isFinite(a.duration) ? a.duration : Number(box.dataset.dur) || 0); };
    if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
  }
  function playVnote(btn) {
    const v = $('video', btn);
    if (!v.paused) { v.pause(); return; }
    $$('.ch-vnote video', root).forEach((x) => { if (x !== v) x.pause(); });
    v.muted = false; v.currentTime = 0;
    v.play().catch(() => {});
    btn.classList.add('playing');
    v.onpause = v.onended = () => btn.classList.remove('playing');
  }

  // ------------------------------------------------------------------ visualizador (foto / visualização única)
  function showViewer({ url, type, once = false, onClose }) {
    viewer.innerHTML = `<div class="cv-bar">${once ? `<span class="cv-once">${icons.once} Visualização única</span>` : '<span></span>'}<span>${!once ? `<a class="icon-btn" href="${esc(url)}" download target="_blank" rel="noopener" title="Baixar">${icons.download}</a>` : ''}<button class="icon-btn" data-close title="Fechar">${icons.close}</button></span></div>
      <div class="cv-body">${type.startsWith('video') ? `<video src="${esc(url)}" autoplay controls playsinline ${once ? 'controlslist="nodownload" disablepictureinpicture' : ''}></video>` : `<img src="${esc(url)}" alt="" />`}</div>`;
    viewer.classList.toggle('once', once);
    viewer.hidden = false;
    const close = () => { viewer.hidden = true; viewer.innerHTML = ''; onClose?.(); removeEventListener('keydown', key); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', key);
    viewer.onclick = (e) => { if (e.target.closest('[data-close]') || e.target.classList.contains('cv-body')) close(); };
    if (once) viewer.oncontextmenu = (e) => e.preventDefault();
  }

  async function openOnce(mid) {
    try {
      const { file } = await api('chat_open_once', { cid: st.open, mid });
      const m = st.msgs.find((x) => x.id === mid);
      if (m) { m.openedByMe = true; renderMsgs(); }
      const cid = st.open;
      showViewer({ url: file.url, type: file.type || 'image', once: true, onClose: () => api('chat_once_done', { cid, mid }).catch(() => {}) });
    } catch (e) { toast(e.message); }
  }

  // ------------------------------------------------------------------ envio
  const input = $('#chInput', root);
  function syncComposer() {
    const has = input.value.trim().length > 0;
    $('#chSend', root).hidden = !has;
    $('#chMic', root).hidden = has;
    input.style.height = 'auto';
    input.style.height = `${Math.min(140, input.scrollHeight)}px`;
  }
  input.addEventListener('input', syncComposer);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer: fine)').matches) { e.preventDefault(); sendText(); }
  });
  $('#chSend', root).onclick = sendText;

  function pushLocal(m) {
    st.msgs.push(m);
    renderMsgs(true);
    return m;
  }

  async function send(payload, local) {
    const cid = st.open;
    try {
      const j = await api('chat_send', { cid, ...payload });
      st.channels.set(j.channel.id, j.channel);
      st.reads[cid] = j.channel.n;
      st.known.set(cid, j.message.id);
      if (st.open === cid) {
        const i = local ? st.msgs.indexOf(local) : -1;
        if (i >= 0) st.msgs[i] = j.message; else st.msgs.push(j.message);
        renderMsgs(true);
      }
      renderList();
      broadcast?.({ t: 'chat', cid });
      scheduleSync?.(200);
    } catch (e) {
      toast(e.message);
      if (local) { st.msgs = st.msgs.filter((x) => x !== local); renderMsgs(); }
    }
  }

  function sendText() {
    const text = input.value.trim();
    if (!text || !st.open) return;
    input.value = '';
    syncComposer();
    const local = pushLocal({ id: `l${Date.now()}`, local: true, from: me().id, ts: Date.now(), kind: 'text', text });
    send({ kind: 'text', text }, local);
  }

  // upload (Vercel Blob direto do navegador; ou /api/upload no servidor local)
  let blobMod = null;
  async function upload(file, onProgress) {
    const t = await api('upload_ticket', { name: file.name, size: file.size, type: file.type });
    if (t.mode === 'supabase') {
      await new Promise((resolve, reject) => {
        const x = new XMLHttpRequest();
        x.open('PUT', t.uploadUrl);
        x.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        x.setRequestHeader('x-upsert', 'false');
        x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
        x.onload = () => (x.status < 300 ? resolve() : reject(new Error(x.status === 413 ? 'Arquivo grande demais.' : 'Falha no envio.')));
        x.onerror = () => reject(new Error('Falha no envio.'));
        x.send(file);
      });
      return t.url;
    }
    if (t.mode === 'blob') {
      blobMod ||= await import('@vercel/blob/client');
      const r = await blobMod.put(t.pathname, file, { access: 'public', token: t.token, contentType: file.type || undefined, multipart: file.size > 8e6, onUploadProgress: (p) => onProgress?.(p.percentage / 100) });
      return r.url;
    }
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', `/api/upload?name=${encodeURIComponent(file.name)}&type=${encodeURIComponent(file.type || '')}`);
      x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      x.onload = () => { try { const j = JSON.parse(x.responseText); if (j.ok) resolve(j.url); else reject(new Error(j.error)); } catch { reject(new Error('Falha no envio.')); } };
      x.onerror = () => reject(new Error('Falha no envio.'));
      x.send(file);
    });
  }

  // fotos grandes: reduz para no máximo 2048 px (bem mais rápido de enviar e abrir)
  async function shrinkImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5e6) return file;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
      return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file;
    } catch { return file; }
  }

  function mediaInfo(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const done = (v) => { URL.revokeObjectURL(url); resolve(v); };
      if (file.type.startsWith('image/')) {
        const im = new Image(); im.onload = () => done({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => done({}); im.src = url;
      } else if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
        const v = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio');
        v.preload = 'metadata'; v.onloadedmetadata = () => done({ w: v.videoWidth, h: v.videoHeight, dur: Number.isFinite(v.duration) ? v.duration : 0 }); v.onerror = () => done({}); v.src = url;
      } else done({});
    });
  }

  async function sendFile(file, { once = false, kind: forced, extra = {} } = {}) {
    if (!st.open) return;
    if (file.type.startsWith('image/') && file.type !== 'image/gif') file = await shrinkImage(file);
    const kind = forced || (file.type === 'image/gif' ? 'image' : file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'file');
    const info = await mediaInfo(file);
    const preview = URL.createObjectURL(file);
    const local = pushLocal({ id: `l${Date.now()}${Math.random()}`, local: true, from: me().id, ts: Date.now(), kind: once ? 'text' : kind, text: once ? '📤 Enviando com visualização única…' : '', file: { url: preview, name: file.name, size: file.size, type: file.type, ...info, ...extra }, progress: 0 });
    try {
      const url = await upload(file, (p) => { local.progress = p; const el = $(`[data-mid="${local.id}"] .ch-meta`, root); if (el) el.textContent = `${Math.round(p * 100)}%`; });
      await send({ kind, once, file: { url, name: file.name, size: file.size, type: file.type, ...info, ...extra } }, local);
    } catch (e) {
      toast(e.message || 'Não foi possível enviar o arquivo.');
      st.msgs = st.msgs.filter((x) => x !== local); renderMsgs();
    } finally { setTimeout(() => URL.revokeObjectURL(preview), 60_000); }
  }

  // menu de anexos
  const menu = $('#chMenu', root);
  $('#chAttach', root).onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.ch-attach-wrap')) menu.hidden = true; });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    menu.hidden = true;
    const act = b.dataset.act;
    if (act === 'media') $('#chFileMedia', root).click();
    else if (act === 'camera') $('#chFileCam', root).click();
    else if (act === 'file') $('#chFileAny', root).click();
    else if (act === 'once') { toast('Escolha uma foto ou vídeo: a pessoa só vai poder abrir uma vez 👀'); $('#chFileOnce', root).click(); }
    else if (act === 'vnote') recordVideoNote();
    else if (act === 'gif') openGifs();
  });
  const takeFiles = (inputEl, opts) => inputEl.addEventListener('change', () => { const files = [...inputEl.files]; inputEl.value = ''; files.forEach((f) => sendFile(f, opts)); });
  takeFiles($('#chFileMedia', root));
  takeFiles($('#chFileAny', root));
  takeFiles($('#chFileCam', root));
  takeFiles($('#chFileOnce', root), { once: true });
  input.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); files.forEach((f) => sendFile(f)); }
  });
  // arrastar e soltar
  const thread = $('#chThread', root);
  let dragN = 0;
  thread.addEventListener('dragenter', (e) => { if (st.open && e.dataTransfer?.types?.includes('Files')) { dragN++; $('#chDrop', root).hidden = false; } });
  thread.addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; $('#chDrop', root).hidden = true; } });
  thread.addEventListener('dragover', (e) => { if (st.open) e.preventDefault(); });
  thread.addEventListener('drop', (e) => { e.preventDefault(); dragN = 0; $('#chDrop', root).hidden = true; [...(e.dataTransfer?.files || [])].forEach((f) => sendFile(f)); });

  // ------------------------------------------------------------------ GIFs (GIPHY)
  const gifBox = $('#chGifs', root);
  let gifT = null;
  async function openGifs() {
    gifBox.hidden = false;
    $('#chGifQ', root).value = '';
    loadGifs('');
    if (matchMedia('(pointer: fine)').matches) $('#chGifQ', root).focus();
  }
  async function loadGifs(q) {
    const grid = $('#chGifGrid', root);
    grid.innerHTML = '<div class="ch-loading"><i></i></div>';
    try {
      const j = await api('gif_search', { q });
      if (j.disabled) {
        grid.innerHTML = `<div class="ch-gif-off"><p>A busca de GIFs precisa de uma chave grátis do GIPHY (variável <code>GIPHY_API_KEY</code> na Vercel).</p><button class="btn-ghost sm" id="chGifLocal">Enviar um GIF do aparelho</button></div>`;
        $('#chGifLocal', root).onclick = () => { gifBox.hidden = true; const i = $('#chFileMedia', root); i.accept = 'image/gif'; i.click(); setTimeout(() => { i.accept = 'image/*,video/*'; }, 1000); };
        return;
      }
      grid.innerHTML = j.gifs.map((g, i) => `<button data-gif="${i}" style="aspect-ratio:${g.w || 1}/${g.h || 1}"><img src="${esc(g.thumb)}" alt="${esc(g.title)}" loading="lazy" /></button>`).join('') || '<p class="ch-none">Nada encontrado 😅</p>';
      st.gifs = j.gifs;
    } catch (e) { grid.innerHTML = `<p class="ch-none">${esc(e.message)}</p>`; }
  }
  $('#chGifQ', root).addEventListener('input', (e) => { clearTimeout(gifT); gifT = setTimeout(() => loadGifs(e.target.value), 350); });
  $('#chGifClose', root).onclick = () => { gifBox.hidden = true; };
  $('#chGifBtn', root).onclick = openGifs;
  $('#chGifGrid', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-gif]');
    if (!b) return;
    const g = st.gifs[+b.dataset.gif];
    gifBox.hidden = true;
    const local = pushLocal({ id: `l${Date.now()}`, local: true, from: me().id, ts: Date.now(), kind: 'gif', text: '', file: { url: g.url, w: g.w, h: g.h, mp4: g.mp4 } });
    send({ kind: 'gif', gif: { url: g.url, w: g.w, h: g.h, mp4: g.mp4 } }, local);
  });

  // ------------------------------------------------------------------ recado de áudio (segure para gravar)
  const rec = { on: false };
  const mic = $('#chMic', root);
  async function startRec() {
    if (rec.on || !st.open) return;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { toast('Libere o microfone para gravar áudio 🎙️'); return; }
    const mime = pickMime(['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']);
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
    const chunks = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const an = ac.createAnalyser(); an.fftSize = 1024;
    ac.createMediaStreamSource(stream).connect(an);
    Object.assign(rec, { on: true, stream, mr, chunks, ac, an, t0: performance.now(), levels: [], locked: false, cancel: false });
    mr.start(250);
    root.classList.add('recording');
    $('#chRec', root).hidden = false;
    $('#chRecSend', root).hidden = true;
    $('#chRecHint', root).hidden = false;
    const buf = new Float32Array(an.fftSize);
    const cv = $('#chRecWave', root); const g = cv.getContext('2d');
    rec.timer = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      let s = 0; for (const v of buf) s += v * v;
      rec.levels.push(Math.min(1, Math.sqrt(s / buf.length) * 6));
      const secs = (performance.now() - rec.t0) / 1000;
      $('#chRecTime', root).textContent = fmtDur(secs);
      g.clearRect(0, 0, cv.width, cv.height);
      g.fillStyle = '#5aa8ff';
      const tail = rec.levels.slice(-60);
      tail.forEach((v, i) => { const h = 4 + v * 30; g.fillRect(i * 5, (36 - h) / 2, 3, h); });
      if (secs > 300) stopRec(true);
    }, 100);
  }
  async function stopRec(sendIt) {
    if (!rec.on) return;
    rec.on = false;
    clearInterval(rec.timer);
    const dur = (performance.now() - rec.t0) / 1000;
    const done = new Promise((r) => { rec.mr.onstop = r; });
    try { rec.mr.stop(); } catch { /* */ }
    await done;
    rec.stream.getTracks().forEach((t) => t.stop());
    rec.ac.close().catch(() => {});
    root.classList.remove('recording');
    $('#chRec', root).hidden = true;
    if (!sendIt || dur < 0.6) { if (sendIt) toast('Segure o botão para gravar 🎙️'); return; }
    const type = rec.mr.mimeType || 'audio/webm';
    const blob = new Blob(rec.chunks, { type });
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
    const lv = rec.levels;
    const wave = Array.from({ length: 40 }, (_, i) => { const a = Math.floor((i / 40) * lv.length), b = Math.max(a + 1, Math.floor(((i + 1) / 40) * lv.length)); return Math.round(Math.max(...lv.slice(a, b), 0) * 100) / 100; });
    sendFile(new File([blob], `audio-${Date.now()}.${ext}`, { type }), { kind: 'audio', extra: { dur: Math.round(dur * 10) / 10, wave } });
  }
  // segurar o botão: soltar envia · deslizar para a esquerda cancela · deslizar para cima trava
  let press = null;
  mic.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    press = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    mic.setPointerCapture(e.pointerId);
    startRec();
  });
  mic.addEventListener('pointermove', (e) => {
    if (!press || !rec.on || rec.locked) return;
    const dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (dx < -90) { press = null; stopRec(false); toast('Áudio descartado'); }
    else if (dy < -70) { rec.locked = true; $('#chRecSend', root).hidden = false; $('#chRecHint', root).hidden = true; }
  });
  const release = () => {
    if (!press) return;
    const quick = performance.now() - press.t < 350;
    press = null;
    if (rec.locked) return;
    if (quick) { stopRec(false); toast('Segure o botão para gravar 🎙️ (ou deslize para cima para travar)'); return; }
    stopRec(true);
  };
  mic.addEventListener('pointerup', release);
  mic.addEventListener('pointercancel', release);
  $('#chRecSend', root).onclick = () => stopRec(true);
  $('#chRecCancel', root).onclick = () => stopRec(false);

  // ------------------------------------------------------------------ recado de vídeo (bolinha)
  async function recordVideoNote() {
    if (!st.open) return;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' }, audio: { echoCancellation: true } }); }
    catch { toast('Libere a câmera e o microfone para gravar o recado 📹'); return; }
    const mime = pickMime(['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4', 'video/webm']);
    modal.innerHTML = `<div class="modal-card glass vn-card">
      <div class="modal-head"><div><span class="eyebrow">Recado de vídeo</span><h3>Grave até 1 minuto</h3></div><button class="icon-btn" data-x>${icons.close}</button></div>
      <div class="vn-stage"><video class="vn-live" autoplay playsinline muted></video><svg class="vn-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48"/></svg><span class="vn-time">0:00</span></div>
      <div class="vn-actions"><button class="btn-ghost" data-x>Cancelar</button><button class="vn-rec" data-rec title="Gravar"><i></i></button><button class="btn-primary" data-send disabled>Enviar ${icons.send}</button></div>
    </div>`;
    modal.hidden = false;
    const live = $('.vn-live', modal);
    live.srcObject = stream;
    let mr = null, chunks = [], t0 = 0, timer = null, blob = null;
    const ring = $('.vn-ring circle', modal);
    const stopAll = () => { clearInterval(timer); try { if (mr?.state === 'recording') mr.stop(); } catch { /* */ } stream.getTracks().forEach((t) => t.stop()); modal.hidden = true; modal.innerHTML = ''; };
    $$('[data-x]', modal).forEach((b) => { b.onclick = stopAll; });
    const recBtn = $('[data-rec]', modal);
    recBtn.onclick = () => {
      if (mr?.state === 'recording') { mr.stop(); return; }
      if (blob) { // regravar
        blob = null; live.srcObject = stream; live.muted = true; live.loop = false; live.play(); $('[data-send]', modal).disabled = true;
      }
      chunks = [];
      mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 900_000 } : undefined);
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => {
        clearInterval(timer);
        recBtn.classList.remove('on');
        blob = new Blob(chunks, { type: mr.mimeType || 'video/webm' });
        live.srcObject = null; live.src = URL.createObjectURL(blob); live.muted = false; live.loop = true; live.play().catch(() => {});
        $('[data-send]', modal).disabled = false;
      };
      mr.start(250);
      t0 = performance.now();
      recBtn.classList.add('on');
      timer = setInterval(() => {
        const s = (performance.now() - t0) / 1000;
        $('.vn-time', modal).textContent = fmtDur(s);
        ring.style.strokeDashoffset = String(302 * (1 - Math.min(1, s / 60)));
        if (s >= 60) mr.stop();
      }, 100);
    };
    $('[data-send]', modal).onclick = () => {
      if (!blob) return;
      const dur = (performance.now() - t0) / 1000;
      const type = blob.type;
      const f = new File([blob], `recado-${Date.now()}.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type });
      stopAll();
      sendFile(f, { kind: 'vnote', extra: { dur: Math.min(60, Math.round(dur)), w: 480, h: 480 } });
    };
  }

  // ------------------------------------------------------------------ canais
  function memberPicker(selected = new Set(), exclude = new Set()) {
    const users = [...S.users.values()].filter((u) => u.id !== me().id && !exclude.has(u.id)).sort((a, b) => a.name.localeCompare(b.name));
    return `<div class="invite-list ch-pick">${users.map((u) => `<label class="invite">${avatarChip(u)}<span><strong>${esc(u.name)}</strong><small>${esc(u.email || '')}</small></span><input type="checkbox" value="${u.id}" ${selected.has(u.id) ? 'checked' : ''} /></label>`).join('') || '<p class="ch-none">Ainda não tem mais ninguém cadastrado.</p>'}</div>`;
  }

  function newChannel() {
    modal.innerHTML = `<div class="modal-card glass">
      <div class="modal-head"><div><span class="eyebrow">Novo canal</span><h3>Criar canal</h3></div><button class="icon-btn" data-x>${icons.close}</button></div>
      <label class="field">Nome do canal<div class="ch-name-in"><span>#</span><input id="chNewName" placeholder="ex.: comercial" maxlength="32" /></div></label>
      <span class="eyebrow">Quem participa</span>
      ${memberPicker()}
      <button class="btn-primary" id="chCreate">Criar canal</button>
    </div>`;
    modal.hidden = false;
    $('#chNewName', modal).focus();
    $('[data-x]', modal).onclick = () => { modal.hidden = true; };
    $('#chCreate', modal).onclick = async () => {
      const members = $$('.ch-pick input:checked', modal).map((i) => i.value);
      try {
        const { channel } = await api('chat_create', { name: $('#chNewName', modal).value, members });
        modal.hidden = true;
        st.channels.set(channel.id, channel);
        open();
        openThread(channel.id);
        broadcast?.({ t: 'chat', cid: channel.id });
        toast(`Canal #${channel.name} criado ✨`);
      } catch (e) { toast(e.message); }
    };
  }
  $('#chNew', root).onclick = newChannel;
  $('#chEmptyNew', root).onclick = newChannel;

  function channelInfo() {
    const c = st.channels.get(st.open);
    if (!c) return;
    const isOwner = c.created_by === me().id;
    modal.innerHTML = `<div class="modal-card glass">
      <div class="modal-head"><div><span class="eyebrow">Canal</span><h3>#${esc(c.name)}</h3></div><button class="icon-btn" data-x>${icons.close}</button></div>
      ${isOwner ? `<label class="field">Nome<div class="ch-name-in"><span>#</span><input id="chRename" value="${esc(c.name)}" maxlength="32" /></div></label>` : ''}
      <span class="eyebrow">Pessoas (${c.members.length})</span>
      <div class="invite-list">${c.members.map((id) => { const u = userOf(id); return `<div class="invite">${avatarChip(u || { id })}<span><strong>${esc(u?.name || 'Pessoa')}${id === c.created_by ? ' · criou' : ''}</strong><small>${isOnline(id) ? 'online' : 'offline'}</small></span>${isOwner && id !== me().id ? `<button class="mini-btn" data-rm="${id}" title="Remover">${icons.close}</button>` : ''}</div>`; }).join('')}</div>
      <span class="eyebrow">Adicionar pessoas</span>
      ${memberPicker(new Set(), new Set(c.members))}
      <div class="ch-modal-actions"><button class="btn-ghost" id="chLeave">Sair do canal</button><button class="btn-primary" id="chSave">Salvar</button></div>
    </div>`;
    modal.hidden = false;
    $('[data-x]', modal).onclick = () => { modal.hidden = true; };
    const remove = new Set();
    $$('[data-rm]', modal).forEach((b) => { b.onclick = () => { remove.add(b.dataset.rm); b.closest('.invite').style.opacity = 0.35; }; });
    $('#chSave', modal).onclick = async () => {
      try {
        const { channel } = await api('chat_update', { cid: c.id, add: $$('.ch-pick input:checked', modal).map((i) => i.value), remove: [...remove], name: $('#chRename', modal)?.value });
        st.channels.set(channel.id, channel);
        modal.hidden = true;
        renderHeader(); renderList(); fetchNew();
        broadcast?.({ t: 'chat', cid: c.id });
      } catch (e) { toast(e.message); }
    };
    $('#chLeave', modal).onclick = async () => {
      if (!confirm(`Sair de #${c.name}?`)) return;
      try { await api('chat_leave', { cid: c.id }); st.channels.delete(c.id); modal.hidden = true; closeThread(); } catch (e) { toast(e.message); }
    };
  }

  // ------------------------------------------------------------------ abrir / fechar o painel
  function open(cid) {
    st.visible = true;
    root.hidden = false;
    document.body.classList.add('chat-open');
    renderList();
    setupPush();
    if (cid) openThread(cid);
    else if (st.open) markRead();
    ctx.onVisible?.(true);
  }
  function close() {
    st.visible = false;
    root.hidden = true;
    document.body.classList.remove('chat-open');
    stopAudio();
    ctx.onVisible?.(false);
  }
  $('#chClose', root).onclick = close;

  // clique numa notificação do sistema (service worker)
  navigator.serviceWorker?.addEventListener('message', (e) => {
    if (e.data?.type === 'open-chat' && e.data.cid) { open(); openThread(e.data.cid); }
    if (e.data?.type === 'push' && S.me) scheduleSync?.(50);
  });

  return {
    applySync, open, close, openDM, openThread, setupPush, loadList,
    get sig() { return st.sig; },
    get visible() { return st.visible; },
    unread: totalUnread,
    reset() { st.channels.clear(); st.known.clear(); st.sig = null; st.first = true; closeThread(); close(); },
    refreshPeople() { if (st.visible) { renderList(); if (st.open) renderHeader(); } },
  };
}

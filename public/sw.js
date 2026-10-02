// Service worker do DIGI CONNECT: deixa o app instalável, abre rápido e recebe notificações push.
const CACHE = 'digi-v3';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/badge-72.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api')) return;
  // páginas: rede primeiro (sempre a versão nova), cache se estiver offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return r; }).catch(() => caches.match('/')));
    return;
  }
  // arquivos com hash e modelos 3D: cache primeiro
  if (/^\/(assets|mh|icons)\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok && r.status === 200) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return r;
    })));
  }
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'DIGI CONNECT', body: e.data?.text() }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const focused = wins.some((w) => w.visibilityState === 'visible' && w.focused);
    wins.forEach((w) => w.postMessage({ type: 'push', cid: d.cid }));
    try { if (self.navigator.setAppBadge) await self.navigator.setAppBadge(); } catch { /* */ }
    if (focused) return; // o app aberto mostra a notificação dentro dele
    await self.registration.showNotification(d.title || 'DIGI CONNECT', {
      body: d.body || 'Nova mensagem', tag: d.tag || d.cid || 'digi', renotify: true,
      icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', data: { cid: d.cid }, timestamp: d.ts || Date.now(),
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const cid = e.notification.data?.cid;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins[0];
    if (w) {
      await w.focus();
      if (cid) w.postMessage({ type: 'open-chat', cid });
      return;
    }
    await self.clients.openWindow(cid ? `/?chat=${encodeURIComponent(cid)}` : '/');
  })());
});

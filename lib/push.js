// Notificações push (Web Push / VAPID). As chaves vêm de VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY
// ou são geradas uma vez e guardadas no banco JSON (coleção config).
import webpush from 'web-push';
import { db } from './db.js';

let vapid = null;

export async function vapidKeys() {
  if (vapid) return vapid;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    let k = await db.get('config', 'vapid');
    if (!k) {
      const fresh = webpush.generateVAPIDKeys();
      await db.putIfAbsent('config', 'vapid', fresh);
      k = (await db.get('config', 'vapid')) || fresh;
    }
    vapid = k;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@digiconnect.app', vapid.publicKey, vapid.privateKey);
  return vapid;
}

export async function subscribe(userId, sub) {
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return false;
  const clean = { endpoint: sub.endpoint.slice(0, 600), keys: { p256dh: String(sub.keys.p256dh).slice(0, 200), auth: String(sub.keys.auth).slice(0, 100) } };
  const list = ((await db.get('push', userId)) || []).filter((s) => s.endpoint !== clean.endpoint);
  list.push(clean);
  await db.put('push', userId, list.slice(-6));
  return true;
}

export async function unsubscribe(userId, endpoint) {
  const list = ((await db.get('push', userId)) || []).filter((s) => s.endpoint !== endpoint);
  await db.put('push', userId, list);
}

// Envia para todos os aparelhos das pessoas; remove inscrições expiradas.
export async function sendPush(userIds, payload) {
  if (!userIds.length) return;
  await vapidKeys();
  const body = JSON.stringify(payload);
  await Promise.allSettled(userIds.map(async (uid) => {
    const list = (await db.get('push', uid)) || [];
    if (!list.length) return;
    const dead = [];
    await Promise.allSettled(list.map((s) => webpush.sendNotification(s, body, { TTL: 3600, urgency: 'high', timeout: 5000 }).catch((e) => {
      if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint);
    })));
    if (dead.length) await db.put('push', uid, list.filter((s) => !dead.includes(s.endpoint)));
  }));
}

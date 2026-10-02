// Senhas com scrypt + sessão em cookie assinado (HMAC) — funciona em serverless sem estado.
import crypto from 'node:crypto';

const SECRET = process.env.SESSION_SECRET
  || (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
    ? crypto.createHash('sha256').update('digi-session:' + (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)).digest('hex')
    : 'digi-connect-dev-secret-troque-em-producao');

const COOKIE = 'dc_session';
const MAX_AGE = 60 * 60 * 24 * 30;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [algo, salt, hash] = String(stored || '').split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export function makeSessionCookie(userId, secure) {
  const payload = b64(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000 }));
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSession(cookieHeader) {
  const match = String(cookieHeader || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!match) return null;
  const [payload, sig] = match.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.uid || data.exp < Date.now()) return null;
    return data.uid;
  } catch { return null; }
}

export const uid = () => crypto.randomBytes(8).toString('hex');

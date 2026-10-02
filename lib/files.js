// Arquivos do chat (fotos, vídeos, áudios, documentos).
// - Supabase Storage (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY): o navegador envia direto pro bucket
//   "digi-chat" com uma URL assinada gerada aqui (o bucket é criado sozinho).
// - Vercel Blob (BLOB_READ_WRITE_TOKEN): mesmo esquema, com token curto.
// - Sem nenhum dos dois: o arquivo vai para /api/upload e fica no disco (data/uploads, ou /tmp na Vercel).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { del } from '@vercel/blob';

const SB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'digi-chat';
const BLOB = process.env.BLOB_READ_WRITE_TOKEN || '';
export const FILE_MODE = SB_URL && SB_KEY ? 'supabase' : BLOB ? 'blob' : 'local';
export const MAX_FILE = FILE_MODE === 'blob' ? 200 * 1024 * 1024 : 50 * 1024 * 1024;

// ---------- Supabase Storage
const sbHeaders = (extra = {}) => ({ apikey: SB_KEY, ...(SB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SB_KEY}` } : {}), ...extra });
let bucketReady = null;
function ensureBucket() {
  bucketReady ||= fetch(`${SB_URL}/storage/v1/bucket`, {
    method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: MAX_FILE }),
  }).then(() => true).catch(() => { bucketReady = null; return false; });
  return bucketReady;
}
const sbPublic = (p) => `${SB_URL}/storage/v1/object/public/${BUCKET}/${p}`;
const DIR = path.join(process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/digi-connect-data' : path.join(process.cwd(), 'data')), 'uploads');

const safeName = (s) => String(s || 'arquivo').normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-80) || 'arquivo';

export async function uploadTicket(userId, { name, size }) {
  if (Number(size) > MAX_FILE) return { error: `Arquivo grande demais (máximo ${Math.round(MAX_FILE / 1024 / 1024)} MB).` };
  if (FILE_MODE === 'supabase') {
    await ensureBucket();
    const p = `chat/${userId}/${crypto.randomBytes(9).toString('base64url')}-${safeName(name)}`;
    const r = await fetch(`${SB_URL}/storage/v1/object/upload/sign/${BUCKET}/${p}`, { method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json' }), body: '{}' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) return { error: 'Não foi possível preparar o envio do arquivo.' };
    return { mode: 'supabase', uploadUrl: `${SB_URL}/storage/v1${j.url}`, url: sbPublic(p) };
  }
  if (!BLOB) return { mode: 'local', url: '/api/upload' };
  const pathname = `chat/${userId}/${crypto.randomBytes(9).toString('base64url')}-${safeName(name)}`;
  const token = await generateClientTokenFromReadWriteToken({
    token: BLOB, pathname, maximumSizeInBytes: MAX_FILE, validUntil: Date.now() + 15 * 60_000, addRandomSuffix: false, allowOverwrite: false,
  });
  return { mode: 'blob', token, pathname };
}

export function isOurFile(url) {
  return typeof url === 'string' && (/^\/api\/file\/[\w-]{10,40}$/.test(url)
    || /^https:\/\/[\w.-]+\.public\.blob\.vercel-storage\.com\/chat\//.test(url)
    || (!!SB_URL && url.startsWith(`${SB_URL}/storage/v1/object/public/${BUCKET}/chat/`)));
}

export async function deleteFile(url) {
  try {
    if (/^\/api\/file\//.test(url)) {
      const id = url.split('/').pop().replace(/[^\w-]/g, '');
      fs.rmSync(path.join(DIR, id), { force: true });
      fs.rmSync(path.join(DIR, `${id}.json`), { force: true });
    } else if (SB_URL && url.startsWith(sbPublic(''))) {
      await fetch(`${SB_URL}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: sbHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefixes: [decodeURIComponent(url.slice(sbPublic('').length))] }) });
    } else if (BLOB && isOurFile(url)) await del(url, { token: BLOB });
  } catch (e) { console.warn('deleteFile', e.message); }
}

// POST /api/upload (corpo = bytes do arquivo; nome/tipo na query string)
export async function localUpload(req, res, body) {
  const u = new URL(req.url, 'http://x');
  if (!body?.length) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Arquivo vazio.' })); }
  if (body.length > MAX_FILE) { res.statusCode = 413; return res.end(JSON.stringify({ ok: false, error: 'Arquivo grande demais.' })); }
  fs.mkdirSync(DIR, { recursive: true });
  const id = crypto.randomBytes(12).toString('base64url');
  fs.writeFileSync(path.join(DIR, id), body);
  const type = String(u.searchParams.get('type') || 'application/octet-stream').slice(0, 100);
  fs.writeFileSync(path.join(DIR, `${id}.json`), JSON.stringify({ type, name: safeName(u.searchParams.get('name')) }));
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, url: `/api/file/${id}` }));
}

// GET /api/file/<id> com suporte a Range (vídeo/áudio no Safari precisam disso)
export function serveFile(req, res) {
  const id = req.url.split('?')[0].split('/').pop().replace(/[^\w-]/g, '');
  const file = path.join(DIR, id);
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(`${file}.json`, 'utf8')); } catch { /* */ }
  if (!id || !fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
  const size = fs.statSync(file).size;
  res.setHeader('Content-Type', meta.type || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  if (meta.name && !/^(image|video|audio)\//.test(meta.type || '')) res.setHeader('Content-Disposition', `inline; filename="${meta.name}"`);
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', end - start + 1);
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.setHeader('Content-Length', size);
  fs.createReadStream(file).pipe(res);
}

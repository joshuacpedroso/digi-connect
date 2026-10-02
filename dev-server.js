// Servidor local: API em /api + front-end via Vite (dev) ou dist/ (produção).
// Uso: npm run dev   → http://localhost:5173
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handle } from './lib/actions.js';

const PORT = Number(process.env.PORT) || 5173;
const PROD = process.env.NODE_ENV === 'production';

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

let vite = null;
if (!PROD) {
  const { createServer } = await import('vite');
  vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };

http.createServer(async (req, res) => {
  if (req.url === '/api' || req.url.startsWith('/api?') || req.url.startsWith('/api/')) {
    req.body = await readBody(req);
    return handle(req, res);
  }
  if (vite) return vite.middlewares(req, res);
  const dist = path.resolve('dist');
  let file = path.join(dist, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`DIGI CONNECT rodando em http://localhost:${PORT}`));

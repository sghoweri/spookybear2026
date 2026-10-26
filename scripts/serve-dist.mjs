#!/usr/bin/env node
/**
 * Minimal static server for dist/ that mimics Vercel's `cleanUrls` behaviour
 * (/event/foo -> /event/foo.html, 404.html for misses). Used by the Playwright
 * config because `astro preview` in Astro 7 detaches into the background.
 *
 *   node scripts/serve-dist.mjs [port]
 */
import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const port = Number(process.argv[2] ?? process.env.PORT ?? 4322);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ics': 'text/calendar; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\/+$/, '') || '/';
  const candidates = clean === '/' ? ['index.html'] : [clean, `${clean}.html`, `${clean}/index.html`];
  for (const c of candidates) {
    const file = path.join(root, c);
    if (!file.startsWith(root)) continue;
    try {
      const s = await stat(file);
      if (s.isFile()) return { file, status: 200 };
    } catch {
      /* try next */
    }
  }
  return { file: path.join(root, '404.html'), status: 404 };
}

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url?.startsWith('/api/')) {
    res.writeHead(503, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'not configured' }));
  }
  const { file, status } = await resolveFile(req.url ?? '/');
  try {
    const body = await readFile(file);
    res.writeHead(status, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} at http://127.0.0.1:${port}`));

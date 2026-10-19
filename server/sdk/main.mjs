import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { SdkService, sdkHandler } from './service.mjs';
import { safeUrl, loadMcpProfiles } from './config.mjs';

const directory = resolve(process.env.SUPERGPT_SDK_DATA || '.supergpt-sdk');
const mcpProfiles = loadMcpProfiles();
const origins = (process.env.SUPERGPT_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
const service = new SdkService({ directory, mcpProfiles });
const publicOrigin = process.env.SUPERGPT_PUBLIC_ORIGIN ? safeUrl(process.env.SUPERGPT_PUBLIC_ORIGIN) : '';
const api = sdkHandler(service, { origins, remoteToken: process.env.SUPERGPT_SERVER_TOKEN || '', publicOrigin });
const root = resolve('dist');
const server = createServer((req, res) => {
  if (req.url?.startsWith('/__sdk/')) { void api(req, res); return; }
  const host = req.headers.host || '';
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(403).end(); return; }
  const path = resolve(root, '.' + new URL(req.url, 'http://' + host).pathname);
  if (!path.startsWith(root + sep) && path !== root) { res.writeHead(404).end(); return; }
  const file = existsSync(path) && statSync(path).isFile() ? path : resolve(root, 'index.html');
  if (!existsSync(file)) { res.writeHead(503).end('Run npm run build first.'); return; }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
  res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (extname(file) === '.ttf') res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
});
server.listen(Number(process.env.SUPERGPT_SDK_PORT || 1430), '127.0.0.1', () => console.log('SuperGPT SDK server: http://127.0.0.1:' + server.address().port));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { service.close(); server.close(); });

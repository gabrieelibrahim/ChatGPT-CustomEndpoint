// Dedicated Google OAuth service. Exposes no SDK, AI endpoint or filesystem routes.
import { createServer } from 'node:http';
import { googleOAuthBrokerFromEnvironment } from './oauthBroker.mjs';
const origins = (process.env.SUPERGPT_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
const google = googleOAuthBrokerFromEnvironment({ directory: process.env.SUPERGPT_GOOGLE_DATA, origins });
const server = createServer((req, res) => {
  if (!req.url?.startsWith('/__google/')) { res.writeHead(404).end(); return; }
  void google.handler(req, res);
});
server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.listen(Number(process.env.SUPERGPT_GOOGLE_PORT || 1431), '127.0.0.1', () => console.log('SuperGPT Google OAuth service listening on loopback.'));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { google.close(); server.close(); });

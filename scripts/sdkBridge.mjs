import { resolve } from 'node:path';
import { SdkService, sdkHandler } from '../server/sdk/service.mjs';
import { loadMcpProfiles } from '../server/sdk/config.mjs';
import { googleOAuthBrokerFromEnvironment } from '../server/google/oauthBroker.mjs';
export function sdkBridge() {
  return { name: 'supergpt-sdk', configureServer(server) {
    const service = new SdkService({ directory: resolve('.supergpt-sdk'), mcpProfiles: loadMcpProfiles() });
    const handler = sdkHandler(service);
    const google = googleOAuthBrokerFromEnvironment({ directory: resolve('.supergpt-sdk/google'), allowLoopback: true });
    server.middlewares.use((req, res, next) => { if (req.url?.startsWith('/__google/')) { void google.handler(req, res); return; } if (req.url?.startsWith('/fonts/')) res.setHeader('Access-Control-Allow-Origin', '*'); if (!req.url?.startsWith('/__sdk/')) return next(); void handler(req, res); });
    server.httpServer?.once('close', () => { google.close(); service.close(); });
  } };
}

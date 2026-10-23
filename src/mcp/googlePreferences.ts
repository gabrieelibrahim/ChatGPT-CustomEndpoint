import { googleOAuthServer } from './googleClient';
import { sdkServer } from '../chatkit/config';
const key = 'supergpt-google-broker-v1', secret = 'supergpt-google-broker-token';
export function loadGoogleBroker() {
  try { const value = JSON.parse(localStorage.getItem(key) || '{}'); const server = typeof value.server === 'string' && value.server.trim() ? value.server : googleOAuthServer(); if (server) sdkServer(server); return { server }; } catch { return { server: googleOAuthServer() }; }
}
export function googleBrokerToken(value?: string) {
  if (value !== undefined) {
    if (value.length > 4096 || /[\r\n]/.test(value)) throw Error('Token server Google tidak valid.');
    if (value) sessionStorage.setItem(secret, value); else sessionStorage.removeItem(secret);
  }
  return sessionStorage.getItem(secret) || '';
}
export function saveGoogleBroker(server: string, token: string) {
  if (server.trim()) sdkServer(server); googleBrokerToken(token); localStorage.setItem(key, JSON.stringify({ server: server.trim() }));
}

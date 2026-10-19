import { loadSdkConfig, sdkServer } from '../chatkit/config';
import { usesLocalProviderRelay } from '../lib/providerTransport';
export type MainAiSettings = { enabled: boolean; server: string; api: 'chat' | 'responses'; web: boolean; webSearch: 'exa' | 'provider'; mcp: boolean };
export const mainAiKey = 'supergpt-main-ai-v1';
export function loadMainAi(): MainAiSettings {
  let old; try { old = loadSdkConfig(); } catch { /* No old setup. */ }
  const defaults: MainAiSettings = { enabled: true, server: old?.server || '', api: old?.options.api || 'chat', web: true, webSearch: 'exa', mcp: true };
  try { const value = JSON.parse(localStorage.getItem(mainAiKey) || 'null'); if (value) { for (const key of ['enabled', 'web', 'mcp'] as const) if (typeof value[key] === 'boolean') defaults[key] = value[key]; if (typeof value.server === 'string') { sdkServer(value.server); defaults.server = value.server; } defaults.api = value.api === 'responses' ? 'responses' : 'chat'; defaults.webSearch = value.webSearch === 'provider' ? 'provider' : 'exa'; } } catch { /* Ignore invalid preferences. */ }
  return defaults;
}
export function saveMainAi(value: MainAiSettings) { sdkServer(value.server); localStorage.setItem(mainAiKey, JSON.stringify(value)); window.dispatchEvent(new Event('supergpt-ai-settings-changed')); }
export function mainAgentAvailable(settings = loadMainAi()) { return settings.enabled && (!!settings.server || usesLocalProviderRelay()); }
export function mainServerToken(value?: string) { if (value !== undefined) sessionStorage.setItem('supergpt-main-server-token', value); return sessionStorage.getItem('supergpt-main-server-token') || ''; }
export function mainMcpProfiles() {
  try { const data = JSON.parse(localStorage.getItem('client-local-features-v1') || '{}'); return Array.isArray(data.mcp) ? data.mcp.filter((item: any) => item?.enabled === true && item.kind === 'http' && typeof item.url === 'string' && typeof item.name === 'string').slice(0, 8).map((item: any) => ({ name: item.name, url: item.url })) : []; } catch { return []; }
}

import { normalizeBaseUrl, type EndpointProfile } from './endpointProfiles';
import { providerFetch } from './providerTransport';

// The real limits of the account behind an endpoint, when the provider publishes them. Sakelar answers
// GET /v1/account with the account's remaining tokens; other providers keep quota and billing to themselves.
export type AccountLimits = { balanceTokens: number; expiresAt: string | null; requests24h: number; billedTokens24h: number; stale: boolean };

export function publishesAccountLimits(profile: EndpointProfile | undefined) {
  if (!profile) return false;
  try { return new URL(normalizeBaseUrl(profile.baseUrl)).host === 'api.sakelar.web.id'; } catch { return false; }
}

const whole = (value: unknown) => { const n = typeof value === 'string' && /^\d{1,20}$/.test(value) ? Number(value) : typeof value === 'number' ? value : NaN; return Number.isFinite(n) && n >= 0 ? n : undefined; };

export async function fetchAccountLimits(profile: EndpointProfile, key: string, signal: AbortSignal): Promise<AccountLimits> {
  const response = await providerFetch(normalizeBaseUrl(profile.baseUrl) + '/account', key, signal);
  if (!response.ok) throw Error(response.status === 401 ? 'API key Sakelar tidak valid atau sudah dicabut.' : response.status === 404 ? 'Server belum mendukung data batasan akun.' : 'Data batasan akun belum dapat dimuat (HTTP ' + response.status + ').');
  const value = await response.json() as Record<string, unknown>;
  const balance = whole(value.balance_tokens);
  if (value.object !== 'account' || balance === undefined) throw Error('Format data akun tidak dikenali.');
  const expires = typeof value.expires_at === 'string' && Number.isFinite(Date.parse(value.expires_at)) ? value.expires_at : null;
  return { balanceTokens: balance, expiresAt: expires, requests24h: whole(value.requests_24h) ?? 0, billedTokens24h: whole(value.billed_tokens_24h) ?? 0, stale: value.stale === true };
}

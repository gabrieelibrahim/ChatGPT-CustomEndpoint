import { endpointSecretsKey } from './endpointProfiles';
import { clearLocalProfile } from './localProfile';
import { clearNativeEndpointKeys } from './mobileEndpointVault';
import { clearAllMcpOAuth } from '../mcp/oauth';
import { clearAllGoogleConnections } from '../mcp/googleAuth';
import { googleBrokerToken } from '../mcp/googlePreferences';

export function signOutMobileProfile() {
  // Leave local conversations and provider definitions available after onboarding.
  sessionStorage.removeItem(endpointSecretsKey);
  let googleIds: string[] = [];
  try { const profiles = JSON.parse(localStorage.getItem('client-local-features-v1') || '{}').mcp; googleIds = Array.isArray(profiles) ? profiles.filter(item => item?.auth === 'google' && typeof item.id === 'string').map(item => item.id) : []; } catch { /* No valid saved profiles. */ }
  googleBrokerToken('');
  const pluginClear = clearAllGoogleConnections(googleIds).finally(clearAllMcpOAuth).catch(() => {
    window.dispatchEvent(new CustomEvent('client-toast', { detail: 'Sesi plugin belum dapat dihapus dari penyimpanan aman. Coba keluar lagi.' }));
  });
  const endpointClear = clearNativeEndpointKeys().catch(() => {
    window.dispatchEvent(new CustomEvent('client-toast', { detail: 'API key sesi sudah dihapus, tetapi penghapusan penyimpanan aman gagal. Coba keluar lagi sebelum menutup aplikasi.' }));
  });
  clearLocalProfile();
  window.dispatchEvent(new Event('client-endpoints-changed'));
  return Promise.all([pluginClear, endpointClear]);
}

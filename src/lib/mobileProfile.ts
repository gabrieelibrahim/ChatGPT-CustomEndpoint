import { endpointSecretsKey } from './endpointProfiles';
import { clearLocalProfile } from './localProfile';

export function signOutMobileProfile() {
  // Leave local conversations and provider definitions available after onboarding.
  sessionStorage.removeItem(endpointSecretsKey);
  clearLocalProfile();
  window.dispatchEvent(new Event('client-endpoints-changed'));
}

// Google "Desktop app" OAuth client used for browser login in the APK. A desktop client is public: PKCE replaces
// the secret, so only the ID ships. Set VITE_GOOGLE_OAUTH_CLIENT_ID in .env.local before building the APK.
declare const __GOOGLE_OAUTH_CLIENT_ID__: string;
export const googleBrowserClientId = (): string => typeof __GOOGLE_OAUTH_CLIENT_ID__ === 'string' ? __GOOGLE_OAUTH_CLIENT_ID__.trim() : '';

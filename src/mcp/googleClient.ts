// Public broker origin only. Google client credentials stay on the broker.
declare const __GOOGLE_OAUTH_SERVER__: string;
export const googleOAuthServer = (): string => typeof __GOOGLE_OAUTH_SERVER__ === 'string' ? __GOOGLE_OAUTH_SERVER__.trim() : '';

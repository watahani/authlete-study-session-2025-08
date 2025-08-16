export interface OAuthConfig {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  revocationEndpoint: string;
  discoveryEndpoint: string;
  sessionSecret: string;
  httpsEnabled: boolean;
}

export const getOAuthConfig = (): OAuthConfig => {
  const httpsEnabled = process.env.HTTPS_ENABLED === 'true';
  const protocol = httpsEnabled ? 'https' : 'http';
  const port = httpsEnabled ? (process.env.HTTPS_PORT || '3443') : (process.env.HTTP_PORT || '3000');
  const baseUrl = `${protocol}://localhost:${port}`;

  return {
    issuer: baseUrl,
    authorizationEndpoint: `${baseUrl}/oauth/authorize`,
    tokenEndpoint: `${baseUrl}/oauth/token`,
    userinfoEndpoint: `${baseUrl}/oauth/userinfo`,
    revocationEndpoint: `${baseUrl}/oauth/revoke`,
    discoveryEndpoint: `${baseUrl}/.well-known/oauth-authorization-server`,
    sessionSecret: process.env.SESSION_SECRET || 'default-oauth-secret',
    httpsEnabled
  };
};
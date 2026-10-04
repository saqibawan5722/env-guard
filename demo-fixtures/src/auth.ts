export interface AuthConfig {
  provider: string;
  cookieSecret: string;
}

export function getAuthConfig(): AuthConfig {
  return {
    provider: process.env.AUTH_PROVIDER || 'github',
    cookieSecret: process.env['SESSION_COOKIE_SECRET'] || 'dev-secret'
  };
}

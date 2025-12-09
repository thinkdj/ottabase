import {
  IconBrandGithub,
  IconBrandGoogle,
  IconBrandDiscord,
  IconBrandAzure,
  IconLock,
  IconMailShare
} from '@tabler/icons-react';

export interface AuthProvider {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
  buttonText: string;
  colorPrimary: string;
  iconTabler: React.ReactNode;
}

export type ProviderType = 'credentials' | 'email' | 'github' | 'google' | 'discord' | 'azure-ad' | 'auth0';

/**
 * Get enabled auth providers based on environment variables
 *
 * This function checks for the presence of OAuth client credentials
 * to determine which providers should be enabled.
 */
export function getAuthProviders(env?: any): Record<string, AuthProvider> {
  const processEnv = env || (typeof process !== 'undefined' ? process.env : {});

  return {
    google: {
      id: 'google',
      name: 'Google',
      enabled: !!(processEnv.GOOGLE_CLIENT_ID && processEnv.GOOGLE_CLIENT_SECRET),
      description: 'Sign in with your Google account',
      buttonText: 'Continue with Google',
      colorPrimary: '#4285F4',
      iconTabler: <IconBrandGoogle className="h-5 w-5" />,
    },
    github: {
      id: 'github',
      name: 'GitHub',
      enabled: !!(processEnv.GITHUB_CLIENT_ID && processEnv.GITHUB_CLIENT_SECRET),
      description: 'Sign in with your GitHub account',
      buttonText: 'Continue with GitHub',
      colorPrimary: '#24292e',
      iconTabler: <IconBrandGithub className="h-5 w-5" />,
    },
    discord: {
      id: 'discord',
      name: 'Discord',
      enabled: !!(processEnv.DISCORD_CLIENT_ID && processEnv.DISCORD_CLIENT_SECRET),
      description: 'Sign in with your Discord account',
      buttonText: 'Continue with Discord',
      colorPrimary: '#5865F2',
      iconTabler: <IconBrandDiscord className="h-5 w-5" />,
    },
    'azure-ad': {
      id: 'azure-ad',
      name: 'Microsoft',
      enabled: !!(processEnv.AZURE_AD_CLIENT_ID && processEnv.AZURE_AD_CLIENT_SECRET && processEnv.AZURE_AD_TENANT_ID),
      description: 'Sign in with your Microsoft account',
      buttonText: 'Continue with Microsoft',
      colorPrimary: '#0078D4',
      iconTabler: <IconBrandAzure className="h-5 w-5" />,
    },
    email: {
      id: 'email',
      name: 'Email Magic Link',
      enabled: !!processEnv.EMAIL_SERVER,
      description: 'Sign in with your email address',
      buttonText: 'Send Magic Link via Email',
      colorPrimary: '#6366f1',
      iconTabler: <IconMailShare className="h-5 w-5" />,
    },
    credentials: {
      id: 'credentials',
      name: 'Credentials',
      enabled: processEnv.AUTH_LOGIN_CREDENTIALS === 'true',
      description: 'Sign in with your username and password',
      buttonText: 'Sign in with credentials',
      colorPrimary: '#6366f1',
      iconTabler: <IconLock className="h-5 w-5" />,
    },
  };
}

/**
 * Get only enabled providers
 */
export function getEnabledProviders(env?: any): Record<string, AuthProvider> {
  const allProviders = getAuthProviders(env);
  return Object.fromEntries(
    Object.entries(allProviders).filter(([_, provider]) => provider.enabled)
  );
}

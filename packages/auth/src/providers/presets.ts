// ============================================================
// @ottabase/auth - OAuth Provider Presets
// ============================================================
//
// Each factory returns endpoint + claim-mapping data for the generic
// OAuth client in `oauth-client.ts`. No provider-specific control flow
// lives here beyond claim mapping.
//
// ============================================================

import type { OAuthProfile, OAuthProviderConfig, ProviderEnv, ProviderOptions } from './types';

function scopeList(defaults: string[], extra?: string[]): string {
    return Array.from(new Set([...defaults, ...(extra ?? [])])).join(' ');
}

export function createGoogleProvider(env: ProviderEnv, options: ProviderOptions = {}): OAuthProviderConfig {
    return {
        id: 'google',
        name: 'Google',
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        authorizationParams: { access_type: 'offline', prompt: 'consent' },
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
        scope: scopeList(['openid', 'email', 'profile'], options.scopes),
        mapProfile: (profile): OAuthProfile => ({
            providerAccountId: String(profile.sub),
            email: profile.email ?? null,
            name: profile.name ?? null,
            image: profile.picture ?? null,
            emailVerified: profile.email_verified === true || profile.email_verified === 'true',
        }),
    };
}

export function createGitHubProvider(env: ProviderEnv, options: ProviderOptions = {}): OAuthProviderConfig {
    const extraHeaders = { 'User-Agent': 'ottabase-auth' };

    return {
        id: 'github',
        name: 'GitHub',
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scope: scopeList(['read:user', 'user:email'], options.scopes),
        extraHeaders,
        // GitHub's /user endpoint omits private emails, so a second call to /user/emails
        // is required to find the primary, verified address.
        async getProfile(tokens, provider): Promise<OAuthProfile> {
            const authHeader = { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json', ...provider.extraHeaders };

            const userResponse = await fetch('https://api.github.com/user', { headers: authHeader });
            if (!userResponse.ok) {
                throw new Error(`GitHub profile request failed (HTTP ${userResponse.status})`);
            }
            const user = (await userResponse.json()) as Record<string, unknown>;

            let email = (user.email as string | null) ?? null;
            let emailVerified = false;

            const emailsResponse = await fetch('https://api.github.com/user/emails', { headers: authHeader });
            if (emailsResponse.ok) {
                const emails = (await emailsResponse.json()) as Array<{
                    email: string;
                    primary: boolean;
                    verified: boolean;
                }>;
                const primary = emails.find((e) => e.primary) ?? emails.find((e) => e.verified) ?? emails[0];
                if (primary) {
                    email = primary.email;
                    emailVerified = primary.verified;
                }
            }

            return {
                providerAccountId: String(user.id),
                email,
                name: (user.name as string | null) ?? (user.login as string | null) ?? null,
                image: (user.avatar_url as string | null) ?? null,
                emailVerified,
            };
        },
    };
}

export function createDiscordProvider(env: ProviderEnv, options: ProviderOptions = {}): OAuthProviderConfig {
    return {
        id: 'discord',
        name: 'Discord',
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        authorizationUrl: 'https://discord.com/api/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        userInfoUrl: 'https://discord.com/api/users/@me',
        scope: scopeList(['identify', 'email'], options.scopes),
        mapProfile: (profile): OAuthProfile => ({
            providerAccountId: String(profile.id),
            email: profile.email ?? null,
            name: profile.username ?? null,
            image: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null,
            emailVerified: profile.verified === true,
        }),
    };
}

export function createAzureAdProvider(env: ProviderEnv, options: ProviderOptions = {}): OAuthProviderConfig {
    const tenantId = env.AZURE_AD_TENANT_ID || 'common';

    return {
        id: 'azure-ad',
        name: 'Microsoft',
        clientId: env.AZURE_AD_CLIENT_ID,
        clientSecret: env.AZURE_AD_CLIENT_SECRET,
        authorizationUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
        scope: scopeList(['openid', 'profile', 'email'], options.scopes),
        mapProfile: (profile): OAuthProfile => ({
            providerAccountId: String(profile.sub),
            email: profile.email ?? null,
            name: profile.name ?? null,
            image: null,
            emailVerified: !!profile.email,
        }),
    };
}

export function createAuth0Provider(env: ProviderEnv, options: ProviderOptions = {}): OAuthProviderConfig {
    const issuer = (env.AUTH0_ISSUER || '').replace(/\/+$/, '');

    return {
        id: 'auth0',
        name: 'Auth0',
        clientId: env.AUTH0_CLIENT_ID,
        clientSecret: env.AUTH0_CLIENT_SECRET,
        authorizationUrl: `${issuer}/authorize`,
        tokenUrl: `${issuer}/oauth/token`,
        userInfoUrl: `${issuer}/userinfo`,
        scope: scopeList(['openid', 'profile', 'email'], options.scopes),
        mapProfile: (profile): OAuthProfile => ({
            providerAccountId: String(profile.sub),
            email: profile.email ?? null,
            name: profile.name ?? null,
            image: profile.picture ?? null,
            emailVerified: profile.email_verified === true,
        }),
    };
}

const PROVIDER_FACTORIES: Record<string, (env: ProviderEnv, options?: ProviderOptions) => OAuthProviderConfig> = {
    google: createGoogleProvider,
    github: createGitHubProvider,
    discord: createDiscordProvider,
    'azure-ad': createAzureAdProvider,
    auth0: createAuth0Provider,
};

/** Whether a preset has the required env vars configured. */
function isProviderConfigured(id: string, env: ProviderEnv): boolean {
    switch (id) {
        case 'google':
            return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
        case 'github':
            return !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
        case 'discord':
            return !!(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);
        case 'azure-ad':
            return !!(env.AZURE_AD_CLIENT_ID && env.AZURE_AD_CLIENT_SECRET && env.AZURE_AD_TENANT_ID);
        case 'auth0':
            return !!(env.AUTH0_CLIENT_ID && env.AUTH0_CLIENT_SECRET && env.AUTH0_ISSUER);
        default:
            return false;
    }
}

/** Build the list of OAuth providers that have credentials configured in `env`. */
export function autoConfigureProviders(env: ProviderEnv): OAuthProviderConfig[] {
    return Object.keys(PROVIDER_FACTORIES)
        .filter((id) => isProviderConfigured(id, env))
        .map((id) => PROVIDER_FACTORIES[id](env));
}

/** Look up a single configured provider by id, or `null` if unknown/unconfigured. */
export function getConfiguredProvider(id: string, env: ProviderEnv): OAuthProviderConfig | null {
    if (!isProviderConfigured(id, env)) return null;
    const factory = PROVIDER_FACTORIES[id];
    return factory ? factory(env) : null;
}

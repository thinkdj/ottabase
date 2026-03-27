import type { ProviderEnv } from '../providers';
import type { SocialProvider } from './SocialLoginButtons';

function isDevEmailTrapConfiguredForClient(env: ProviderEnv): boolean {
    const raw = env.DEV_EMAIL_TRAP_ENABLED;

    if (typeof raw !== 'string') {
        return false;
    }

    const value = raw.trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(value) && !!env.OBCF_KV;
}

/**
 * Provider display configuration
 */
const PROVIDER_CONFIG: Record<string, { name: string; order: number }> = {
    google: { name: 'Google', order: 1 },
    github: { name: 'GitHub', order: 2 },
    discord: { name: 'Discord', order: 3 },
    'azure-ad': { name: 'Microsoft', order: 4 },
    auth0: { name: 'Auth0', order: 5 },
};

/**
 * Auto-detect configured social providers from environment variables
 *
 * @param env - Environment variables
 * @returns Array of social providers that are configured
 *
 * @example
 * ```typescript
 * import { getConfiguredSocialProviders } from "@ottabase/auth/components";
 *
 * const providers = getConfiguredSocialProviders(process.env);
 * // Returns providers that have credentials configured
 * ```
 */
export function getConfiguredSocialProviders(env: ProviderEnv): SocialProvider[] {
    const providers: SocialProvider[] = [];

    // Google
    if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
        providers.push({
            id: 'google',
            name: PROVIDER_CONFIG.google.name,
        });
    }

    // GitHub
    if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
        providers.push({
            id: 'github',
            name: PROVIDER_CONFIG.github.name,
        });
    }

    // Discord
    if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) {
        providers.push({
            id: 'discord',
            name: PROVIDER_CONFIG.discord.name,
        });
    }

    // Azure AD
    if (env.AZURE_AD_CLIENT_ID && env.AZURE_AD_CLIENT_SECRET && env.AZURE_AD_TENANT_ID) {
        providers.push({
            id: 'azure-ad',
            name: PROVIDER_CONFIG['azure-ad'].name,
        });
    }

    // Auth0
    if (env.AUTH0_CLIENT_ID && env.AUTH0_CLIENT_SECRET && env.AUTH0_ISSUER) {
        providers.push({
            id: 'auth0',
            name: PROVIDER_CONFIG.auth0.name,
        });
    }

    // Sort by configured order
    return providers.sort((a, b) => {
        const orderA = PROVIDER_CONFIG[a.id]?.order ?? 999;
        const orderB = PROVIDER_CONFIG[b.id]?.order ?? 999;
        return orderA - orderB;
    });
}

/**
 * Check if credentials provider is configured
 * Always returns true since credentials don't require env vars,
 * but validation logic should be provided by the app
 *
 * @returns true
 */
export function isCredentialsConfigured(env?: ProviderEnv): boolean {
    const raw = (env as any)?.AUTH_DISABLE_CREDENTIALS;
    if (typeof raw === 'string') {
        const value = raw.toLowerCase();
        if (value === 'true' || value === '1' || value === 'yes') {
            return false;
        }
    }
    if (raw === true) {
        return false;
    }
    return true; // Credentials don't require env vars unless explicitly disabled
}

/**
 * Check if email (magic link) provider is configured
 *
 * @param env - Environment variables
 * @returns true if either Resend or Nodemailer is configured
 *
 * @example
 * ```typescript
 * import { isEmailProviderConfigured } from "@ottabase/auth/components";
 *
 * const showMagicLink = isEmailProviderConfigured(process.env);
 * ```
 */
export function isEmailProviderConfigured(env: ProviderEnv): boolean {
    if (isDevEmailTrapConfiguredForClient(env)) {
        return true;
    }

    // Check for Resend
    if (env.EMAIL_RESEND_API_KEY) {
        return true;
    }

    // Check for Nodemailer/SMTP
    if (env.EMAIL_SERVER && env.EMAIL_FROM) {
        return true;
    }

    return false;
}

/**
 * Get login configuration based on environment variables
 *
 * @param env - Environment variables
 * @returns Configuration object for login components
 *
 * @example
 * ```typescript
 * import { getLoginConfig } from "@ottabase/auth/components";
 *
 * const config = getLoginConfig(process.env);
 *
 * <LoginForm
 *   socialProviders={config.socialProviders}
 *   showCredentials={config.showCredentials}
 *   showMagicLink={config.showMagicLink}
 *   // ... other props
 * />
 * ```
 */
export function getLoginConfig(env: ProviderEnv) {
    return {
        socialProviders: getConfiguredSocialProviders(env),
        showCredentials: isCredentialsConfigured(env),
        showMagicLink: isEmailProviderConfigured(env),
        hasSocialProviders: getConfiguredSocialProviders(env).length > 0,
        hasEmailProvider: isEmailProviderConfigured(env),
    };
}

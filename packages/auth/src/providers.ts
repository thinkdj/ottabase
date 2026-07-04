// ============================================================
// @ottabase/auth - Providers (public entry point)
// ============================================================
//
// OAuth provider presets (Google, GitHub, Discord, Azure AD, Auth0) and
// magic-link (email) provider auto-configuration.
//
// ============================================================

import { createKvEmailTrapStore } from '@ottabase/email/providers/dev-trap';
import {
    createDevEmailTrapMagicLinkSender,
    createNodemailerMagicLinkSender,
    createResendMagicLinkSender,
    isDevEmailTrapConfigured,
    type MagicLinkSender,
    type MagicLinkTemplateOptions,
} from './providers/email';
import { autoConfigureProviders, getConfiguredProvider } from './providers/presets';
import type { ProviderEnv } from './providers/types';

export {
    autoConfigureProviders,
    createAuth0Provider,
    createAzureAdProvider,
    createDiscordProvider,
    createGitHubProvider,
    createGoogleProvider,
    getConfiguredProvider,
} from './providers/presets';

export {
    createDevEmailTrapMagicLinkSender,
    createNodemailerMagicLinkSender,
    createResendMagicLinkSender,
    isDevEmailTrapConfigured,
    type MagicLinkSender,
    type MagicLinkSendParams,
    type MagicLinkTemplateOptions,
} from './providers/email';

export type {
    OAuthProfile,
    OAuthProviderConfig,
    OAuthTokenResponse,
    ProviderEnv,
    ProviderOptions,
} from './providers/types';

/**
 * Resolve the magic-link sender for the current environment, honoring the same
 * priority order the credentials/OAuth auto-detection uses: dev email trap (local
 * development capture) -> SMTP (Nodemailer) -> Resend.
 *
 * Returns `null` when no email provider is configured.
 */
export function resolveMagicLinkSender(
    env: ProviderEnv,
    options: MagicLinkTemplateOptions = {},
): MagicLinkSender | null {
    if (isDevEmailTrapConfigured(env)) {
        const store = createKvEmailTrapStore(env.OBCF_KV as any, {
            maxEntries: Math.max(1, Number(env.DEV_EMAIL_TRAP_MAX_EMAILS) || 50),
        });
        return createDevEmailTrapMagicLinkSender(env, { ...options, store });
    }

    if (env.EMAIL_SERVER && env.EMAIL_FROM) {
        return createNodemailerMagicLinkSender(env, options);
    }

    if (env.EMAIL_RESEND_API_KEY) {
        return createResendMagicLinkSender(env, options);
    }

    return null;
}

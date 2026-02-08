// ============================================================
// @ottabase/auth - Provider Configuration Presets
// ============================================================
//
// Pre-configured provider helpers for common providers:
// - OAuth: Google, GitHub, Discord, Azure AD, Auth0
// - Credentials: Username/password authentication
// - Email: Magic link (passwordless) via Resend or Nodemailer
//
// Uses tree-shakeable imports for optimal bundle size.
//
// ============================================================

import Auth0 from '@auth/core/providers/auth0';
import AzureAd from '@auth/core/providers/azure-ad';
import Credentials from '@auth/core/providers/credentials';
import Discord from '@auth/core/providers/discord';
import GitHub from '@auth/core/providers/github';
import Google from '@auth/core/providers/google';
import Nodemailer from '@auth/core/providers/nodemailer';
import Resend from '@auth/core/providers/resend';
import type { TemplateContent, TemplateVariables } from '@ottabase/email';
import { sendTemplatedEmail } from '@ottabase/email/mailer';
import { createResendMailer } from '@ottabase/email/providers/resend';

/**
 * Environment variables for provider credentials
 * These should be set in your .env file or Cloudflare Workers environment
 */
export interface ProviderEnv {
    // Google OAuth
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;

    // GitHub OAuth
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;

    // Discord OAuth
    DISCORD_CLIENT_ID?: string;
    DISCORD_CLIENT_SECRET?: string;

    // Microsoft/Azure OAuth
    AZURE_AD_CLIENT_ID?: string;
    AZURE_AD_CLIENT_SECRET?: string;
    AZURE_AD_TENANT_ID?: string;

    // Auth0
    AUTH0_CLIENT_ID?: string;
    AUTH0_CLIENT_SECRET?: string;
    AUTH0_ISSUER?: string;

    // Email (Magic Link) - Resend
    EMAIL_RESEND_API_KEY?: string;

    // Email (Magic Link) - Nodemailer/SMTP
    EMAIL_SERVER?: string; // smtp://user:pass@smtp.example.com:587
    EMAIL_FROM?: string;
}

/**
 * Options for configuring OAuth providers
 */
export interface ProviderOptions {
    /**
     * Additional scopes to request
     */
    scopes?: string[];

    /**
     * Allow users with unverified emails to sign in
     * @default false
     */
    allowDangerousEmailAccountLinking?: boolean;
}

/**
 * Create a Google OAuth provider configuration
 *
 * Requires environment variables:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 *
 * @param env - Environment variables
 * @param options - Additional provider options
 * @returns Provider configuration for Auth.js
 *
 * @example
 * ```typescript
 * import { createGoogleProvider } from "@ottabase/auth/providers";
 *
 * const providers = [
 *   createGoogleProvider(env),
 * ];
 * ```
 *
 * @example
 * ```typescript
 * // With additional scopes
 * createGoogleProvider(env, {
 *   scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
 * });
 * ```
 */
export function createGoogleProvider(env: ProviderEnv, options: ProviderOptions = {}) {
    const { scopes = [], allowDangerousEmailAccountLinking = false } = options;

    return Google({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        authorization: {
            params: {
                scope: ['openid', 'email', 'profile', ...scopes].join(' '),
            },
        },
        allowDangerousEmailAccountLinking,
    });
}

/**
 * Create a GitHub OAuth provider configuration
 *
 * Requires environment variables:
 * - GITHUB_CLIENT_ID
 * - GITHUB_CLIENT_SECRET
 *
 * @param env - Environment variables
 * @param options - Additional provider options
 * @returns Provider configuration for Auth.js
 *
 * @example
 * ```typescript
 * import { createGitHubProvider } from "@ottabase/auth/providers";
 *
 * const providers = [
 *   createGitHubProvider(env),
 * ];
 * ```
 *
 * @example
 * ```typescript
 * // With additional scopes
 * createGitHubProvider(env, {
 *   scopes: ["repo", "read:org"],
 * });
 * ```
 */
export function createGitHubProvider(env: ProviderEnv, options: ProviderOptions = {}) {
    const { scopes = [], allowDangerousEmailAccountLinking = false } = options;

    return GitHub({
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        authorization: {
            params: {
                scope: ['read:user', 'user:email', ...scopes].join(' '),
            },
        },
        allowDangerousEmailAccountLinking,
    });
}

/**
 * Create a Discord OAuth provider configuration
 *
 * Requires environment variables:
 * - DISCORD_CLIENT_ID
 * - DISCORD_CLIENT_SECRET
 *
 * @param env - Environment variables
 * @param options - Additional provider options
 * @returns Provider configuration for Auth.js
 *
 * @example
 * ```typescript
 * import { createDiscordProvider } from "@ottabase/auth/providers";
 *
 * const providers = [
 *   createDiscordProvider(env),
 * ];
 * ```
 */
export function createDiscordProvider(env: ProviderEnv, options: ProviderOptions = {}) {
    const { scopes = [], allowDangerousEmailAccountLinking = false } = options;

    return Discord({
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        authorization: {
            params: {
                scope: ['identify', 'email', ...scopes].join(' '),
            },
        },
        allowDangerousEmailAccountLinking,
    });
}

/**
 * Create a Microsoft Azure AD OAuth provider configuration
 *
 * Requires environment variables:
 * - AZURE_AD_CLIENT_ID
 * - AZURE_AD_CLIENT_SECRET
 * - AZURE_AD_TENANT_ID
 *
 * @param env - Environment variables
 * @param options - Additional provider options
 * @returns Provider configuration for Auth.js
 *
 * @example
 * ```typescript
 * import { createAzureAdProvider } from "@ottabase/auth/providers";
 *
 * const providers = [
 *   createAzureAdProvider(env),
 * ];
 * ```
 */
export function createAzureAdProvider(env: ProviderEnv, options: ProviderOptions = {}) {
    const { scopes = [], allowDangerousEmailAccountLinking = false } = options;

    return AzureAd({
        clientId: env.AZURE_AD_CLIENT_ID,
        clientSecret: env.AZURE_AD_CLIENT_SECRET,
        tenantId: env.AZURE_AD_TENANT_ID,
        authorization: {
            params: {
                scope: ['openid', 'profile', 'email', ...scopes].join(' '),
            },
        },
        allowDangerousEmailAccountLinking,
    });
}

/**
 * Create an Auth0 provider configuration
 *
 * Requires environment variables:
 * - AUTH0_CLIENT_ID
 * - AUTH0_CLIENT_SECRET
 * - AUTH0_ISSUER (e.g., https://your-domain.auth0.com)
 *
 * @param env - Environment variables
 * @param options - Additional provider options
 * @returns Provider configuration for Auth.js
 *
 * @example
 * ```typescript
 * import { createAuth0Provider } from "@ottabase/auth/providers";
 *
 * const providers = [
 *   createAuth0Provider(env),
 * ];
 * ```
 */
export function createAuth0Provider(env: ProviderEnv, options: ProviderOptions = {}) {
    const { allowDangerousEmailAccountLinking = false } = options;

    return Auth0({
        clientId: env.AUTH0_CLIENT_ID,
        clientSecret: env.AUTH0_CLIENT_SECRET,
        issuer: env.AUTH0_ISSUER,
        allowDangerousEmailAccountLinking,
    });
}

/**
 * Auto-configure providers based on available environment variables
 *
 * This helper automatically creates provider configurations for
 * all providers that have the required environment variables set.
 *
 * @param env - Environment variables
 * @returns Array of configured providers
 *
 * @example
 * ```typescript
 * import { autoConfigureProviders } from "@ottabase/auth/providers";
 *
 * // Automatically uses any providers that have credentials configured
 * const providers = autoConfigureProviders(env);
 * ```
 */
export function autoConfigureProviders(env: ProviderEnv) {
    const providers: any[] = [];

    // Google
    if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
        providers.push(createGoogleProvider(env));
    }

    // GitHub
    if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
        providers.push(createGitHubProvider(env));
    }

    // Discord
    if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) {
        providers.push(createDiscordProvider(env));
    }

    // Azure AD
    if (env.AZURE_AD_CLIENT_ID && env.AZURE_AD_CLIENT_SECRET && env.AZURE_AD_TENANT_ID) {
        providers.push(createAzureAdProvider(env));
    }

    // Auth0
    if (env.AUTH0_CLIENT_ID && env.AUTH0_CLIENT_SECRET && env.AUTH0_ISSUER) {
        providers.push(createAuth0Provider(env));
    }

    return providers;
}

/**
 * Create a Credentials provider for username/password authentication
 *
 * @param authorize - Function to validate credentials and return user
 * @returns Provider configuration for Auth.js
 *
 * @example
 * ```typescript
 * import { createCredentialsProvider } from "@ottabase/auth";
 *
 * const provider = createCredentialsProvider(async (credentials) => {
 *   const user = await db.user.findUnique({
 *     where: { email: credentials.email }
 *   });
 *
 *   if (!user || !await bcrypt.compare(credentials.password, user.password)) {
 *     return null;
 *   }
 *
 *   return { id: user.id, email: user.email, name: user.name };
 * });
 * ```
 */
export function createCredentialsProvider(authorize: (credentials: Record<string, any>) => Promise<any>) {
    return Credentials({
        credentials: {
            email: { label: 'Email', type: 'email' },
            password: { label: 'Password', type: 'password' },
        },
        authorize,
    });
}

/**
 * Create a custom Credentials provider with custom fields
 *
 * @param config - Credentials configuration
 * @returns Provider configuration for Auth.js
 *
 * @example
 * ```typescript
 * import { createCustomCredentialsProvider } from "@ottabase/auth";
 *
 * const provider = createCustomCredentialsProvider({
 *   credentials: {
 *     username: { label: "Username", type: "text" },
 *     password: { label: "Password", type: "password" },
 *   },
 *   authorize: async (credentials) => {
 *     // Your validation logic
 *     return { id: "1", name: "User" };
 *   },
 * });
 * ```
 */
export function createCustomCredentialsProvider(config: {
    credentials: Record<string, { label: string; type: string }>;
    authorize: (credentials: Record<string, any>) => Promise<any>;
}) {
    return Credentials(config);
}

/**
 * Create an Email provider for magic link authentication using Resend
 *
 * Requires environment variable:
 * - EMAIL_RESEND_API_KEY
 *
 * @param env - Environment variables
 * @param options - Email provider options
 * @returns Provider configuration for Auth.js
 *
 * @example
 * ```typescript
 * import { createResendProvider } from "@ottabase/auth";
 *
 * const provider = createResendProvider(env, {
 *   from: "noreply@example.com",
 * });
 * ```
 */
export function createResendProvider(
    env: ProviderEnv,
    options?: {
        from?: string;
        template?: string;
        subject?: string;
        appName?: string;
        content?: TemplateContent;
        variables?: TemplateVariables;
    },
) {
    const from = options?.from || env.EMAIL_FROM || 'noreply@example.com';
    const mailer = createResendMailer({ apiKey: env.EMAIL_RESEND_API_KEY || '' });

    return Resend({
        apiKey: env.EMAIL_RESEND_API_KEY,
        from,
        async sendVerificationRequest({ identifier, url, expires }) {
            const appName = options?.appName || 'Ottabase';
            const expiresAtMs = expires ? expires.getTime() : null;
            const expiresAt = expiresAtMs ? String(expiresAtMs) : '';
            const subject = options?.subject || `Sign in to ${appName}`;

            const content: TemplateContent = options?.content || {
                header: `Sign in to ${appName}`,
                body:
                    '<p>Hello,</p>' +
                    '<p>Click the link below to sign in:</p>' +
                    '<p><a href="{{url}}">Sign in</a></p>',
                footer: '<p>This link expires at {{expiresAt}}.</p>',
            };

            const result = await sendTemplatedEmail(mailer, {
                from,
                to: identifier,
                template: options?.template || 'default',
                subject,
                variables: {
                    url,
                    email: identifier,
                    appName,
                    expiresAt,
                    ...options?.variables,
                },
                content,
            });

            if (!result.success) {
                throw new Error(result.error || 'Failed to send login email');
            }
        },
    });
}

/**
 * Create an Email provider for magic link authentication using Nodemailer/SMTP
 *
 * Requires environment variables:
 * - EMAIL_SERVER (smtp connection string)
 * - EMAIL_FROM
 *
 * @param env - Environment variables
 * @returns Provider configuration for Auth.js
 *
 * @example
 * ```typescript
 * import { createNodemailerProvider } from "@ottabase/auth";
 *
 * // Uses EMAIL_SERVER and EMAIL_FROM from env
 * const provider = createNodemailerProvider(env);
 * ```
 *
 * @example
 * ```typescript
 * // With custom SMTP config
 * const provider = createNodemailerProvider(env, {
 *   server: {
 *     host: "smtp.example.com",
 *     port: 587,
 *     auth: {
 *       user: "user@example.com",
 *       pass: "password",
 *     },
 *   },
 *   from: "noreply@example.com",
 * });
 * ```
 */
export function createNodemailerProvider(
    env: ProviderEnv,
    options?: {
        server?:
            | string
            | {
                  host: string;
                  port: number;
                  auth: { user: string; pass: string };
              };
        from?: string;
    },
) {
    return Nodemailer({
        server: options?.server || env.EMAIL_SERVER,
        from: options?.from || env.EMAIL_FROM,
    });
}

// ============================================================
// @ottabase/auth - Provider Type Definitions
// ============================================================

/** Environment variables read by the built-in OAuth + email provider presets. */
export interface ProviderEnv {
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;

    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;

    DISCORD_CLIENT_ID?: string;
    DISCORD_CLIENT_SECRET?: string;

    AZURE_AD_CLIENT_ID?: string;
    AZURE_AD_CLIENT_SECRET?: string;
    AZURE_AD_TENANT_ID?: string;

    AUTH0_CLIENT_ID?: string;
    AUTH0_CLIENT_SECRET?: string;
    AUTH0_ISSUER?: string;

    EMAIL_RESEND_API_KEY?: string;
    EMAIL_SERVER?: string;
    EMAIL_FROM?: string;

    DEV_EMAIL_TRAP_ENABLED?: string;
    DEV_EMAIL_TRAP_MAX_EMAILS?: string;
    ENVIRONMENT?: string;
    OBCF_KV?: unknown;
}

export interface ProviderOptions {
    /** Additional OAuth scopes to request, appended to the provider's default scope list. */
    scopes?: string[];
}

/** A normalized OAuth profile, independent of the source provider's raw claim names. */
export interface OAuthProfile {
    providerAccountId: string;
    email: string | null;
    name: string | null;
    image: string | null;
    emailVerified: boolean;
}

export interface OAuthTokenResponse {
    access_token: string;
    token_type?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    id_token?: string;
    [key: string]: unknown;
}

export interface OAuthProviderConfig {
    id: string;
    name: string;
    clientId?: string;
    clientSecret?: string;
    authorizationUrl: string;
    authorizationParams?: Record<string, string>;
    tokenUrl: string;
    /** Extra static params merged into the token exchange request body. */
    tokenParams?: Record<string, string>;
    /** How the client credentials are sent on the token request. Defaults to `body`. */
    tokenAuthStyle?: 'body' | 'basic';
    scope: string;
    /** Extra headers to send on the token + profile requests (e.g. GitHub requires a User-Agent). */
    extraHeaders?: Record<string, string>;
    userInfoUrl?: string;
    mapProfile?: (raw: any, tokens: OAuthTokenResponse) => OAuthProfile;
    /** Override for providers that need more than one API call to build a profile (e.g. GitHub emails). */
    getProfile?: (tokens: OAuthTokenResponse, provider: OAuthProviderConfig) => Promise<OAuthProfile>;
}

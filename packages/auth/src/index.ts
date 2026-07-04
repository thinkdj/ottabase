// ============================================================
// @ottabase/auth - Authentication Package
// ============================================================
//
// A lightweight, dependency-free (Web Crypto only) authentication
// implementation for Ottabase apps on Cloudflare Workers + D1: signed
// session cookies, PBKDF2 credentials, generic OAuth2/OIDC (Google,
// GitHub, Discord, Azure AD, Auth0), and magic-link email sign-in.
//
// @see README.md for the full route table and usage guide.
//
// ============================================================

// ============================================================
// PROVIDERS (OAuth presets + magic-link email)
// ============================================================
export {
    autoConfigureProviders,
    createAuth0Provider,
    createAzureAdProvider,
    createDevEmailTrapMagicLinkSender,
    createDiscordProvider,
    createGitHubProvider,
    createGoogleProvider,
    createNodemailerMagicLinkSender,
    createResendMagicLinkSender,
    getConfiguredProvider,
    isDevEmailTrapConfigured,
    resolveMagicLinkSender,
    type MagicLinkSender,
    type MagicLinkSendParams,
    type MagicLinkTemplateOptions,
    type OAuthProfile,
    type OAuthProviderConfig,
    type OAuthTokenResponse,
    type ProviderEnv,
    type ProviderOptions,
} from './providers';

// ============================================================
// SESSION UTILITIES (pure helpers)
// ============================================================
export {
    getUserEmail,
    getUserId,
    hasVerifiedEmail,
    isAuthenticated,
    requireAuth,
    serializeSession,
    type Session,
    type SessionData,
    type SessionUser,
} from './session';

// ============================================================
// BACKEND HANDLER (Cloudflare Workers)
// ============================================================
export {
    bootstrapFirstUser,
    createSessionCookieForUser,
    getSession,
    handleAuthRequest,
    hashPassword,
    hashToken,
    revokeAllUserSessions,
    revokeSession,
    verifyPassword,
    type AuthEnv,
    type AuthorizedUser,
    type CreateAuthConfigOptions,
    type CredentialsAuthorizeOptions,
} from './backend-handler';

// ============================================================
// CLIENT API (frontend)
// ============================================================
export {
    changePassword,
    getCsrfToken,
    getSession as getSessionClient,
    isAuthenticated as isAuthenticatedClient,
    registerWithCredentials,
    requestEmailVerification,
    requestPasswordReset,
    resetPassword,
    sendMagicLink,
    signInWithCredentials,
    signInWithProvider,
    signOut,
    verifyEmail,
    type AuthClientOptions,
    type AuthResponse,
    type AuthSession,
    type ChangePasswordResponse,
    type EmailVerificationResponse,
    type PasswordResetResponse,
    type RegisterCredentials,
    type RegisterResponse,
    type SignInCredentials,
} from './client-api';

// ============================================================
// REACT HOOKS
// ============================================================
export {
    AUTH_STORAGE_KEY,
    clearAuthSessionStorage,
    useSession,
    type Session as ReactSession,
    type User,
    type UseSessionOptions,
} from './react-hooks';

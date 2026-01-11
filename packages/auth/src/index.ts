// ============================================================
// @ottabase/auth - Authentication Package
// ============================================================
//
// Complete Auth.js (NextAuth.js) integration for Ottabase applications
// with Cloudflare D1 support, provider presets, and framework helpers.
//
// Quick Start:
//   1. Add "auth" to features in db.config.ts
//   2. Run pnpm ottaorm:migrate
//   3. Create auth configuration with createOttabaseAuthConfig
//   4. Use in your framework (Next.js, Remix, etc.)
//
// @see README.md for detailed documentation
//
// ============================================================

// ============================================================
// FEATURE REGISTRATION
// ============================================================
export { authFeature, registerAuthFeature } from "./db.feature";

// ============================================================
// D1 ADAPTER - Unified Factory
// ============================================================
export {
  createD1AuthAdapter,
  createD1AuthAdapterCached,
  type D1AuthAdapterOptions,
} from "./adapter";

// ============================================================
// DRIZZLE ADAPTER (Direct Exports)
// ============================================================
export {
  createDrizzleD1AuthAdapter,
  createDrizzleD1AuthAdapterCached,
  type DrizzleD1AuthAdapterOptions,
} from "./adapters/drizzle-adapter";

// ============================================================
// CONFIGURATION HELPERS
// ============================================================
export {
  createOttabaseAuthConfig,
  createOttabaseAuthConfigDev,
  type OttabaseAuthConfigOptions,
} from "./config";

// ============================================================
// PROVIDER PRESETS
// ============================================================
export {
  // OAuth Providers
  autoConfigureProviders,
  createAuth0Provider,
  createAzureAdProvider,
  // Credentials Provider
  createCredentialsProvider,
  createCustomCredentialsProvider,
  createDiscordProvider,
  createGitHubProvider,
  createGoogleProvider,
  createNodemailerProvider,
  // Email Providers (Magic Link)
  createResendProvider,
  // Types
  type ProviderEnv,
  type ProviderOptions,
} from "./providers";

// ============================================================
// SESSION UTILITIES
// ============================================================
export {
  getUserEmail,
  getUserId,
  hasVerifiedEmail,
  isAuthenticated,
  requireAuth,
  serializeSession,
  type OttabaseSession,
  type SessionData,
} from "./session";

// ============================================================
// BACKEND HANDLER (Cloudflare Workers)
// ============================================================
export {
  createAuthConfig,
  getSession,
  handleAuthRequest,
  hashPassword,
  verifyPassword,
  type AuthEnv,
  type CreateAuthConfigOptions,
  type CredentialsAuthorizeOptions,
} from "./backend-handler";

// ============================================================
// CLIENT API (Frontend)
// ============================================================
export {
  getCsrfToken,
  getSession as getSessionClient,
  isAuthenticated as isAuthenticatedClient,
  sendMagicLink,
  signInWithCredentials,
  signInWithProvider,
  signOut,
  type AuthClientOptions,
  type AuthResponse,
  type AuthSession,
  type SignInCredentials,
} from "./client-api";

// ============================================================
// REACT HOOKS
// ============================================================
export {
  useSession,
  type Session,
  type User,
  type UseSessionOptions,
} from "./react-hooks";

// ============================================================
// TYPE DEFINITIONS
// ============================================================
export type { AuthConfig } from "./types";


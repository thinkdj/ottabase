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
export {
  authFeature,
  registerAuthFeature,
} from "./db.feature";

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
  type DrizzleD1AuthAdapterOptions
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
  createDiscordProvider,
  createGitHubProvider,
  createGoogleProvider,
  // Credentials Provider
  createCredentialsProvider,
  createCustomCredentialsProvider,
  // Email Providers (Magic Link)
  createResendProvider,
  createNodemailerProvider,
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
// TYPE DEFINITIONS
// ============================================================
export type { AuthConfig } from "./types";

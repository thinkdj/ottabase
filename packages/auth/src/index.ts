// ============================================================
// @ottabase/auth - Authentication Package
// ============================================================
//
// Complete Auth.js (NextAuth.js) integration for Ottabase applications
// with Cloudflare D1 support, provider presets, and Next.js helpers.
//
// Quick Start:
//   1. Add "auth" to features in db.config.ts
//   2. Run pnpm db:generate
//   3. Create auth configuration with createOttabaseAuthConfig
//   4. Use in Next.js App Router
//
// @see README.md for detailed documentation
//
// ============================================================

// ============================================================
// FEATURE REGISTRATION
// ============================================================
export {
  authFeature,
  authFeatureDrizzle,
  authFeaturePrisma,
  registerAuthFeature,
} from "./db.feature";

// Auto-register auth feature on package import
// This ensures the feature is available when generating schemas
import { registerAuthFeature } from "./db.feature";
registerAuthFeature("prisma");

// ============================================================
// D1 ADAPTER - Unified Factory (ORM-agnostic)
// ============================================================
export {
  createD1AuthAdapter,
  createD1AuthAdapterCached,
  type AuthORM,
  type D1AuthAdapterOptions,
} from "./adapter";

// ============================================================
// DRIZZLE ADAPTER (Recommended for D1)
// ============================================================
export {
    createDrizzleD1AuthAdapter,
    createDrizzleD1AuthAdapterCached,
    type DrizzleD1AuthAdapterOptions
} from "./adapters/drizzle-adapter";

// Convenience aliases
export {
    createDrizzleD1AuthAdapter as createDrizzleAuthAdapter,
    createDrizzleD1AuthAdapterCached as createDrizzleAuthAdapterCached
} from "./adapters/drizzle-adapter";

// ============================================================
// PRISMA ADAPTER (Legacy)
// ============================================================
export {
    createPrismaD1AuthAdapter,
    createPrismaD1AuthAdapterCached,
    type PrismaD1AuthAdapterOptions
} from "./adapters/prisma-adapter";

// ============================================================
// CONFIGURATION HELPERS
// ============================================================
export {
  createOttabaseAuthConfig,
  createOttabaseAuthConfigDev,
  mergeAuthConfig,
  type OttabaseAuthConfigOptions,
} from "./config";

// ============================================================
// PROVIDER PRESETS
// ============================================================
export {
  autoConfigureProviders,
  createAuth0Provider,
  createAzureAdProvider,
  createDiscordProvider,
  createGitHubProvider,
  createGoogleProvider,
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


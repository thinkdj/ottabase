// ============================================================
// @ottabase/auth - D1 Auth.js Adapter Factory
// ============================================================
//
// Drizzle ORM adapter factory for Auth.js with Cloudflare D1
// Optimized for edge/serverless environments with D1 support
//
// ============================================================

import type { Adapter } from "@auth/core/adapters";
import type { D1Database } from "@cloudflare/workers-types";
import {
  createDrizzleD1AuthAdapter as createDrizzleAdapter,
  createDrizzleD1AuthAdapterCached as createDrizzleAdapterCached,
  type DrizzleD1AuthAdapterOptions,
} from "./adapters/drizzle-adapter";

/**
 * Options for creating a D1 Auth.js adapter
 */
export interface D1AuthAdapterOptions extends DrizzleD1AuthAdapterOptions { }

/**
 * Create an Auth.js adapter for Cloudflare D1
 *
 * Uses Drizzle ORM for maximum edge compatibility and performance
 * with Cloudflare D1.
 *
 * @param d1 - The D1 database binding from the Worker environment
 * @param options - Optional configuration for the adapter
 * @returns An Auth.js compatible adapter
 *
 * @example
 * ```typescript
 * import { createD1AuthAdapter } from "@ottabase/auth";
 *
 * export const { handlers, auth } = NextAuth({
 *   adapter: createD1AuthAdapter(env.OBCF_D1),
 *   providers: [
 *     // Your providers
 *   ],
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With logging enabled
 * const adapter = createD1AuthAdapter(env.OBCF_D1, {
 *   log: ["query", "error"]
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With custom user fields
 * const adapter = createD1AuthAdapter(env.OBCF_D1, {
 *   customUserFields: ["role", "subscriptionTier"]
 * });
 * ```
 */
export function createD1AuthAdapter(
  d1: D1Database,
  options: D1AuthAdapterOptions = {},
): Adapter {
  return createDrizzleAdapter(d1, options);
}

/**
 * Create a cached D1 Auth.js adapter
 *
 * Uses caching to avoid creating multiple adapters/clients for the
 * same D1 binding. Recommended for production use.
 *
 * @param d1 - The D1 database binding from the Worker environment
 * @param options - Optional configuration for the adapter
 * @returns An Auth.js compatible adapter
 *
 * @example
 * ```typescript
 * import { createD1AuthAdapterCached } from "@ottabase/auth";
 *
 * export const { handlers, auth } = NextAuth({
 *   adapter: createD1AuthAdapterCached(env.OBCF_D1),
 *   providers: [
 *     // Your providers
 *   ],
 * });
 * ```
 */
export function createD1AuthAdapterCached(
  d1: D1Database,
  options: D1AuthAdapterOptions = {},
): Adapter {
  return createDrizzleAdapterCached(d1, options);
}

// ============================================================
// DIRECT DRIZZLE ADAPTER EXPORTS
// ============================================================

export {
  createDrizzleD1AuthAdapter,
  createDrizzleD1AuthAdapterCached,
  type DrizzleD1AuthAdapterOptions
} from "./adapters/drizzle-adapter";


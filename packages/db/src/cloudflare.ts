/**
 * Cloudflare integration for @ottabase/db
 *
 * This module provides Prisma client initialization with Cloudflare D1 adapter support.
 * It integrates with @ottabase/cf-data to enable database operations on Cloudflare Workers.
 */

import type { D1Database } from "@cloudflare/workers-types";
import { createPrismaD1Adapter, type PrismaD1Adapter } from "@ottabase/cf-data/d1";

/**
 * Configuration for Cloudflare Prisma client
 */
export interface CloudflarePrismaConfig {
  /**
   * Cloudflare D1 database binding
   */
  d1Database: D1Database;

  /**
   * Enable debug logging
   */
  debug?: boolean;

  /**
   * Additional Prisma client options
   */
  prismaOptions?: any;
}

/**
 * Result of creating a Cloudflare Prisma client
 */
export interface CloudflarePrismaClient<T = any> {
  /**
   * Prisma client instance with D1 adapter
   */
  prisma: T;

  /**
   * D1 adapter instance for direct database access
   */
  adapter: PrismaD1Adapter;
}

/**
 * Create a Prisma client for Cloudflare Workers with D1 database support
 *
 * @param PrismaClientConstructor - The PrismaClient constructor from your generated client
 * @param config - Configuration options for the Cloudflare Prisma client
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * import { createCloudflarePrisma } from '@ottabase/db/cloudflare';
 *
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const { prisma } = createCloudflarePrisma(PrismaClient, {
 *       d1Database: env.DB,
 *     });
 *
 *     const users = await prisma.user.findMany();
 *     return new Response(JSON.stringify(users));
 *   },
 * };
 * ```
 */
export function createCloudflarePrisma<T = any>(
  PrismaClientConstructor: new (options?: any) => T,
  config: CloudflarePrismaConfig
): CloudflarePrismaClient<T> {
  const { d1Database, debug = false, prismaOptions = {} } = config;

  if (!d1Database) {
    throw new Error(
      "D1 database binding is required. Make sure your wrangler.toml has a D1 database binding."
    );
  }

  // Create the D1 adapter using cf-data
  const adapter = createPrismaD1Adapter(d1Database);

  if (debug) {
    console.log("[CloudflarePrisma] Creating Prisma client with D1 adapter");
  }

  // Create Prisma client with the D1 adapter
  // Note: Prisma's driver adapter support requires specific configuration
  const prisma = new PrismaClientConstructor({
    ...prismaOptions,
    log: debug ? ["query", "info", "warn", "error"] : prismaOptions.log,
    adapter,
  } as any);

  return {
    prisma,
    adapter,
  };
}

/**
 * Create a singleton Prisma client for Cloudflare Workers
 *
 * This is useful for maintaining a single Prisma instance across multiple requests
 * in development environments where modules are cached.
 *
 * @param PrismaClientConstructor - The PrismaClient constructor from your generated client
 * @param configFactory - Factory function that returns configuration options
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * import { createCloudflarePrismaSingleton } from '@ottabase/db/cloudflare';
 *
 * declare global {
 *   var __cloudflare_prisma__: CloudflarePrismaClient | undefined;
 * }
 *
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const { prisma } = createCloudflarePrismaSingleton(
 *       PrismaClient,
 *       () => ({
 *         d1Database: env.DB,
 *       })
 *     );
 *
 *     const users = await prisma.user.findMany();
 *     return new Response(JSON.stringify(users));
 *   },
 * };
 * ```
 */
export function createCloudflarePrismaSingleton<T = any>(
  PrismaClientConstructor: new (options?: any) => T,
  configFactory: () => CloudflarePrismaConfig
): CloudflarePrismaClient<T> {
  // Use a global variable to cache the client in development
  // @ts-expect-error - Global variable for singleton pattern
  if (typeof globalThis.__cloudflare_prisma__ !== "undefined") {
    // @ts-expect-error - Global variable for singleton pattern
    return globalThis.__cloudflare_prisma__ as CloudflarePrismaClient<T>;
  }

  const config = configFactory();
  const client = createCloudflarePrisma(PrismaClientConstructor, config);

  // Cache in global for development
  // @ts-expect-error - Global variable for singleton pattern
  globalThis.__cloudflare_prisma__ = client;

  return client;
}

/**
 * Helper to disconnect Prisma client safely
 *
 * Call this in your worker's cleanup or after request completion if needed.
 *
 * @param prisma - The Prisma client instance to disconnect
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * import { createCloudflarePrisma, disconnectCloudflarePrisma } from '@ottabase/db/cloudflare';
 *
 * const { prisma } = createCloudflarePrisma(PrismaClient, { d1Database: env.DB });
 *
 * try {
 *   await prisma.user.findMany();
 * } finally {
 *   await disconnectCloudflarePrisma(prisma);
 * }
 * ```
 */
export async function disconnectCloudflarePrisma(
  prisma: any
): Promise<void> {
  try {
    if (prisma && typeof prisma.$disconnect === "function") {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error("Error disconnecting Prisma client:", error);
  }
}

/**
 * Re-export useful types from cf-data
 */
export type {
  D1Database,
  D1Result,
  D1Params,
  ID1Database,
  ID1PreparedStatement,
} from "@ottabase/cf-data";

/**
 * Re-export D1 adapter creators
 */
export { createD1Database, createPrismaD1Adapter } from "@ottabase/cf-data/d1";

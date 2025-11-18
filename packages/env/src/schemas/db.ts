import { z } from "zod";
import { databaseUrl, bool } from "../helpers";

/**
 * Environment schema for @ottabase/db package
 * Prisma database configuration
 */
export const dbEnvSchema = z.object({
  /**
   * Database connection URL
   * Format: postgresql://user:password@host:port/database
   * or: mysql://user:password@host:port/database
   * or: file:./dev.db (for SQLite)
   */
  DATABASE_URL: databaseUrl().describe(
    "Database connection URL for Prisma",
  ),

  /**
   * Direct database URL (for connection pooling)
   * Used when DATABASE_URL points to a pooler
   */
  DIRECT_URL: databaseUrl()
    .optional()
    .describe("Direct database URL (bypasses connection pooling)"),

  /**
   * Shadow database URL (for migrations in production)
   */
  SHADOW_DATABASE_URL: databaseUrl()
    .optional()
    .describe("Shadow database URL for migrations"),

  /**
   * Enable Prisma query logging
   */
  PRISMA_QUERY_LOG: bool().optional().default("false").describe(
    "Enable Prisma query logging",
  ),

  /**
   * Enable Prisma debug mode
   */
  PRISMA_DEBUG: bool().optional().default("false").describe(
    "Enable Prisma debug mode",
  ),

  /**
   * Database connection pool size
   */
  DATABASE_POOL_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(10)
    .describe("Database connection pool size"),

  /**
   * Database connection timeout (ms)
   */
  DATABASE_TIMEOUT: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(5000)
    .describe("Database connection timeout in milliseconds"),
});

export type DbEnv = z.infer<typeof dbEnvSchema>;

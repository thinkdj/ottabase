/**
 * @ottabase/env - Type-safe environment variable validation
 *
 * @example
 * ```ts
 * import { createEnv } from "@ottabase/env";
 * import { z } from "zod";
 *
 * export const env = createEnv({
 *   schema: z.object({
 *     DATABASE_URL: z.string().url(),
 *     PORT: z.coerce.number().default(3000),
 *   }),
 * });
 * ```
 */

// Core
export {
  createEnv,
  validateEnv,
  extractMetadata,
  mergeEnv,
  getEnvVar,
  isDev,
  isProd,
  isTest,
  isStaging,
  isCI,
} from "./core";

// Types
export type {
  EnvConfig,
  EnvVarMetadata,
  EnvValidationResult,
} from "./types";

// Helpers
export * from "./helpers";

// Re-export zod for convenience
export { z } from "zod";

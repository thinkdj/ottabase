/**
 * Pre-built schemas for common Ottabase packages
 *
 * Import and use these schemas in your packages, or create your own
 */

export * from "./cf";
export * from "./db";
export * from "./config";

import { z } from "zod";
import { cfEnvSchema } from "./cf";
import { dbEnvSchema } from "./db";
import { configEnvSchema } from "./config";

/**
 * Combined schema for all Ottabase packages
 * Use this if you want to validate all environment variables at once
 */
export const ottabaseEnvSchema = z.object({
  ...cfEnvSchema.shape,
  ...dbEnvSchema.shape,
  ...configEnvSchema.shape,
});

export type OttabaseEnv = z.infer<typeof ottabaseEnvSchema>;

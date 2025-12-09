import { z } from 'zod';

/**
 * Configuration for a single model or group of models
 */
export const ModelConfigSchema = z.object({
  // Import from package (e.g., "@ottabase/ottaorm/models")
  import: z.string().optional(),
  // Or load from local path (e.g., "./ottabase/models")
  path: z.string().optional(),
  // Model class names to include
  models: z.array(z.string()),
  // Feature group (core, auth, app, etc.)
  feature: z.string().default('app'),
}).refine(
  (data) => data.import || data.path,
  {
    message: "Either 'import' or 'path' must be specified",
  }
);

/**
 * Main migration configuration
 */
export const MigrateConfigSchema = z.object({
  // Models to track
  models: z.array(ModelConfigSchema),
  // Where to store migration files
  migrationsPath: z.string().default('ottabase/migrations'),
  // Where to generate consolidated schema (for reference)
  schemaPath: z.string().default('ottabase/drizzle/schema.ts'),
  // State tracking table name
  stateTable: z.string().default('_migrations'),
  // Lock table for concurrent protection
  lockTable: z.string().default('_migration_lock'),
  // Lock timeout (ms)
  lockTimeout: z.number().default(300000), // 5 minutes
});

// Export types
export type MigrateConfig = z.infer<typeof MigrateConfigSchema>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

/**
 * Helper function to define migration config with type safety
 */
export function defineMigrateConfig(config: Partial<MigrateConfig>): MigrateConfig {
  return MigrateConfigSchema.parse(config);
}

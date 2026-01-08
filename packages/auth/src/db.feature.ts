import { defineFeatureSchema, registerFeature } from "@ottabase/db/registry";

/**
 * Auth feature schema definition for Drizzle
 *
 * Auth tables are integrated into OttaORM core migrations:
 * - 001_create_users_table
 * - 002_create_accounts_table
 * - 006_create_sessions_table
 * - 007_create_verification_tokens_table
 * - 008_create_authenticators_table
 *
 * No separate schema files needed - migrations are managed by OttaORM.
 */
export const authFeature = defineFeatureSchema({
  featureId: "auth",
  name: "Authentication",
  description:
    "Auth.js (NextAuth.js) compatible authentication models for Drizzle + D1",
  packageName: "@ottabase/auth",
  schemaPath: "", // Empty - using OttaORM migrations
  dependencies: ["@ottabase/ottaorm"], // Requires OttaORM for migrations
  version: "1.0.0",
});

/**
 * Register the auth feature with the global registry
 */
export function registerAuthFeature(): void {
  registerFeature(authFeature);
}

// Auto-register auth feature by default
registerAuthFeature();

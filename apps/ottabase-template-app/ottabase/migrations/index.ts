// ============================================================
// App Migrations (ottabase-template-app)
// ============================================================
//
// AUTOMATIC MIGRATIONS:
// Tables are now AUTO-CREATED from your Models - no need to
// write CREATE TABLE migrations manually!
//
// CUSTOM MIGRATIONS:
// Add your custom migrations below for things like:
// - Data seeding
// - Custom indexes
// - Database views
// - Triggers
// - Initial data
//
// See ./custom/README.md for examples
// ============================================================

import type { Migration } from "@ottabase/ottaorm";

/**
 * Custom migrations
 *
 * These run AFTER automatic table creation from Models.
 * Add your custom SQL migrations here.
 *
 * @example
 * {
 *   name: "0000_seed_admin_user",
 *   up: async (db) => {
 *     await db.execute(`
 *       INSERT OR IGNORE INTO users (id, name, email, created_at, updated_at)
 *       VALUES ('admin-001', 'Admin', 'admin@example.com',
 *               strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000)
 *     `);
 *   },
 * }
 */
export const appMigrations: Migration[] = [
  // Add your custom migrations here
  // Example:
  // {
  //   name: "0000_seed_initial_data",
  //   up: async (db) => {
  //     await db.execute(`INSERT INTO ...`);
  //   },
  // },
];

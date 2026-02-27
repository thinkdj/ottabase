// ============================================================
// Migration Registry (ottabase-template-app-tanstack)
// ============================================================
//
// This file orchestrates all migrations for the application:
// 1. CORE migrations (from @ottabase/ottaorm - auth, users, posts, etc.)
// 2. APP-SPECIFIC migrations (custom to this app)
// 3. PACKAGE migrations (from enabled packages like @ottabase/shortlinks)
//
// The migration system automatically:
// - Creates tables from Models (no manual CREATE TABLE migrations needed!)
// - Adds new columns to existing tables
// - Tracks migration history in _ottabase_migrations table
// - Runs custom migrations in order
//
// See ./README.md for detailed documentation
// ============================================================

import type { Migration } from '@ottabase/ottaorm';
import { getEnabledPackageMigrations } from '../config.migrations';

// ============================================================
// 1. CORE MIGRATIONS
// ============================================================
// Core migrations from @ottabase/ottaorm
// These handle auth tables, user management, posts, etc.
// Tables are auto-created from Models - no migrations needed!
const coreMigrations: Migration[] = [
    // Core tables (users, sessions, accounts, etc.) are auto-created
    // from their Model definitions in @ottabase/ottaorm
    // No manual migrations needed unless you need custom indexes, triggers, etc.
];

// ============================================================
// 2. APP-SPECIFIC MIGRATIONS
// ============================================================
// Custom migrations specific to this application
// These run AFTER automatic table creation from Models.
//
// Use cases:
// - Data seeding (prefer ORM in init/seed handlers — see ensureAppBrandDefaults)
// - Custom indexes
// - Database views
// - Triggers
// - Initial data
//
// Example:
// {
//   name: "0001_seed_admin_user",
//   up: async (db) => {
//     await db.executeRaw(`
//       INSERT OR IGNORE INTO users (id, name, email, created_at, updated_at)
//       VALUES ('admin-001', 'Admin', 'admin@example.com',
//               strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000)
//     `);
//   },
// }
const appSpecificMigrations: Migration[] = [
    // Add your custom app-specific migrations here
    // Default brand kit + route mappings seeded via ensureAppBrandDefaults (ORM)
    // in bootstrap handleSeed and api/ottaorm init — uses BrandKit.getOrCreateDefault
    // and DEFAULT_ROUTE_MAPPINGS from @ottabase/brand-engine
];

// ============================================================
// 3. PACKAGE MIGRATIONS
// ============================================================
// Migrations from enabled packages (configured in config.migrations.ts)
// These are automatically collected based on your package configuration
const packageMigrations = getEnabledPackageMigrations();

// ============================================================
// COMBINED MIGRATIONS EXPORT
// ============================================================
// All migrations are combined in the order:
// 1. Core migrations
// 2. App-specific migrations
// 3. Package migrations
//
// This ensures proper dependency order:
// - Core tables exist before app tables
// - App tables exist before package-specific data migrations
export const appMigrations: Migration[] = [...coreMigrations, ...appSpecificMigrations, ...packageMigrations];

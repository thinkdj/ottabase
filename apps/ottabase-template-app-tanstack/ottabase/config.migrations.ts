// ============================================================
// PACKAGE MIGRATION CONFIGURATION
// ============================================================
// Register external packages (like @ottabase/shortlinks) here to
// automatically include their database tables and migrations.
//
// Package enable/disable is driven by ottabase.config.ts `packages` key.
// HOW TO ADD A BUILT-IN PACKAGE:
// 1. Import the package's table schema and migrations
// 2. Add it to `PACKAGE_REGISTRY` below
// 3. Add the key to `BUILT_IN_PACKAGES` in @ottabase/config and ottabase.config.ts
// NOTE: brandEngine is core (always enabled) — in PACKAGE_REGISTRY but not in BUILT_IN_PACKAGES
//
// HOW TO ADD A CUSTOM PACKAGE:
// 1. Import tables, add to `PACKAGE_REGISTRY` with key matching ottabase.config `customPackages`
// 2. Register routes in config.routes.ts
// 3. Add to ottabase.config.ts `customPackages`
// ============================================================

import type { BuiltInPackageName } from '@ottabase/config';
import { getOttabaseConfig } from './config.loader';
import { brandKitsTable, layoutRouteMappingsTable, layoutTemplatesTable } from '@ottabase/brand-engine/persistence';
import { menuItemsTable, menusTable } from '@ottabase/ottamenu/persistence';
import {
    categoriesTable,
    ottablogPluginsTable,
    ottablogThemesTable,
    postTagLinksTable,
    postTagsTable,
    postVersionsTable,
    postsTable,
    seriesTable,
} from '@ottabase/ottablog';
import type { Migration } from '@ottabase/ottaorm';
import { referralTrackingTable } from '@ottabase/referrals';
import { shortlinksTable } from '@ottabase/shortlinks';

/**
 * 1. REGISTRY
 * Map package names to their table definitions and optional migrations.
 */
const PACKAGE_REGISTRY = {
    ottablog: {
        tables: {
            seriesTable,
            categoriesTable,
            postsTable,
            postTagsTable,
            postTagLinksTable,
            postVersionsTable,
            ottablogPluginsTable,
            ottablogThemesTable,
        },
        migrations: [] as Migration[],
    },
    shortlinks: {
        tables: { shortlinksTable },
        migrations: [] as Migration[], // Add package-specific migrations here if any
    },
    referrals: {
        tables: { referralTrackingTable },
        migrations: [] as Migration[],
    },
    brandEngine: {
        tables: {
            brandKitsTable,
            layoutTemplatesTable,
            layoutRouteMappingsTable,
        },
        migrations: [] as Migration[],
    },
    ottamenu: {
        tables: {
            menusTable,
            menuItemsTable,
        },
        migrations: [] as Migration[],
    },
} as const;

/**
 * 2. CONFIGURATION
 * Package toggles are driven by ottabase.config.ts `packages` key.
 * This export is for backwards compatibility; prefer getOttabaseConfig().packages
 */
export type MigrationPackageName = keyof typeof PACKAGE_REGISTRY;

export function getMigrationConfig(env?: Record<string, unknown>): Record<MigrationPackageName, boolean> {
    const config = getOttabaseConfig(env);
    const result: Record<string, boolean> = {};
    for (const pkg of Object.keys(PACKAGE_REGISTRY) as MigrationPackageName[]) {
        result[pkg] =
            pkg === 'brandEngine' || pkg === 'ottamenu' ? true : (config.packages[pkg as BuiltInPackageName] ?? false);
    }
    return result as Record<MigrationPackageName, boolean>;
}

// ============================================================
// PRIVATE UTILITY (Do not edit below this line)
// ============================================================

/**
 * Merges tables from all enabled packages (built-in + custom) into a single object.
 * Driven by ottabase.config.ts. Used by schema.ts and runtime migrations.
 */
export function getEnabledPackageTables(env?: Record<string, unknown>) {
    const config = getOttabaseConfig(env);
    const tables: Record<string, unknown> = {};

    // Built-in packages (brandEngine is core — always included)
    for (const [pkgName, pkgConfig] of Object.entries(PACKAGE_REGISTRY)) {
        if (pkgName === 'brandEngine' || pkgName === 'ottamenu' || config.packages[pkgName as BuiltInPackageName]) {
            Object.assign(tables, pkgConfig.tables);
        }
    }

    // Custom packages (from ottabase.config customPackages)
    for (const [pkgName, pkgConfig] of Object.entries(config.customPackages)) {
        if (pkgConfig?.tables) {
            Object.assign(tables, pkgConfig.tables);
        }
    }

    return tables;
}

/**
 * Merges migrations from all enabled packages into a single array.
 * Built-in migrations from PACKAGE_REGISTRY; custom packages can include migrations in their config.
 */
export function getEnabledPackageMigrations(env?: Record<string, unknown>): Migration[] {
    const config = getOttabaseConfig(env);
    const migrations: Migration[] = [];

    // Built-in packages (brandEngine is core — always included)
    for (const [pkgName, pkgConfig] of Object.entries(PACKAGE_REGISTRY)) {
        if (
            (pkgName === 'brandEngine' || pkgName === 'ottamenu' || config.packages[pkgName as BuiltInPackageName]) &&
            pkgConfig.migrations
        ) {
            migrations.push(...pkgConfig.migrations);
        }
    }

    // Custom packages
    for (const pkgConfig of Object.values(config.customPackages)) {
        if (pkgConfig?.migrations && Array.isArray(pkgConfig.migrations)) {
            migrations.push(...(pkgConfig.migrations as Migration[]));
        }
    }

    return migrations;
}

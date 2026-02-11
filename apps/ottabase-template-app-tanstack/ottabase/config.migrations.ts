// ============================================================
// PACKAGE MIGRATION CONFIGURATION
// ============================================================
// Register external packages (like @ottabase/shortlinks) here to
// automatically include their database tables and migrations.
//
// HOW TO ADD A PACKAGE:
// 1. Import the package's table schema and migrations
// 2. Add it to `PACKAGE_REGISTRY` below
// 3. Enable it in `migrationConfig`
// ============================================================

import {
    brandSettingsTable,
    layoutTemplatesTable,
    layoutRouteMappingsTable,
    themeVariantsTable,
} from '@ottabase/brand-engine/persistence';
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
            brandSettingsTable,
            layoutTemplatesTable,
            layoutRouteMappingsTable,
            themeVariantsTable,
        },
        migrations: [] as Migration[],
    },
} as const;

/**
 * 2. CONFIGURATION
 * Toggle packages ON (true) or OFF (false).
 * Only enabled packages will have their tables created/migrated.
 */
export type MigrationPackageName = keyof typeof PACKAGE_REGISTRY;

export const migrationConfig: Record<MigrationPackageName, boolean> = {
    ottablog: true,
    shortlinks: true,
    referrals: true,
    brandEngine: true,
};

// ============================================================
// PRIVATE UTILITY (Do not edit below this line)
// ============================================================

/**
 * Merges tables from all enabled packages into a single object.
 * Used by `schema.ts` (Drizzle Kit) and `config.migrations.ts` (Runtime).
 */
export function getEnabledPackageTables() {
    const tables: Record<string, any> = {};

    for (const [pkgName, config] of Object.entries(PACKAGE_REGISTRY)) {
        if (migrationConfig[pkgName as MigrationPackageName]) {
            Object.assign(tables, config.tables);
        }
    }

    return tables;
}

/**
 * Merges migrations from all enabled packages into a single array.
 * Used by migration runner to execute package-specific migrations.
 */
export function getEnabledPackageMigrations(): Migration[] {
    const migrations: Migration[] = [];

    for (const [pkgName, config] of Object.entries(PACKAGE_REGISTRY)) {
        if (migrationConfig[pkgName as MigrationPackageName]) {
            migrations.push(...config.migrations);
        }
    }

    return migrations;
}

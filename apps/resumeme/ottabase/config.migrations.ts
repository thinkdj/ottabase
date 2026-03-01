// ============================================================
// PACKAGE MIGRATION CONFIGURATION (ResumeMe)
// ============================================================
// Register external packages here to automatically include their
// database tables and migrations.
//
// ResumeMe disables ottablog, shortlinks, and referrals.
// brandEngine is core — always enabled.
// ============================================================

import {
    brandKitsTable,
    layoutRouteMappingsTable,
    layoutTemplatesTable,
    menuItemsTable,
    menuSlotAssignmentsTable,
    menusTable,
} from '@ottabase/brand-engine/persistence';
import { brandEngineMigrations } from '@ottabase/brand-engine/persistence';
import type { BuiltInPackageName } from '@ottabase/config';
import type { Migration } from '@ottabase/ottaorm';
import { shortlinksTable } from '@ottabase/shortlinks';
import { getOttabaseConfig } from './config.loader';

/**
 * 1. REGISTRY
 * Map package names to their table definitions and optional migrations.
 */
const PACKAGE_REGISTRY = {
    brandEngine: {
        tables: {
            brandKitsTable,
            layoutTemplatesTable,
            layoutRouteMappingsTable,
            menuSlotAssignmentsTable,
            menusTable,
            menuItemsTable,
        },
        migrations: brandEngineMigrations,
    },
    shortlinks: {
        tables: { shortlinksTable },
        migrations: [] as Migration[],
    },
} as const;

/**
 * 2. CONFIGURATION
 */
export type MigrationPackageName = keyof typeof PACKAGE_REGISTRY;

export function getMigrationConfig(env?: Record<string, unknown>): Record<MigrationPackageName, boolean> {
    const config = getOttabaseConfig(env);
    const result: Record<string, boolean> = {};
    for (const pkg of Object.keys(PACKAGE_REGISTRY) as MigrationPackageName[]) {
        result[pkg] = pkg === 'brandEngine' ? true : (config.packages[pkg as BuiltInPackageName] ?? false);
    }
    return result as Record<MigrationPackageName, boolean>;
}

// ============================================================
// PRIVATE UTILITY (Do not edit below this line)
// ============================================================

/**
 * Merges tables from all enabled packages (built-in + custom) into a single object.
 */
export function getEnabledPackageTables(env?: Record<string, unknown>) {
    const config = getOttabaseConfig(env);
    const tables: Record<string, unknown> = {};

    for (const [pkgName, pkgConfig] of Object.entries(PACKAGE_REGISTRY)) {
        if (pkgName === 'brandEngine' || config.packages[pkgName as BuiltInPackageName]) {
            Object.assign(tables, pkgConfig.tables);
        }
    }

    for (const [pkgName, pkgConfig] of Object.entries(config.customPackages)) {
        if (pkgConfig?.tables) {
            Object.assign(tables, pkgConfig.tables);
        }
    }

    return tables;
}

/**
 * Merges migrations from all enabled packages into a single array.
 */
export function getEnabledPackageMigrations(env?: Record<string, unknown>): Migration[] {
    const config = getOttabaseConfig(env);
    const migrations: Migration[] = [];

    for (const [pkgName, pkgConfig] of Object.entries(PACKAGE_REGISTRY)) {
        if ((pkgName === 'brandEngine' || config.packages[pkgName as BuiltInPackageName]) && pkgConfig.migrations) {
            migrations.push(...pkgConfig.migrations);
        }
    }

    for (const pkgConfig of Object.values(config.customPackages)) {
        if (pkgConfig?.migrations && Array.isArray(pkgConfig.migrations)) {
            migrations.push(...(pkgConfig.migrations as Migration[]));
        }
    }

    return migrations;
}

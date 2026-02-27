// ============================================================
// PACKAGE MIGRATION CONFIGURATION  (Framework-managed)
// ============================================================
// This file wires up the built-in PACKAGE_REGISTRY and merges
// any custom/premium packages declared in `../ottabase.config.ts`
// (customPackages is KEY-ONLY; schemas live here in USER_PACKAGE_REGISTRY).
//
// ── To enable/disable a built-in package ────────────────────
//   Edit `packages` in ottabase.config.ts (no change needed here).
//
// ── To add a custom or premium package ──────────────────────
//   1. Install the package and import its table schema below.
//   2. Add it to USER_PACKAGE_REGISTRY with { tables, migrations } (server-only).
//   3. Register its API routes in `config.routes.ts`.
//   4. Toggle it on in `customPackages` in ottabase.config.ts (boolean flag only).
//
// Example:
//   import { myPremiumTable } from '@myorg/premium-feature/schema';
//   const USER_PACKAGE_REGISTRY: Record<string, PackageEntry> = {
//     myPremiumFeature: {
//       tables: { myPremiumTable },
//       migrations: [],
//     },
//   };
// ============================================================

import { brandKitsTable, layoutRouteMappingsTable, layoutTemplatesTable } from '@ottabase/brand-engine/persistence';
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
import userConfig from '../ottabase.config';

// ── Internal types ───────────────────────────────────────────────────────────

interface PackageEntry {
    tables: Record<string, unknown>;
    migrations: Migration[];
}

// ── 1. BUILT-IN REGISTRY (framework-maintained) ──────────────────────────────
// Do not edit this section. Add new built-in packages here when the framework
// ships new packages.

const BUILTIN_PACKAGE_REGISTRY: Record<string, PackageEntry> = {
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
        migrations: [],
    },
    shortlinks: {
        tables: { shortlinksTable },
        migrations: [],
    },
    referrals: {
        tables: { referralTrackingTable },
        migrations: [],
    },
    brandEngine: {
        tables: {
            brandKitsTable,
            layoutTemplatesTable,
            layoutRouteMappingsTable,
        },
        migrations: [],
    },
};

// ── 2. USER / PREMIUM REGISTRY (add custom packages here) ────────────────────
// Import your premium package table schemas above, then register them here.
// The key must match an entry in `customPackages` in ottabase.config.ts.
//
// Example:
//   import { premiumTable } from '@myorg/premium-feature/schema';
//   const USER_PACKAGE_REGISTRY: Record<string, PackageEntry> = {
//     myPremiumFeature: { tables: { premiumTable }, migrations: [] },
//   };

const USER_PACKAGE_REGISTRY: Record<string, PackageEntry> = {};

// ── 3. COMBINED REGISTRY ─────────────────────────────────────────────────────

const PACKAGE_REGISTRY: Record<string, PackageEntry> = {
    ...BUILTIN_PACKAGE_REGISTRY,
    ...USER_PACKAGE_REGISTRY,
};

// ── 4. TOGGLES (read from ottabase.config.ts) ────────────────────────────────
// Built-in packages: sourced from `packages` in ottabase.config.ts.
// Custom packages:   sourced from `customPackages` keys (all enabled when listed).

export type MigrationPackageName = string;

function buildMigrationConfig(): Record<string, boolean> {
    const cfg: Record<string, boolean> = {};

    // Built-in packages
    const pkgs = userConfig.packages ?? {};
    for (const name of Object.keys(BUILTIN_PACKAGE_REGISTRY)) {
        cfg[name] = (pkgs as Record<string, boolean>)[name] ?? false;
    }

    // Custom/premium packages (present in USER_PACKAGE_REGISTRY → enabled)
    const custom = userConfig.customPackages ?? {};
    for (const name of Object.keys(USER_PACKAGE_REGISTRY)) {
        cfg[name] = name in custom ? true : false;
    }

    return cfg;
}

export const migrationConfig: Record<MigrationPackageName, boolean> = buildMigrationConfig();

// ============================================================
// PRIVATE UTILITY (Do not edit below this line)
// ============================================================

/**
 * Merges tables from all enabled packages into a single object.
 * Used by `schema.ts` (Drizzle Kit) and the runtime migration init.
 */
export function getEnabledPackageTables(): Record<string, unknown> {
    const tables: Record<string, unknown> = {};

    for (const [pkgName, entry] of Object.entries(PACKAGE_REGISTRY)) {
        if (migrationConfig[pkgName]) {
            Object.assign(tables, entry.tables);
        }
    }

    return tables;
}

/**
 * Merges migrations from all enabled packages into a single array.
 * Used by the migration runner for package-specific SQL migrations.
 */
export function getEnabledPackageMigrations(): Migration[] {
    const migrations: Migration[] = [];

    for (const [pkgName, entry] of Object.entries(PACKAGE_REGISTRY)) {
        if (migrationConfig[pkgName]) {
            migrations.push(...entry.migrations);
        }
    }

    return migrations;
}

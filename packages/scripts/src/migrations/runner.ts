// ============================================================
// @ottabase/scripts - Migration Runner
// ============================================================
//
// This module provides utilities for running modular migrations
// based on app configuration and enabled features.
//
// ============================================================

import type { AppDbConfig, FeatureId } from '@ottabase/db/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Migration file metadata
 */
export interface MigrationFile {
    /** Migration filename */
    filename: string;
    /** Full path to migration file */
    filepath: string;
    /** Feature this migration belongs to (null for core) */
    feature: FeatureId | null;
    /** Migration order/version (extracted from filename) */
    version: string;
    /** SQL content of the migration */
    content: string;
}

/**
 * Migration result
 */
export interface MigrationResult {
    /** Whether the migration was successful */
    success: boolean;
    /** Migrations that were applied */
    applied: MigrationFile[];
    /** Migrations that were skipped (already applied) */
    skipped: MigrationFile[];
    /** Errors that occurred */
    errors: Array<{ migration: MigrationFile; error: Error }>;
}

/**
 * Options for discovering migrations
 */
export interface DiscoverMigrationsOptions {
    /** App configuration */
    config: AppDbConfig;
    /** Root directory of the monorepo */
    rootDir: string;
    /** Path to packages directory */
    packagesDir?: string;
}

/**
 * Options for running migrations
 */
export interface RunMigrationsOptions extends DiscoverMigrationsOptions {
    /** Whether to run in dry-run mode (don't actually apply) */
    dryRun?: boolean;
    /** D1 database binding (for Cloudflare D1) */
    d1?: unknown;
    /** SQLite database path (for local development) */
    sqlitePath?: string;
}

/**
 * Discover all migrations for an app based on its configuration
 */
export async function discoverMigrations(options: DiscoverMigrationsOptions): Promise<MigrationFile[]> {
    const { config, rootDir, packagesDir = 'packages' } = options;
    const migrations: MigrationFile[] = [];

    // 1. Discover core migrations from @ottabase/db
    const dbMigrationsDir = path.join(rootDir, packagesDir, 'db', 'migrations');
    if (fs.existsSync(dbMigrationsDir)) {
        const coreMigrations = await readMigrationsFromDir(dbMigrationsDir, null);
        migrations.push(...coreMigrations);
    }

    // 2. Discover feature migrations
    if (config.features) {
        for (const featureId of config.features) {
            // Try different package naming conventions
            const possiblePaths = [
                path.join(rootDir, packagesDir, `feature-${featureId}`, 'migrations'),
                path.join(rootDir, packagesDir, featureId, 'migrations'),
            ];

            for (const featureMigrationsDir of possiblePaths) {
                if (fs.existsSync(featureMigrationsDir)) {
                    const featureMigrations = await readMigrationsFromDir(featureMigrationsDir, featureId);
                    migrations.push(...featureMigrations);
                    break; // Found migrations for this feature
                }
            }
        }
    }

    // 3. Sort migrations by version/order
    migrations.sort((a, b) => {
        // First sort by version number
        const versionCompare = a.version.localeCompare(b.version, undefined, {
            numeric: true,
        });
        if (versionCompare !== 0) return versionCompare;

        // Then by feature (core first, then alphabetically)
        if (a.feature === null && b.feature !== null) return -1;
        if (a.feature !== null && b.feature === null) return 1;
        if (a.feature && b.feature) {
            return a.feature.localeCompare(b.feature);
        }
        return 0;
    });

    return migrations;
}

/**
 * Read migration files from a directory
 */
async function readMigrationsFromDir(dir: string, feature: FeatureId | null): Promise<MigrationFile[]> {
    const migrations: MigrationFile[] = [];

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql'));

    for (const filename of files) {
        const filepath = path.join(dir, filename);
        const content = fs.readFileSync(filepath, 'utf-8');

        // Extract version from filename (e.g., "0001_initial.sql" -> "0001")
        const versionMatch = filename.match(/^(\d+)/);
        const version = versionMatch ? versionMatch[1] : '0000';

        migrations.push({
            filename,
            filepath,
            feature,
            version,
            content,
        });
    }

    return migrations;
}

/**
 * Generate a migration plan for an app
 */
export async function generateMigrationPlan(options: DiscoverMigrationsOptions): Promise<{
    migrations: MigrationFile[];
    summary: string;
}> {
    const migrations = await discoverMigrations(options);

    const coreCount = migrations.filter((m) => m.feature === null).length;
    const featureCounts = new Map<string, number>();

    for (const migration of migrations) {
        if (migration.feature) {
            featureCounts.set(migration.feature, (featureCounts.get(migration.feature) || 0) + 1);
        }
    }

    let summary = `Migration Plan for ${options.config.appId}:\n`;
    summary += `  Total migrations: ${migrations.length}\n`;
    summary += `  Core migrations: ${coreCount}\n`;

    for (const [feature, count] of featureCounts) {
        summary += `  Feature "${feature}": ${count} migrations\n`;
    }

    summary += `\nMigration order:\n`;
    for (const migration of migrations) {
        const source = migration.feature ? `[${migration.feature}]` : '[core]';
        summary += `  ${migration.version} ${source} ${migration.filename}\n`;
    }

    return { migrations, summary };
}

/**
 * Create a combined migration SQL file for an app
 */
export async function createCombinedMigration(
    options: DiscoverMigrationsOptions & { outputPath: string },
): Promise<string> {
    const migrations = await discoverMigrations(options);

    let combinedSql = `-- ============================================================\n`;
    combinedSql += `-- Combined Migrations for ${options.config.appId}\n`;
    combinedSql += `-- Generated at: ${new Date().toISOString()}\n`;
    combinedSql += `-- ============================================================\n\n`;

    // Create migrations tracking table
    combinedSql += `-- Migrations tracking table\n`;
    combinedSql += `CREATE TABLE IF NOT EXISTS _ottabase_migrations (\n`;
    combinedSql += `  id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
    combinedSql += `  name TEXT NOT NULL UNIQUE,\n`;
    combinedSql += `  feature TEXT,\n`;
    combinedSql += `  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP\n`;
    combinedSql += `);\n\n`;

    for (const migration of migrations) {
        const source = migration.feature ? `[${migration.feature}]` : '[core]';
        combinedSql += `-- ============================================================\n`;
        combinedSql += `-- Migration: ${migration.filename} ${source}\n`;
        combinedSql += `-- ============================================================\n\n`;
        combinedSql += migration.content;
        combinedSql += `\n\n`;

        // Record migration
        const featureValue = migration.feature ? `'${migration.feature}'` : 'NULL';
        combinedSql += `INSERT OR IGNORE INTO _ottabase_migrations (name, feature) VALUES ('${migration.filename}', ${featureValue});\n\n`;
    }

    // Write to output file
    const outputDir = path.dirname(options.outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(options.outputPath, combinedSql);

    return combinedSql;
}

/**
 * Get list of applied migrations from the database
 */
export async function getAppliedMigrations(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: any,
): Promise<Set<string>> {
    try {
        const result = await db.prepare('SELECT name FROM _ottabase_migrations').all();
        return new Set(result.results?.map((r: { name: string }) => r.name) || []);
    } catch {
        // Table doesn't exist yet
        return new Set();
    }
}

/**
 * Run migrations against a D1 database
 */
export async function runD1Migrations(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    d1: any,
    migrations: MigrationFile[],
    options: { dryRun?: boolean } = {},
): Promise<MigrationResult> {
    const result: MigrationResult = {
        success: true,
        applied: [],
        skipped: [],
        errors: [],
    };

    // Ensure migrations table exists
    if (!options.dryRun) {
        // Using .batch() instead of .exec() to avoid Wrangler dev mode duration metadata error
        await d1.batch([
            d1.prepare(`
        CREATE TABLE IF NOT EXISTS _ottabase_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          feature TEXT,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `),
        ]);
    }

    // Get already applied migrations
    const applied = await getAppliedMigrations(d1);

    for (const migration of migrations) {
        if (applied.has(migration.filename)) {
            result.skipped.push(migration);
            continue;
        }

        if (options.dryRun) {
            result.applied.push(migration);
            continue;
        }

        try {
            // Run the migration
            // Using .batch() instead of .exec() to avoid Wrangler dev mode duration metadata error
            await d1.batch([d1.prepare(migration.content)]);

            // Record the migration
            const featureValue = migration.feature ? `'${migration.feature}'` : 'NULL';
            await d1.batch([
                d1.prepare(
                    `INSERT INTO _ottabase_migrations (name, feature) VALUES ('${migration.filename}', ${featureValue})`,
                ),
            ]);

            result.applied.push(migration);
        } catch (error) {
            result.success = false;
            result.errors.push({
                migration,
                error: error instanceof Error ? error : new Error(String(error)),
            });
            // Stop on first error
            break;
        }
    }

    return result;
}

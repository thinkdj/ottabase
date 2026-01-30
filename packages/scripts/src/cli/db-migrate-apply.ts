#!/usr/bin/env node
// ============================================================
// @ottabase/scripts - DB Migration Apply CLI
// ============================================================
//
// Apply existing migrations to Cloudflare D1 database.
// Can apply latest migration or specific migration file.
//
// ============================================================

import type { AppDbConfig } from '@ottabase/db/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
    executeD1Migration,
    getMigrationFiles,
    isWranglerAvailable,
    validateD1Binding,
} from '../migrations/d1-executor';

// ============================================================
// CONFIG LOADING
// ============================================================

async function loadAppDbConfig(configPath: string): Promise<AppDbConfig> {
    try {
        delete require.cache[require.resolve(configPath)];
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const config = require(configPath);
        return config.default || config;
    } catch (error) {
        throw new Error(`Failed to load config from ${configPath}: ${(error as Error).message}`);
    }
}

// ============================================================
// MAIN CLI
// ============================================================

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const cwd = args.find((a) => !a.startsWith('-') && !a.startsWith('--')) || process.cwd();
    const verbose = args.includes('--verbose') || args.includes('-v');
    const help = args.includes('--help') || args.includes('-h');
    const remote = args.includes('--remote');
    const fileArg = args.find((a) => a.startsWith('--file='));
    const migrationFile = fileArg ? fileArg.split('=')[1] : undefined;

    if (help) {
        console.log(`
🚀 Ottabase DB Migration Apply

Apply existing migrations to Cloudflare D1 database.

Usage:
  db-migrate:apply [app-dir] [options]

Options:
  --file=<path>     Specific migration file or directory to apply
  --remote          Apply to remote D1 (production) instead of local
  --verbose, -v     Show detailed output
  --help, -h        Show this help message

Examples:
  db-migrate:apply                                    # Apply latest migration
  db-migrate:apply --remote                           # Apply to production
  db-migrate:apply --file=prisma/migrations/20250129_add_auth/migration.sql
  db-migrate:apply --file=prisma/migrations/20250129_add_auth
`);
        process.exit(0);
    }

    console.log('🚀 Ottabase DB Migration Apply\n');

    const appDir = path.resolve(cwd);

    // Find configuration
    const configPath = path.join(appDir, 'db.config.ts');
    const configPathJs = path.join(appDir, 'db.config.js');

    let config: AppDbConfig | null = null;

    if (existsSync(configPath)) {
        config = await loadAppDbConfig(configPath);
    } else if (existsSync(configPathJs)) {
        config = await loadAppDbConfig(configPathJs);
    } else {
        console.error('❌ No db.config.ts found.');
        process.exit(1);
    }

    // Check if wrangler is available
    if (!isWranglerAvailable()) {
        console.error('❌ Error: wrangler CLI not found. Install with: npm install -g wrangler');
        process.exit(1);
    }

    // Get D1 database name from config
    const d1Database = (config as any).d1Database || 'DB';
    const wranglerConfig = (config as any).wranglerConfig;

    // Validate D1 binding
    const validation = validateD1Binding(d1Database, appDir, wranglerConfig);

    if (!validation.valid) {
        console.error(`❌ Error: ${validation.error}`);
        process.exit(1);
    }

    console.log(`📁 App: ${config.appId}`);
    console.log(`💾 Database: ${validation.database || d1Database}`);
    console.log(`🌍 Environment: ${remote ? 'Remote (Production)' : 'Local (Dev)'}`);

    try {
        let migrationPath: string;

        if (migrationFile) {
            // Apply specific migration file
            migrationPath = path.isAbsolute(migrationFile) ? migrationFile : path.join(appDir, migrationFile);

            if (!existsSync(migrationPath)) {
                console.error(`❌ Migration file not found: ${migrationPath}`);
                process.exit(1);
            }

            console.log(`\n📄 Applying: ${path.basename(migrationPath)}`);
        } else {
            // Apply latest migration
            const migrations = getMigrationFiles(appDir);

            if (migrations.length === 0) {
                console.log('\n✅ No migrations found.');
                process.exit(0);
            }

            // Get the latest migration
            const latestMigration = migrations[migrations.length - 1];
            migrationPath = latestMigration.path;

            console.log(`\n📄 Applying latest migration: ${latestMigration.name}`);
        }

        // Execute migration
        await executeD1Migration({
            migrationPath,
            database: d1Database,
            remote,
            wranglerConfig,
            cwd: appDir,
            verbose,
        });

        console.log('\n✅ Migration applied successfully!');
        console.log('\n✨ Done!');
    } catch (error) {
        console.error('\n❌ Error:', (error as Error).message);
        if (verbose) {
            console.error((error as Error).stack);
        }
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});

#!/usr/bin/env node
// ============================================================
// @ottabase/scripts - DB Migration Status CLI
// ============================================================
//
// Check status of migrations - which are pending, which are applied.
// Shows migration history and helps track database state.
//
// ============================================================

import type { AppDbConfig } from '@ottabase/db/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getMigrationFiles, validateD1Binding, type MigrationStatus } from '../migrations/d1-executor';

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
// DISPLAY HELPERS
// ============================================================

/**
 * Format migration status for display
 */
function formatMigrationStatus(migration: MigrationStatus): string {
    const icon = migration.applied ? '✅' : '⏳';
    const status = migration.applied ? 'Applied' : 'Pending';
    const date = migration.appliedAt ? ` (${migration.appliedAt.toISOString().split('T')[0]})` : '';

    return `${icon} ${migration.name} - ${status}${date}`;
}

/**
 * Display migration summary
 */
function displaySummary(migrations: MigrationStatus[]): void {
    const applied = migrations.filter((m) => m.applied).length;
    const pending = migrations.filter((m) => !m.applied).length;

    console.log('\n📊 Summary:');
    console.log(`   Total migrations: ${migrations.length}`);
    console.log(`   Applied: ${applied}`);
    console.log(`   Pending: ${pending}`);
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

    if (help) {
        console.log(`
📊 Ottabase DB Migration Status

Check status of database migrations - pending and applied.

Usage:
  db-migrate:status [app-dir] [options]

Options:
  --remote          Check remote D1 (production) instead of local
  --verbose, -v     Show detailed output
  --help, -h        Show this help message

Examples:
  db-migrate:status              # Check local migration status
  db-migrate:status --remote     # Check production migration status
`);
        process.exit(0);
    }

    console.log('📊 Ottabase DB Migration Status\n');

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

    // Get D1 database name from config
    const d1Database = (config as any).d1Database || 'DB';
    const wranglerConfig = (config as any).wranglerConfig;

    // Validate D1 binding
    const validation = validateD1Binding(d1Database, appDir, wranglerConfig);

    if (!validation.valid) {
        console.warn(`⚠️  Warning: ${validation.error}`);
        console.log('   Showing local migration files only.\n');
    } else {
        console.log(`📁 App: ${config.appId}`);
        console.log(`💾 Database: ${validation.database || d1Database}`);
        console.log(`🌍 Environment: ${remote ? 'Remote (Production)' : 'Local (Dev)'}`);
    }

    try {
        // Get migration files
        const migrations = getMigrationFiles(appDir);

        if (migrations.length === 0) {
            console.log('\n✅ No migrations found.');
            console.log('\nCreate your first migration with: pnpm db:migrate --name=initial');
            process.exit(0);
        }

        console.log('\n📋 Migrations:\n');

        // Display each migration
        for (const migration of migrations) {
            console.log(`   ${formatMigrationStatus(migration)}`);
            if (verbose) {
                console.log(`      Path: ${migration.path}`);
            }
        }

        // Display summary
        displaySummary(migrations);

        // Show next steps if there are pending migrations
        const pending = migrations.filter((m) => !m.applied);
        if (pending.length > 0) {
            console.log('\n💡 Next steps:');
            console.log('   Apply pending migrations with: pnpm db:migrate:apply');
            if (!remote) {
                console.log('   Or apply to production with: pnpm db:migrate:apply --remote');
            }
        }

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

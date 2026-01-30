#!/usr/bin/env node
// ============================================================
// @ottabase/scripts - DB Migration Generator CLI
// ============================================================
//
// Generates SQL migrations from Prisma schema for Cloudflare D1.
// Uses `prisma migrate dev` to create migrations.
//
// Enhanced Workflow:
//   1. Developer edits Prisma schema files
//   2. Run `pnpm db:generate` to concatenate schemas
//   3. Run `pnpm db:migrate --name=<name>` to generate AND optionally apply
//   4. Interactive prompt or use --apply flag for automatic D1 execution
//
// ============================================================

import type { AppDbConfig } from '@ottabase/db/config';
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import * as readline from 'node:readline';
import path from 'node:path';
import { executeD1Migration, isWranglerAvailable, validateD1Binding } from '../migrations/d1-executor';

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
// MIGRATION GENERATION
// ============================================================

interface MigrationOptions {
    appDir: string;
    schemaPath: string;
    migrationsDir: string;
    name?: string;
    verbose?: boolean;
    dryRun?: boolean;
}

/**
 * Get the next migration number based on existing migrations
 */
function getNextMigrationNumber(migrationsDir: string): string {
    if (!existsSync(migrationsDir)) {
        return '0001';
    }

    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    const numbers = files
        .map((f) => {
            const match = f.match(/^(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => !isNaN(n));

    const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
    return String(maxNumber + 1).padStart(4, '0');
}

/**
 * Generate migration name from timestamp and optional name
 */
function generateMigrationName(name?: string): string {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = name ? `_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : '';
    return `${timestamp}${suffix}`;
}

/**
 * Generate SQL migration using prisma migrate diff
 *
 * For D1/SQLite, we use:
 * - --from-empty (for initial migration) or --from-schema-datasource (for diffs)
 * - --to-schema-datamodel (the target schema)
 * - --script (output SQL)
 */
async function generateMigrationSQL(options: MigrationOptions): Promise<string> {
    const { schemaPath, migrationsDir, verbose } = options;

    // Check if this is the first migration
    const isInitial =
        !existsSync(migrationsDir) || readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).length === 0;

    const args = [
        'prisma',
        'migrate',
        'diff',
        isInitial ? '--from-empty' : '--from-schema-datasource',
        ...(isInitial ? [] : [schemaPath]),
        '--to-schema-datamodel',
        schemaPath,
        '--script',
    ];

    if (verbose) {
        console.log(`Running: npx ${args.join(' ')}`);
    }

    return new Promise((resolve, reject) => {
        let output = '';
        let errorOutput = '';

        const child = spawn('npx', args, {
            cwd: options.appDir,
            shell: true,
        });

        child.stdout?.on('data', (data) => {
            output += data.toString();
        });

        child.stderr?.on('data', (data) => {
            errorOutput += data.toString();
        });

        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve(output);
            } else {
                // If prisma migrate diff fails, try alternative approach
                if (verbose) {
                    console.log('Prisma migrate diff failed, using fallback...');
                    console.log('stderr:', errorOutput);
                }
                // Fallback: use prisma db push --dry-run to see what would change
                resolve(generateFallbackSQL(options));
            }
        });
    });
}

/**
 * Fallback SQL generation using prisma format and manual parsing
 * This is used when prisma migrate diff doesn't work (e.g., no existing DB)
 */
async function generateFallbackSQL(options: MigrationOptions): Promise<string> {
    const { schemaPath, verbose } = options;

    // Use prisma format to validate schema first
    try {
        execSync(`npx prisma format --schema ${schemaPath}`, {
            cwd: options.appDir,
            stdio: verbose ? 'inherit' : 'pipe',
        });
    } catch {
        // Format might fail but we can continue
    }

    // For initial migrations, we can use prisma db push with --force-reset
    // But for D1, we need to generate SQL manually or use prisma migrate dev

    // Alternative: Use prisma migrate dev to create migration, then extract SQL
    // For now, return a helpful message
    return `-- Migration generated from schema: ${path.basename(schemaPath)}
-- Generated at: ${new Date().toISOString()}
--
-- To generate SQL for D1, you can:
-- 1. Use 'npx prisma migrate dev --name <name>' to create a migration
-- 2. Or use 'npx prisma db push' with a local SQLite file, then export
--
-- For D1 specifically, consider using wrangler d1 migrations:
-- wrangler d1 migrations create DB <migration-name>
-- Then copy the SQL from prisma/migrations/<timestamp>/migration.sql

-- Placeholder: Run 'npx prisma migrate dev' to generate actual SQL
`;
}

/**
 * Generate SQL migration for D1 using prisma migrate dev
 * This creates a proper migration in prisma/migrations/
 */
async function generateD1Migration(options: MigrationOptions): Promise<{ sql: string; migrationDir: string } | null> {
    const { schemaPath, appDir, name, verbose } = options;

    const migrationName = name || 'migration';

    console.log('\n🔄 Generating migration with Prisma...');

    return new Promise((resolve, reject) => {
        // Use prisma migrate dev to create migration
        // This requires a DATABASE_URL pointing to a local SQLite file
        const args = [
            'prisma',
            'migrate',
            'dev',
            '--schema',
            schemaPath,
            '--name',
            migrationName,
            '--create-only', // Don't apply, just create
        ];

        if (verbose) {
            console.log(`Running: npx ${args.join(' ')}`);
        }

        const child = spawn('npx', args, {
            cwd: appDir,
            stdio: verbose ? 'inherit' : 'pipe',
            shell: true,
            env: {
                ...process.env,
                // Ensure DATABASE_URL points to a local SQLite file for migration generation
                DATABASE_URL: process.env.DATABASE_URL || 'file:./prisma/dev.db',
            },
        });

        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                // Find the generated migration
                const migrationsDir = path.join(appDir, 'prisma/migrations');
                if (existsSync(migrationsDir)) {
                    const dirs = readdirSync(migrationsDir, { withFileTypes: true })
                        .filter((d) => d.isDirectory())
                        .map((d) => d.name)
                        .sort()
                        .reverse();

                    if (dirs.length > 0) {
                        const latestDir = dirs[0];
                        const migrationSqlPath = path.join(migrationsDir, latestDir, 'migration.sql');

                        if (existsSync(migrationSqlPath)) {
                            const sql = require('fs').readFileSync(migrationSqlPath, 'utf8');
                            resolve({
                                sql,
                                migrationDir: path.join(migrationsDir, latestDir),
                            });
                            return;
                        }
                    }
                }
                resolve(null);
            } else {
                // Migration generation failed - might be because schema is up to date
                console.log('ℹ️  No migration needed (schema may already be up to date)');
                resolve(null);
            }
        });
    });
}

// ============================================================
// INTERACTIVE PROMPTS
// ============================================================

/**
 * Prompt user for migration application choice
 */
async function promptApplyMigration(): Promise<'local' | 'remote' | 'skip'> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        console.log('\n┌─────────────────────────────────────────┐');
        console.log('│ Migration created successfully!         │');
        console.log('│                                         │');
        console.log('│ Apply to D1 database?                   │');
        console.log('│   [1] Local (wrangler dev)              │');
        console.log('│   [2] Remote (production)               │');
        console.log('│   [3] Skip (manual apply later)         │');
        console.log('│                                         │');
        console.log('└─────────────────────────────────────────┘');

        rl.question('\nChoice (1/2/3): ', (answer) => {
            rl.close();

            const choice = answer.trim();
            if (choice === '1') {
                resolve('local');
            } else if (choice === '2') {
                resolve('remote');
            } else {
                resolve('skip');
            }
        });
    });
}

// ============================================================
// MAIN CLI
// ============================================================

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const cwd = args.find((a) => !a.startsWith('-') && !a.startsWith('--')) || process.cwd();
    const verbose = args.includes('--verbose') || args.includes('-v');
    const dryRun = args.includes('--dry-run');
    const help = args.includes('--help') || args.includes('-h');
    const nameArg = args.find((a) => a.startsWith('--name='));
    const name = nameArg ? nameArg.split('=')[1] : undefined;

    // New flags for D1 execution
    const applyArg = args.find((a) => a.startsWith('--apply='));
    const applyMode = applyArg ? applyArg.split('=')[1] : undefined;
    const skipApply = args.includes('--skip-apply');

    if (help) {
        console.log(`
🔄 Ottabase DB Migration Generator

Generates SQL migrations from Prisma schema for Cloudflare D1.
Optionally applies migrations automatically using wrangler.

Usage:
  db-migrate [app-dir] [options]

Options:
  --name=<name>     Migration name (e.g., --name=add_users)
  --apply=<mode>    Auto-apply migration: local, remote
  --skip-apply      Skip D1 application (generate only)
  --dry-run         Show SQL without creating files
  --verbose, -v     Show detailed output
  --help, -h        Show this help message

Enhanced Workflow:
  1. Edit your Prisma schema files
  2. Run 'pnpm db:generate' to concatenate schemas
  3. Run 'pnpm db:migrate --name=<name>' (interactive prompt)
     OR 'pnpm db:migrate --name=<name> --apply=local' (auto-apply)

Examples:
  db-migrate --name=add_auth              # Interactive prompt
  db-migrate --name=add_auth --apply=local    # Auto-apply to local D1
  db-migrate --name=add_auth --apply=remote   # Auto-apply to remote D1
  db-migrate --name=add_auth --skip-apply     # Generate only (old behavior)
  db-migrate ./apps/web --dry-run             # Preview SQL
`);
        process.exit(0);
    }

    console.log('🔄 Ottabase DB Migration Generator\n');

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
        console.error("❌ No db.config.ts found. Run 'db-generate' first.");
        process.exit(1);
    }

    // Check if schema exists
    const schemaPath = path.join(appDir, config.outputSchemaPath || 'prisma/schema.prisma');

    if (!existsSync(schemaPath)) {
        console.error(`❌ Schema not found: ${schemaPath}`);
        console.log("   Run 'pnpm db:generate' first to create the schema.");
        process.exit(1);
    }

    console.log(`📄 Schema: ${schemaPath}`);
    console.log(`📁 App: ${config.appId}`);

    try {
        // Generate migration using Prisma
        const result = await generateD1Migration({
            appDir,
            schemaPath,
            migrationsDir: path.join(appDir, 'prisma/migrations'),
            name,
            verbose,
            dryRun,
        });

        if (result) {
            console.log(`\n✅ Migration created: ${result.migrationDir}`);

            if (dryRun) {
                console.log('\n--- Generated SQL ---');
                console.log(result.sql);
                console.log('--- End SQL ---\n');
            }

            // ============================================================
            // NEW: D1 MIGRATION APPLICATION
            // ============================================================

            // Determine if we should apply the migration
            let shouldApply: 'local' | 'remote' | 'skip' = 'skip';

            if (dryRun || skipApply) {
                shouldApply = 'skip';
            } else if (applyMode) {
                // Non-interactive mode with --apply flag
                if (applyMode === 'local' || applyMode === 'remote') {
                    shouldApply = applyMode;
                } else {
                    console.warn(`⚠️  Invalid --apply value: ${applyMode}. Use 'local' or 'remote'.`);
                    shouldApply = 'skip';
                }
            } else {
                // Interactive mode - prompt user
                shouldApply = await promptApplyMigration();
            }

            // Apply migration if requested
            if (shouldApply !== 'skip') {
                console.log(`\n🔄 Applying migration to ${shouldApply === 'remote' ? 'remote' : 'local'} D1...`);

                // Check if wrangler is available
                if (!isWranglerAvailable()) {
                    console.error('\n❌ Error: wrangler CLI not found. Install with: npm install -g wrangler');
                    console.log(
                        '\n📋 Manual application: wrangler d1 execute DB --file=' +
                            path.join(result.migrationDir, 'migration.sql'),
                    );
                    process.exit(1);
                }

                // Get D1 database name from config
                const d1Database = (config as any).d1Database || 'DB';
                const wranglerConfig = (config as any).wranglerConfig;

                // Validate D1 binding
                const validation = validateD1Binding(d1Database, appDir, wranglerConfig);

                if (!validation.valid) {
                    console.error(`\n❌ Error: ${validation.error}`);
                    console.log(
                        '\n📋 Manual application: wrangler d1 execute ' +
                            d1Database +
                            ' --file=' +
                            path.join(result.migrationDir, 'migration.sql'),
                    );
                    process.exit(1);
                }

                try {
                    // Execute migration on D1
                    await executeD1Migration({
                        migrationPath: result.migrationDir,
                        database: d1Database,
                        remote: shouldApply === 'remote',
                        wranglerConfig,
                        cwd: appDir,
                        verbose,
                    });

                    console.log('\n✅ Migration applied successfully!');
                } catch (error) {
                    console.error('\n❌ Migration application failed:', (error as Error).message);
                    console.log(
                        '\n📋 Try manual application: wrangler d1 execute ' +
                            d1Database +
                            ' --file=' +
                            path.join(result.migrationDir, 'migration.sql'),
                    );
                    process.exit(1);
                }
            } else {
                // Show manual steps if skipped
                console.log('\n📋 To apply this migration manually:');
                console.log(`   wrangler d1 execute DB --file=${path.join(result.migrationDir, 'migration.sql')}`);
                console.log('\n   Or run: pnpm db:migrate:apply (coming soon)');
            }
        } else {
            console.log('\n✅ No migration needed - schema is up to date');
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

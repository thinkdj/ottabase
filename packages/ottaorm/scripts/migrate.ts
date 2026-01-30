#!/usr/bin/env node
// ============================================================
// OttaORM - Migration CLI
// ============================================================
//
// Usage:
//   pnpm ottaorm:migrate              - Full workflow (schema + migrations + bundle)
//   pnpm ottaorm:migrate:schema       - Generate schema only
//   pnpm ottaorm:migrate:generate     - Generate migrations only
//   pnpm ottaorm:migrate:bundle       - Bundle migrations only
//
// This script automates the entire migration workflow for OttaORM.
// ============================================================

import {
    generateAllMigrations,
    generateSchema,
    generateMigrations,
    bundleMigrations,
} from '../src/migrations/auto-generator';

const command = process.argv[2] || 'all';

const config = {
    ottabasePath: './ottabase',
    drizzleConfigPath: './drizzle.config.ts',
    includeCoreModels: true,
    modelsDir: 'models',
    schemaOutput: 'db/schema.ts',
    migrationsDir: 'migrations',
};

async function main() {
    console.log('🔧 OttaORM Migration Tool\n');

    try {
        switch (command) {
            case 'all':
                await generateAllMigrations(config);
                break;

            case 'schema':
                await generateSchema(config);
                break;

            case 'generate':
                await generateMigrations(config);
                break;

            case 'bundle':
                await bundleMigrations(config);
                break;

            default:
                console.error(`Unknown command: ${command}`);
                console.log('\nAvailable commands:');
                console.log('  all        - Run full workflow (default)');
                console.log('  schema     - Generate schema only');
                console.log('  generate   - Generate migrations only');
                console.log('  bundle     - Bundle migrations only');
                process.exit(1);
        }
    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

main();

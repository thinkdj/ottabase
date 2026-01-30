#!/usr/bin/env node
// ============================================================
// @ottabase/scripts - DB Schema Generator CLI
// ============================================================

import type { AppDbConfig } from '@ottabase/db/config';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { concatenateAppSchema } from '../schema/concatenate';

// ============================================================
// CONFIG LOADING
// ============================================================

/**
 * Load app database configuration from db.config.ts or db.config.js
 */
async function loadAppDbConfig(configPath: string): Promise<AppDbConfig> {
    try {
        // Clear require cache to ensure fresh load
        delete require.cache[require.resolve(configPath)];
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const config = require(configPath);
        return config.default || config;
    } catch (error) {
        throw new Error(`Failed to load config from ${configPath}: ${(error as Error).message}`);
    }
}

// ============================================================
// PRISMA GENERATE
// ============================================================

/**
 * Run prisma generate command
 */
function runPrismaGenerate(schemaPath: string, cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log('\n🔄 Running prisma generate...');

        const child = spawn('npx', ['prisma', 'generate', '--schema', schemaPath], {
            cwd,
            stdio: 'inherit',
            shell: true,
        });

        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Prisma generate exited with code ${code}`));
            }
        });
    });
}

// ============================================================
// MAIN CLI
// ============================================================

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const cwd = args.find((a) => !a.startsWith('-')) || process.cwd();
    const verbose = args.includes('--verbose') || args.includes('-v');
    const skipGenerate = args.includes('--skip-generate');
    const help = args.includes('--help') || args.includes('-h');

    if (help) {
        console.log(`
🔧 Ottabase DB Schema Generator

Usage:
  db-generate [app-dir] [options]

Options:
  --verbose, -v      Show detailed output
  --skip-generate    Skip running prisma generate
  --help, -h         Show this help message

Examples:
  db-generate                    # Generate in current directory
  db-generate ./apps/web         # Generate for specific app
  db-generate -v                 # Verbose output
`);
        process.exit(0);
    }

    console.log('🔧 Ottabase DB Schema Generator\n');

    // Resolve app directory
    const appDir = path.resolve(cwd);

    // Find configuration file
    const configPath = path.join(appDir, 'db.config.ts');
    const configPathJs = path.join(appDir, 'db.config.js');

    let config: AppDbConfig | null = null;

    if (existsSync(configPath)) {
        console.log(`📄 Loading config: ${configPath}`);
        config = await loadAppDbConfig(configPath);
    } else if (existsSync(configPathJs)) {
        console.log(`📄 Loading config: ${configPathJs}`);
        config = await loadAppDbConfig(configPathJs);
    } else {
        console.error('❌ No db.config.ts found.');
        console.log('\nCreate a db.config.ts file in your app directory:');
        console.log(`
import { defineAppDbConfig } from "@ottabase/db";

export default defineAppDbConfig({
  appId: "${path.basename(appDir)}",
  features: [], // Add features like "auth"
});
`);
        process.exit(1);
    }

    try {
        // Concatenate schemas
        const result = await concatenateAppSchema(config, {
            appDir,
            verbose,
            skipGenerate,
        });

        // Run prisma generate if not skipped
        if (!skipGenerate) {
            await runPrismaGenerate(result.outputPath, appDir);
            console.log('✅ Prisma client generated');
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

// Run CLI
main().catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});

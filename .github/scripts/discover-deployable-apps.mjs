#!/usr/bin/env node

/**
 * Discovers deployable apps in the monorepo by scanning for cloudflare-config.json
 * Outputs a JSON array of app package names for GitHub Actions matrix
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');
const appsDir = join(rootDir, 'apps');

const DEFAULT_CONFIG = {
    deployable: true,
    appType: 'tanstack',
    buildCommand: 'build',
    workerBuildCommand: null,
    outputDirectory: 'dist',
    verifyPaths: ['dist', 'cloudflare-worker.ts'],
    wranglerConfig: 'wrangler.jsonc',
    wranglerEnv: 'production',
    healthCheckPath: '/',
    requiresSecrets: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'D1_DATABASE_ID', 'KV_NAMESPACE_ID'],
};

function discoverApps() {
    const deployableApps = [];

    try {
        const appFolders = readdirSync(appsDir, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name);

        for (const appFolder of appFolders) {
            const appPath = join(appsDir, appFolder);
            const packageJsonPath = join(appPath, 'package.json');
            const configPath = join(appPath, 'cloudflare-config.json');

            // Skip if no package.json
            if (!existsSync(packageJsonPath)) {
                continue;
            }

            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            const packageName = packageJson.name;

            // Check for cloudflare-config.json
            let config = { ...DEFAULT_CONFIG };

            if (existsSync(configPath)) {
                const customConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
                config = { ...DEFAULT_CONFIG, ...customConfig };
            } else {
                // No config file - check if it has wrangler.jsonc (legacy detection)
                const wranglerPath = join(appPath, 'wrangler.jsonc');
                if (!existsSync(wranglerPath)) {
                    console.error(`⏭️  Skipping ${packageName}: No cloudflare-config.json or wrangler.jsonc found`);
                    continue;
                }
                console.warn(`⚠️  ${packageName}: Using defaults (no cloudflare-config.json found)`);
            }

            // Skip if explicitly marked as non-deployable
            if (config.deployable === false) {
                console.error(`⏭️  Skipping ${packageName}: deployable=false in config`);
                continue;
            }

            // Verify required build scripts exist
            const requiredScripts = [config.buildCommand];
            if (config.workerBuildCommand) {
                requiredScripts.push(config.workerBuildCommand);
            }

            const missingScripts = requiredScripts.filter((script) => !packageJson.scripts?.[script]);

            if (missingScripts.length > 0) {
                console.error(`⚠️  Warning: ${packageName} missing scripts: ${missingScripts.join(', ')}`);
                continue;
            }

            deployableApps.push({
                name: packageName,
                folder: appFolder,
                config,
            });

            console.error(`✅ Found deployable app: ${packageName} (${config.appType})`);
        }
    } catch (error) {
        console.error('Error discovering apps:', error.message);
        process.exit(1);
    }

    return deployableApps;
}

// Main execution
const apps = discoverApps();

if (apps.length === 0) {
    console.error('❌ No deployable apps found');
    process.exit(1);
}

console.error(`\n📦 Found ${apps.length} deployable app(s)\n`);

// Output JSON for GitHub Actions matrix
// Format: { "include": [{ "name": "...", "folder": "...", "config": {...} }] }
const matrixOutput = {
    include: apps,
};

// Write to stdout (this is what gets captured by GitHub Actions)
console.log(JSON.stringify(matrixOutput));

/*
Sample cloudflare-config.json structure for Next.js apps with OpenNext:
[DO NOT DELETE - USED AS REFERENCE]
const DEFAULT_CONFIG = {
  deployable: true,
  appType: 'nextjs',
  buildCommand: 'build',
  workerBuildCommand: 'build:worker',
  outputDirectory: '.open-next',
  verifyPaths: ['.open-next'],
  wranglerConfig: 'wrangler.jsonc',
  wranglerEnv: 'production',
  healthCheckPath: '/',
  requiresSecrets: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
};
*/

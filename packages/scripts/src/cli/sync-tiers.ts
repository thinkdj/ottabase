#!/usr/bin/env node
/**
 * sync-tiers – Validate and report on package tiers from ottabase.manifest.json.
 *
 * Usage:
 *   pnpm sync-tiers                 # Validate manifest against actual packages
 *   pnpm sync-tiers --tier community # List community-tier packages
 *   pnpm sync-tiers --tier pro       # List pro-tier packages
 *
 * This tool helps maintain the open-source vs PRO distribution split:
 * - Validates that all packages in packages/ are listed in the manifest
 * - Reports any packages missing from the manifest
 * - Ensures no community package depends on a pro package
 */
import fs from 'fs';
import path from 'path';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

function log(msg: string, color: string = NC) {
    console.log(`${color}${msg}${NC}`);
}

interface ManifestEntry {
    tier: 'community' | 'pro';
    description?: string;
}

interface Manifest {
    packages: Record<string, ManifestEntry>;
}

async function main() {
    const args = process.argv.slice(2);
    let filterTier = '';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--tier' && args[i + 1]) {
            filterTier = args[i + 1];
            i++;
        }
    }

    // Find monorepo root
    let root = process.cwd();
    while (!fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))) {
        const parent = path.dirname(root);
        if (parent === root) {
            log(`${RED}Error: Could not find monorepo root.${NC}`);
            process.exit(1);
        }
        root = parent;
    }

    const manifestPath = path.join(root, 'ottabase.manifest.json');
    if (!fs.existsSync(manifestPath)) {
        log(`${RED}Error: ottabase.manifest.json not found at ${manifestPath}${NC}`);
        process.exit(1);
    }

    const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    // Scan actual packages
    const packagesDir = path.join(root, 'packages');
    const actualPackages: Map<string, string> = new Map(); // name -> directory

    if (fs.existsSync(packagesDir)) {
        const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const pkgJsonPath = path.join(packagesDir, entry.name, 'package.json');
                if (fs.existsSync(pkgJsonPath)) {
                    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
                    actualPackages.set(pkgJson.name, entry.name);
                }
            }
        }
    }

    // If filtering by tier, just list and exit
    if (filterTier) {
        log('');
        log(`${BOLD}${CYAN}Packages in "${filterTier}" tier:${NC}`);
        log('');
        const filtered = Object.entries(manifest.packages)
            .filter(([, entry]) => entry.tier === filterTier)
            .sort(([a], [b]) => a.localeCompare(b));

        if (filtered.length === 0) {
            log(`  No packages found in tier "${filterTier}"`, YELLOW);
        } else {
            for (const [name, entry] of filtered) {
                log(`  ${name}${entry.description ? ` – ${entry.description}` : ''}`);
            }
        }
        log('');
        log(`Total: ${filtered.length} packages`, CYAN);
        log('');
        return;
    }

    // Full validation mode
    log('');
    log(`${BOLD}${CYAN}📋 Ottabase Package Tier Validation${NC}`);
    log('');

    let hasErrors = false;

    // Check for packages in filesystem but missing from manifest
    const missing: string[] = [];
    for (const [name] of actualPackages) {
        if (!manifest.packages[name]) {
            missing.push(name);
        }
    }

    if (missing.length > 0) {
        log(`${YELLOW}⚠ Packages not in manifest (add to ottabase.manifest.json):${NC}`);
        for (const name of missing.sort()) {
            log(`  ${name}`, YELLOW);
        }
        log('');
        hasErrors = true;
    }

    // Check for packages in manifest but not in filesystem
    const extra: string[] = [];
    for (const name of Object.keys(manifest.packages)) {
        if (!actualPackages.has(name)) {
            extra.push(name);
        }
    }

    if (extra.length > 0) {
        log(`${YELLOW}⚠ Packages in manifest but not found in packages/:${NC}`);
        for (const name of extra.sort()) {
            log(`  ${name}`, YELLOW);
        }
        log('');
        hasErrors = true;
    }

    // Check that no community package depends on a pro package
    const proPackages = new Set(
        Object.entries(manifest.packages)
            .filter(([, entry]) => entry.tier === 'pro')
            .map(([name]) => name),
    );

    const violations: { community: string; dependsOn: string }[] = [];
    for (const [name, dir] of actualPackages) {
        const entry = manifest.packages[name];
        if (!entry || entry.tier !== 'community') continue;

        const pkgJsonPath = path.join(packagesDir, dir, 'package.json');
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

        const allDeps = {
            ...(pkgJson.dependencies || {}),
            ...(pkgJson.peerDependencies || {}),
        };

        for (const depName of Object.keys(allDeps)) {
            if (proPackages.has(depName)) {
                violations.push({ community: name, dependsOn: depName });
            }
        }
    }

    if (violations.length > 0) {
        log(`${RED}✗ Community packages depending on pro packages:${NC}`);
        for (const v of violations) {
            log(`  ${v.community} → ${v.dependsOn}`, RED);
        }
        log('');
        hasErrors = true;
    }

    // Summary
    const communityCount = Object.values(manifest.packages).filter((e) => e.tier === 'community').length;
    const proCount = Object.values(manifest.packages).filter((e) => e.tier === 'pro').length;

    log(`${BOLD}Summary:${NC}`);
    log(`  Community: ${communityCount} packages`);
    log(`  Pro:       ${proCount} packages`);
    log(`  Total:     ${communityCount + proCount} packages`);
    log('');

    if (!hasErrors) {
        log(`${GREEN}✓ All packages validated successfully.${NC}`);
    } else {
        log(`${YELLOW}⚠ Validation completed with warnings.${NC}`);
    }
    log('');
}

main().catch((err) => {
    console.error('sync-tiers failed:', err);
    process.exit(1);
});

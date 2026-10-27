import fs from 'fs-extra';
import path from 'path';
import { colors } from '../utils/index.js';
import { readFootprints } from './footprints.js';

/**
 * A preset is what `otta new web <name> --preset <preset>` KEEPS of the otta-web template. The
 * demo gallery and every package not listed are stripped (`otta strip`), so the app starts with
 * what it needs and grows with `otta add`. The core of the template is never stripped: auth,
 * organizations and RBAC, the admin shell, Brand Engine, the app's own package.
 */
export interface Preset {
    description: string;
    /** Package keys kept, beyond the core. */
    keep: string[];
}

/** Keys that are the template itself, never stripped. */
export const CORE_KEYS = ['core', 'app', 'brand-engine'];

export const PRESETS: Record<string, Preset> = {
    minimal: {
        description: 'Auth, organizations and RBAC, the admin shell, Brand Engine. Nothing else.',
        keep: [],
    },
    blog: {
        description: 'minimal plus the blog and changelog, comments, and the legal pages.',
        keep: ['ottablog', 'comments', 'legal'],
    },
    saas: {
        description:
            'minimal plus what a product with customers needs: operator alerts, API keys, feature flags, usage ' +
            'metering, email hygiene, legal pages, referrals, backups, outbound webhooks.',
        keep: ['alerts', 'apikeys', 'flags', 'meter', 'postmaster', 'legal', 'referrals', 'vault', 'webhooks'],
    },
};

export function presetNames(): string[] {
    return Object.keys(PRESETS);
}

/** The package keys listed in an app's `ottabase/packages.ts` (`./packages/<key>` imports). */
export function listedPackageKeys(appDir: string): string[] {
    const list = path.join(appDir, 'ottabase', 'packages.ts');
    if (!fs.existsSync(list)) return [];
    return [...fs.readFileSync(list, 'utf8').matchAll(/from '\.\/packages\/([a-z0-9-]+)'/g)].map((m) => m[1]);
}

/** Everything a preset strips from an app: the demo, and every listed or footprinted key it does not keep. */
export function keysToStrip(appDir: string, preset: Preset): string[] {
    const keep = new Set([...CORE_KEYS, ...preset.keep]);
    const candidates = new Set(['demo', ...Object.keys(readFootprints(appDir)), ...listedPackageKeys(appDir)]);
    return [...candidates].filter((key) => !keep.has(key)).sort();
}

export function showPresets(): void {
    console.log(`\n${colors.bright}Presets for otta new web:${colors.reset}\n`);
    for (const [name, preset] of Object.entries(PRESETS)) {
        console.log(`  ${colors.cyan}${name}${colors.reset}`);
        console.log(`    ${colors.dim}${preset.description}${colors.reset}`);
        if (preset.keep.length) console.log(`    ${colors.dim}Keeps: ${preset.keep.join(', ')}${colors.reset}`);
        console.log('');
    }
    console.log(
        `${colors.dim}Always kept: ${CORE_KEYS.join(', ')}. Without a preset the whole template is copied.${colors.reset}`,
    );
    console.log(`${colors.dim}An API-only app is its own template: otta new worker <name>.${colors.reset}\n`);
}

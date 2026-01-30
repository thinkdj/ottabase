import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

type ScopeKind = 'package' | 'app';

type ScopeRecord = {
    kind: ScopeKind;
    dirName: string;
    root: string;
    packageJsonPath: string;
    packageJson: { name?: string } | null;
    packageName: string | null;
    title: string;
};

type ScopeResult = {
    rootDir: string;
    packagesRoot: string;
    appsRoot: string;
    allPackages: ScopeRecord[];
    allApps: ScopeRecord[];
    selectedPackages: ScopeRecord[];
    selectedApps: ScopeRecord[];
    primaryApp: ScopeRecord | null;
};

const ACRONYM_SEGMENTS = new Set(['ui', 'api', 'db', 'qa', 'ux', 'ssr', 'csr', 'cli']);

function humanizeSegment(segment: string): string {
    const lower = segment.toLowerCase();
    if (ACRONYM_SEGMENTS.has(lower)) {
        return lower.toUpperCase();
    }
    if (!segment.length) {
        return segment;
    }
    return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function humanize(value: string): string {
    return value
        .split(/[\\/]/)
        .map((part) =>
            part
                .split(/[-_\s]+/)
                .filter(Boolean)
                .map(humanizeSegment)
                .join(' '),
        )
        .filter(Boolean)
        .join(' / ');
}

function readJsonIfExists(filePath: string): any {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[storybook] Failed to read ${filePath}:`, error);
    }
    return null;
}

interface DirectoryEntry {
    dirName: string;
    root: string;
}

function listChildDirectories(rootDir: string): DirectoryEntry[] {
    try {
        return fs
            .readdirSync(rootDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
            .map((entry) => ({
                dirName: entry.name,
                root: path.join(rootDir, entry.name),
            }));
    } catch (error) {
        return [];
    }
}

function buildRecords(rootDir: string, kind: ScopeKind): ScopeRecord[] {
    return listChildDirectories(rootDir).map((entry) => {
        const packageJsonPath = path.join(entry.root, 'package.json');
        const packageJson = readJsonIfExists(packageJsonPath);
        return {
            kind,
            dirName: entry.dirName,
            root: entry.root,
            packageJsonPath,
            packageJson,
            packageName: packageJson && packageJson.name ? packageJson.name : null,
            title: humanize(entry.dirName),
        };
    });
}

function createLookup(records: ScopeRecord[]): Map<string, ScopeRecord> {
    const map = new Map();
    records.forEach((record) => {
        map.set(record.dirName, record);
        if (record.packageName) {
            map.set(record.packageName, record);
        }
        if (record.packageName && record.packageName.startsWith('@')) {
            const shortName = record.packageName.slice(1);
            map.set(shortName, record);
        }
    });
    return map;
}

export function filterRecords(records: ScopeRecord[], rawValue?: string): ScopeRecord[] {
    if (!rawValue || !rawValue.trim()) {
        return records;
    }

    const tokens = rawValue
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean);

    if (!tokens.length) {
        return records;
    }

    const lowered = tokens.map((token) => token.toLowerCase());
    if (lowered.includes('none') || lowered.includes('off')) {
        return [];
    }
    if (lowered.includes('*') || lowered.includes('all')) {
        return records;
    }

    const lookup = createLookup(records);
    const includes = tokens.filter((token) => !token.startsWith('-'));
    const excludes = tokens.filter((token) => token.startsWith('-')).map((token) => token.slice(1));

    let selected: ScopeRecord[];
    if (includes.length) {
        const seen = new Set();
        selected = [];
        includes.forEach((token) => {
            const record = lookup.get(token);
            if (record && !seen.has(record.dirName)) {
                seen.add(record.dirName);
                selected.push(record);
            }
        });
    } else {
        selected = [...records];
    }

    if (excludes.length) {
        const excludeSet = new Set();
        excludes.forEach((token) => {
            const record = lookup.get(token);
            if (record) {
                excludeSet.add(record.dirName);
            }
        });
        selected = selected.filter((record) => !excludeSet.has(record.dirName));
    }

    return selected;
}

function findRecord(records: ScopeRecord[], token?: string): ScopeRecord | null {
    if (!token) {
        return null;
    }
    const lookup = createLookup(records);
    return lookup.get(token) || null;
}

export function resolveScope(): ScopeResult {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const rootDir = path.resolve(__dirname, '..');
    const packagesRoot = path.join(rootDir, 'packages');
    const appsRoot = path.join(rootDir, 'apps');

    const allPackages = buildRecords(packagesRoot, 'package');
    const allApps = buildRecords(appsRoot, 'app');

    const selectedPackages = filterRecords(allPackages, process.env.STORYBOOK_PACKAGES);
    const selectedApps = filterRecords(allApps, process.env.STORYBOOK_APPS);

    const primaryToken = process.env.STORYBOOK_PRIMARY_APP;
    const primaryApp = primaryToken ? findRecord(allApps, primaryToken) : selectedApps[0] || null;

    return {
        rootDir,
        packagesRoot,
        appsRoot,
        allPackages,
        allApps,
        selectedPackages,
        selectedApps,
        primaryApp,
    };
}

export { listChildDirectories };

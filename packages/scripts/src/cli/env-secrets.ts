#!/usr/bin/env node
/**
 * env:secrets – Fill the target app's .env.local with development-safe secrets.
 *
 * Uses the app's .env.example as the source of truth for which keys exist, then generates
 * values for the allowlisted Ottabase secrets that are still empty. Existing values are
 * never overwritten, so the command is safe to re-run.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const APPS_DIR = 'apps';
const TEMPLATE_FILE = '.env.example';
const TARGET_FILE = '.env.local';

const ENV_ASSIGNMENT_RE = /^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/;

export const GENERATED_ENV_CONFIG = [
    { key: 'AUTH_SECRET', prefix: 'AUT' },
    { key: 'MIGRATION_SECRET', prefix: 'MIG' },
    { key: 'BOOTSTRAP_OWNER_SECRET', prefix: 'BOS' },
    { key: 'CRON_SECRET', prefix: 'CRN' },
    { key: 'AI_CREDENTIAL_SECRET', prefix: 'AIC' },
    { key: 'BLOG_PREVIEW_SECRET', prefix: '' },
] as const;

export const GENERATED_ENV_KEYS = GENERATED_ENV_CONFIG.map(({ key }) => key);
type GeneratedEnvKey = (typeof GENERATED_ENV_CONFIG)[number]['key'];
const RANDOM_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const RANDOM_SUFFIX_LENGTH = 32;

function getFlag(name: string): string | undefined {
    const pref = `--${name}=`;
    const found = process.argv.find((entry) => entry.startsWith(pref));
    return found ? found.slice(pref.length) : undefined;
}

function getMonorepoRoot(start = process.cwd()): string {
    let dir = start;
    for (let i = 0; i < 10; i++) {
        if (fs.existsSync(path.join(dir, APPS_DIR))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return start;
}

function readDefaultApp(root: string): string | undefined {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        const value = pkg?.ottabase?.defaultApp;
        return typeof value === 'string' ? value : undefined;
    } catch {
        return undefined;
    }
}

function hasEnvSourceFiles(appDir: string): boolean {
    return fs.existsSync(path.join(appDir, TEMPLATE_FILE)) || fs.existsSync(path.join(appDir, TARGET_FILE));
}

function listCandidateApps(root: string): string[] {
    const appsRoot = path.join(root, APPS_DIR);
    if (!fs.existsSync(appsRoot)) return [];

    return fs
        .readdirSync(appsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => hasEnvSourceFiles(path.join(appsRoot, name)))
        .sort();
}

function findAppFromCwd(root: string, cwd = process.cwd()): string | undefined {
    let dir = cwd;
    for (let i = 0; i < 12; i++) {
        if (path.basename(path.dirname(dir)) === APPS_DIR && hasEnvSourceFiles(dir)) {
            return path.basename(dir);
        }

        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }

    return undefined;
}

export interface EnvSecretsOptions {
    app?: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
}

export interface EnvSecretsResult {
    appName: string;
    targetPath: string;
    generated: string[];
}

export function resolveTargetAppDir(options: EnvSecretsOptions = {}): string {
    const cwd = options.cwd ?? process.cwd();
    const env = options.env ?? process.env;
    const root = getMonorepoRoot(cwd);
    const appsRoot = path.join(root, APPS_DIR);
    const candidates = listCandidateApps(root);
    const requested = options.app || getFlag('app') || env.OTTABASE_APP;
    const defaultApp = readDefaultApp(root);

    if (requested) {
        const normalized = path.basename(requested);
        if (!candidates.includes(normalized)) {
            throw new Error(
                `No app with ${TEMPLATE_FILE} or ${TARGET_FILE}: ${normalized}. Available: ${candidates.join(', ')}`,
            );
        }
        return path.join(appsRoot, normalized);
    }

    const cwdApp = findAppFromCwd(root, cwd);
    if (cwdApp) return path.join(appsRoot, cwdApp);

    if (defaultApp && candidates.includes(defaultApp)) return path.join(appsRoot, defaultApp);

    if (candidates.length === 1) return path.join(appsRoot, candidates[0] as string);

    const available = candidates.length ? candidates.join(', ') : 'none found';
    throw new Error(`Could not determine app. Pass --app=<name> or set OTTABASE_APP. Available: ${available}`);
}

function parseLine(line: string): { key: string; value: string } | null {
    const match = line.match(ENV_ASSIGNMENT_RE);
    if (!match) return null;
    return {
        key: match[1],
        value: match[2] ?? '',
    };
}

function stripQuotes(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length >= 2 && trimmed[0] === trimmed[trimmed.length - 1] && /['"]/.test(trimmed[0])) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
}

function isMissingValue(value: string): boolean {
    return stripQuotes(value).length === 0;
}

export function isFillableKey(key: string): key is GeneratedEnvKey {
    return GENERATED_ENV_CONFIG.some((entry) => entry.key === key);
}

function prefixForKey(key: GeneratedEnvKey): string {
    return GENERATED_ENV_CONFIG.find((entry) => entry.key === key)?.prefix ?? '';
}

function makeRandomSuffix(length: number): string {
    let out = '';
    const max = RANDOM_CHARS.length;
    for (let i = 0; i < length; i++) {
        out += RANDOM_CHARS[crypto.randomInt(0, max)];
    }
    return out;
}

function makeValue(key: string): string {
    if (!isFillableKey(key)) {
        throw new Error(`Cannot generate a value for non-allowlisted key: ${key}`);
    }

    const prefix = prefixForKey(key);
    return `${prefix}${makeRandomSuffix(RANDOM_SUFFIX_LENGTH)}`;
}

function readLines(filePath: string): string[] {
    if (!fs.existsSync(filePath)) return [];
    const text = fs.readFileSync(filePath, 'utf8');
    return text.length ? text.split(/\r?\n/) : [];
}

function writeLines(filePath: string, lines: string[]): void {
    fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

export function generateMissingKeys(options: EnvSecretsOptions = {}): EnvSecretsResult {
    const appDir = resolveTargetAppDir(options);
    const appName = path.basename(appDir);
    const templatePath = path.join(appDir, TEMPLATE_FILE);
    const targetPath = path.join(appDir, TARGET_FILE);

    const templateLines = readLines(templatePath);
    const targetLines = readLines(targetPath);

    if (!templateLines.length && !targetLines.length) {
        throw new Error(`No ${TEMPLATE_FILE} or ${TARGET_FILE} found for ${appName}.`);
    }

    const generated: string[] = [];
    const outputLines = targetLines.length ? [...targetLines] : [...templateLines];
    const outputIndex = new Map<string, number>();
    for (let i = 0; i < outputLines.length; i++) {
        const parsed = parseLine(outputLines[i] ?? '');
        if (!parsed) continue;
        outputIndex.set(parsed.key, i);
    }

    const sourceLines = templateLines.length ? templateLines : outputLines;
    for (const line of sourceLines) {
        const parsed = parseLine(line);
        if (!parsed) continue;
        if (!isFillableKey(parsed.key)) continue;
        if (!isMissingValue(parsed.value)) continue;

        const existing = outputIndex.get(parsed.key);
        const outputValue = existing !== undefined ? (parseLine(outputLines[existing] ?? '')?.value ?? '') : '';
        if (!isMissingValue(outputValue)) continue;

        const value = makeValue(parsed.key);
        generated.push(`${parsed.key}=${value}`);
        if (existing === undefined) {
            outputLines.push(`${parsed.key}=${value}`);
            outputIndex.set(parsed.key, outputLines.length - 1);
        } else {
            outputLines[existing] = `${parsed.key}=${value}`;
        }
    }

    if (!generated.length) {
        return { appName, targetPath, generated };
    }

    writeLines(targetPath, outputLines);
    return { appName, targetPath, generated };
}

export function main(options: EnvSecretsOptions = {}) {
    const result = generateMissingKeys(options);
    if (!result.generated.length) {
        console.log(`No missing fillable env keys for ${result.appName}. Existing values preserved.`);
        return;
    }

    console.log(
        `Wrote ${result.generated.length} generated keys to ${path.relative(process.cwd(), result.targetPath)}.`,
    );
    for (const line of result.generated) {
        console.log(`  ${line}`);
    }
}

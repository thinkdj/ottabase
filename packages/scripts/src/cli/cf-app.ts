// ============================================================
// @ottabase/scripts - Cloudflare app context resolver
// ============================================================
//
// Resolves the target app and its Cloudflare resource names from that app's
// `wrangler.jsonc` (the single source of truth) so the cf:* scripts never
// hardcode an app name, a pnpm filter, or resource names (ottabase-db, OBCF_KV,
// ...). Each app therefore provisions/validates exactly the resources its own
// wrangler config declares, and multiple apps in one Cloudflare account get
// distinct, non-colliding resource titles.
// ============================================================

import fs from 'fs';
import path from 'path';
import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';

const APPS_DIR = 'apps';
const WRANGLER_FILE = 'wrangler.jsonc';

export interface CfResourceNames {
    d1: { name: string; previewName: string };
    /**
     * The KV namespace TITLE (the Cloudflare-side name, which must be unique per account) is
     * intentionally distinct from the wrangler BINDING the worker code uses (e.g. OBCF_KV). Only
     * the title is passed to `wrangler kv namespace create`; the binding stays fixed in wrangler.jsonc.
     */
    kv: { binding: string; title: string; previewTitle: string };
    r2: { name: string; previewName: string };
    queue: { name: string; previewName: string };
    /** GitHub Secret names CI substitutes at deploy time (read from env.production / env.preview). */
    secrets: { d1Id: string; kvId: string; d1PreviewId: string; kvPreviewId: string };
}

export interface CfAppContext {
    appName: string; // directory name under apps/, e.g. "otta-web"
    appDir: string; // absolute path to apps/<appName>
    packageName: string; // package.json "name", e.g. "@ottabase/otta-web" (for `pnpm --filter`)
    wranglerCmd: string; // `pnpm --filter <packageName> exec wrangler`
    wranglerPath: string; // absolute path to wrangler.jsonc
    workerName: string; // wrangler.jsonc "name"
    resources: CfResourceNames;
}

/** Escape a string for safe literal use inside a RegExp. */
export function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse JSONC (JSON with // and block comments and trailing commas).
 *
 * Thin wrapper over jsonc-parser so this repo has exactly one implementation of the
 * format that every wrangler.jsonc is written in - @ottabase/cli parses the same files.
 */
export function parseJsonc<T = unknown>(text: string): T {
    const errors: ParseError[] = [];
    const value = parse(text, errors, { allowTrailingComma: true }) as T;
    if (errors.length > 0) {
        const first = errors[0] as ParseError;
        throw new Error(`Invalid JSONC at character ${first.offset}: ${printParseErrorCode(first.error)}`);
    }
    return value;
}

/** Walk up from `start` until a directory containing `apps/` is found (the monorepo root). */
function findMonorepoRoot(start: string): string {
    let dir = start;
    for (let i = 0; i < 8; i++) {
        if (fs.existsSync(path.join(dir, APPS_DIR))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return start;
}

/** App directories (under apps/) that have a wrangler.jsonc. */
function discoverApps(appsRoot: string): string[] {
    if (!fs.existsSync(appsRoot)) return [];
    return fs
        .readdirSync(appsRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(appsRoot, e.name, WRANGLER_FILE)))
        .map((e) => e.name)
        .sort();
}

function getFlag(name: string): string | undefined {
    const prefix = `--${name}=`;
    const hit = process.argv.find((a) => a.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : undefined;
}

/**
 * Optional default app the consuming monorepo declares in its root package.json:
 *   { "ottabase": { "defaultApp": "otta-web" } }
 * Lets `pnpm cf:setup` stay zero-config in a multi-app repo without the reusable scripts
 * hardcoding any app name.
 */
function readDefaultApp(root: string): string | undefined {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        const value = pkg && pkg.ottabase && pkg.ottabase.defaultApp;
        return typeof value === 'string' && value ? value : undefined;
    } catch {
        return undefined;
    }
}

function extractResourceNames(cfg: any): CfResourceNames {
    const workerName: string = (cfg && cfg.name) || 'app';
    const preview = (cfg && cfg.env && cfg.env.preview) || {};
    const production = (cfg && cfg.env && cfg.env.production) || {};

    const d1 = (cfg && cfg.d1_databases && cfg.d1_databases[0]) || {};
    const d1Preview = (preview.d1_databases && preview.d1_databases[0]) || {};
    const kv = (cfg && cfg.kv_namespaces && cfg.kv_namespaces[0]) || {};
    const r2 = (cfg && cfg.r2_buckets && cfg.r2_buckets[0]) || {};
    const r2Preview = (preview.r2_buckets && preview.r2_buckets[0]) || {};
    const queue = (cfg && cfg.queues && cfg.queues.producers && cfg.queues.producers[0]) || {};
    const queuePreview = (preview.queues && preview.queues.producers && preview.queues.producers[0]) || {};

    const d1Name = d1.database_name || `${workerName}-db`;
    const r2Name = r2.bucket_name || `${workerName}-bucket`;
    const queueName = queue.queue || `${workerName}-queue`;

    return {
        d1: { name: d1Name, previewName: d1Preview.database_name || `${d1Name}-preview` },
        kv: {
            binding: kv.binding || 'OBCF_KV',
            // Title derived from the (unique-per-account) worker name; wrangler suffixes a
            // `--preview` namespace's title with `_preview`.
            title: `${workerName}-kv`,
            previewTitle: `${workerName}-kv_preview`,
        },
        r2: { name: r2Name, previewName: r2.preview_bucket_name || r2Preview.bucket_name || `${r2Name}-preview` },
        queue: { name: queueName, previewName: queuePreview.queue || `${queueName}-preview` },
        secrets: {
            d1Id: production?.d1_databases?.[0]?.database_id || 'D1_DATABASE_ID',
            kvId: production?.kv_namespaces?.[0]?.id || 'KV_NAMESPACE_ID',
            d1PreviewId: preview?.d1_databases?.[0]?.database_id || 'D1_PREVIEW_DATABASE_ID',
            kvPreviewId: preview?.kv_namespaces?.[0]?.id || 'KV_PREVIEW_NAMESPACE_ID',
        },
    };
}

/**
 * Resolve the target app and its Cloudflare resource names from `apps/<app>/wrangler.jsonc`.
 *
 * App selection order: explicit `opts.app` > `--app=<name>` flag > OTTABASE_APP env >
 * root package.json `ottabase.defaultApp` > the single app present. With multiple apps and no
 * selection it throws, listing the choices.
 */
export function resolveCfApp(opts: { app?: string } = {}): CfAppContext {
    const root = findMonorepoRoot(process.cwd());
    const appsRoot = path.join(root, APPS_DIR);
    const apps = discoverApps(appsRoot);

    if (apps.length === 0) {
        throw new Error(`No app with a ${WRANGLER_FILE} found under "${appsRoot}". Run this from the monorepo root.`);
    }

    const requested = opts.app || getFlag('app') || process.env.OTTABASE_APP || readDefaultApp(root);
    let appName: string;
    if (requested) {
        const base = path.basename(requested);
        if (!apps.includes(base)) {
            throw new Error(`App "${requested}" has no ${WRANGLER_FILE}. Available: ${apps.join(', ')}`);
        }
        appName = base;
    } else if (apps.length === 1) {
        appName = apps[0] as string;
    } else {
        throw new Error(`Multiple apps found (${apps.join(', ')}). Pass --app=<name> or set OTTABASE_APP.`);
    }

    const appDir = path.join(appsRoot, appName);
    const wranglerPath = path.join(appDir, WRANGLER_FILE);

    let packageName = appName;
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
        if (pkg && typeof pkg.name === 'string' && pkg.name) packageName = pkg.name;
    } catch {
        // fall back to the directory name for the pnpm filter
    }

    const cfg = parseJsonc<any>(fs.readFileSync(wranglerPath, 'utf8'));

    return {
        appName,
        appDir,
        packageName,
        wranglerCmd: `pnpm --filter ${packageName} exec wrangler`,
        wranglerPath,
        workerName: (cfg && cfg.name) || appName,
        resources: extractResourceNames(cfg),
    };
}

import fs from 'fs';
import path from 'path';

// ─── Wrangler JSONC types ────────────────────────────────────────────────────

type WranglerD1 = { binding?: string; database_name?: string };
type WranglerKv = { binding?: string; id?: string; preview_id?: string };
type WranglerR2 = { binding?: string; bucket_name?: string; preview_bucket_name?: string };
type WranglerQueue = { binding?: string; queue?: string };
type WranglerAnalytics = { binding?: string; dataset?: string };

type WranglerEnv = {
    d1_databases?: WranglerD1[];
    kv_namespaces?: WranglerKv[];
    r2_buckets?: WranglerR2[];
    queues?: { producers?: WranglerQueue[] };
    analytics_engine_datasets?: WranglerAnalytics[];
};

type WranglerConfig = WranglerEnv & {
    env?: { production?: WranglerEnv; preview?: WranglerEnv };
};

// ─── Public types ────────────────────────────────────────────────────────────

/** Production and preview names for a single Cloudflare managed resource type. */
export type CloudflareManagedResource = { production?: string; preview?: string };

export type CloudflareAppConfig = {
    appName: string;
    appDir: string;
    wranglerPath: string;
    /** Raw wrangler.jsonc content (used for placeholder detection in validate). */
    wranglerContent: string;
    /** Wrangler CLI command prefixed to run in the app directory. */
    wranglerCmd: string;
    /** Managed Cloudflare resources found in wrangler.jsonc. Undefined = not configured. */
    resources: {
        d1: CloudflareManagedResource;
        kv: CloudflareManagedResource;
        r2: CloudflareManagedResource;
        queue: CloudflareManagedResource;
    };
    /** Analytics Engine dataset names declared in wrangler.jsonc (auto-created; no setup needed). */
    analyticsDatasets: string[];
};

// ─── CLI argument parsing ────────────────────────────────────────────────────

/** Returns the value for `--<name>` or `--<name>=<value>` from args, or undefined. */
export function getCliArgValue(args: string[], name: string): string | undefined {
    const exact = `--${name}`;
    const prefix = `--${name}=`;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === exact) {
            const next = args[i + 1];
            return next && !next.startsWith('--') ? next : undefined;
        }
        if (args[i].startsWith(prefix)) return args[i].slice(prefix.length);
    }
    return undefined;
}

// ─── JSONC parsing ───────────────────────────────────────────────────────────

function stripJsonComments(input: string): string {
    let output = '';
    let inString = false;
    let isEscaped = false;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        const next = input[i + 1];

        if (inString) {
            output += ch;
            if (isEscaped) {
                isEscaped = false;
            } else if (ch === '\\') {
                isEscaped = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            output += ch;
            continue;
        }

        // Line comment
        if (ch === '/' && next === '/') {
            while (i < input.length && input[i] !== '\n') i++;
            if (i < input.length) output += input[i]; // preserve the newline
            continue;
        }

        // Block comment
        if (ch === '/' && next === '*') {
            i += 2;
            while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i++;
            i++; // skip closing /
            continue;
        }

        output += ch;
    }

    return output;
}

function stripTrailingCommas(input: string): string {
    let output = '';
    let inString = false;
    let isEscaped = false;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];

        if (inString) {
            output += ch;
            if (isEscaped) {
                isEscaped = false;
            } else if (ch === '\\') {
                isEscaped = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            output += ch;
            continue;
        }

        if (ch === ',') {
            // Look ahead past whitespace to find the next non-whitespace char
            let j = i + 1;
            while (j < input.length && /\s/.test(input[j])) j++;
            if (input[j] === '}' || input[j] === ']') continue; // trailing comma — skip it
        }

        output += ch;
    }

    return output;
}

function parseJsonc<T>(content: string): T {
    return JSON.parse(stripTrailingCommas(stripJsonComments(content))) as T;
}

// ─── Resource extraction ─────────────────────────────────────────────────────

/** Returns the first defined, non-empty string from candidates. */
function firstOf(...candidates: Array<string | undefined>): string | undefined {
    return candidates.find((v) => v !== undefined && v !== '');
}

export function getCloudflareAppConfig(appName: string, cwd: string = process.cwd()): CloudflareAppConfig {
    const appDir = path.join(cwd, 'apps', appName);
    const wranglerPath = path.join(appDir, 'wrangler.jsonc');

    if (!fs.existsSync(wranglerPath)) {
        throw new Error(`wrangler.jsonc not found for app "${appName}" at ${wranglerPath}`);
    }

    const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    const config = parseJsonc<WranglerConfig>(wranglerContent);
    const prod = config.env?.production;
    const preview = config.env?.preview;

    // D1: resource name = database_name field
    const d1Prod = firstOf(prod?.d1_databases?.[0]?.database_name, config.d1_databases?.[0]?.database_name);
    const d1Preview = preview?.d1_databases?.[0]?.database_name;

    // KV: Cloudflare KV namespace title = binding name (wrangler convention: `wrangler kv namespace create <binding>`).
    // Preview namespace exists when env.preview declares kv_namespaces; wrangler appends "_preview" to the binding title.
    const kvBinding = firstOf(prod?.kv_namespaces?.[0]?.binding, config.kv_namespaces?.[0]?.binding);
    const kvPreview = kvBinding && preview?.kv_namespaces?.length ? `${kvBinding}_preview` : undefined;

    // R2: resource name = bucket_name field; preview from env.preview or top-level preview_bucket_name
    const r2Prod = firstOf(prod?.r2_buckets?.[0]?.bucket_name, config.r2_buckets?.[0]?.bucket_name);
    const r2Preview = firstOf(preview?.r2_buckets?.[0]?.bucket_name, config.r2_buckets?.[0]?.preview_bucket_name);

    // Queue: resource name = queue field
    const queueProd = firstOf(prod?.queues?.producers?.[0]?.queue, config.queues?.producers?.[0]?.queue);
    const queuePreview = preview?.queues?.producers?.[0]?.queue;

    // Analytics datasets (auto-created on first write; informational only — no setup needed)
    const allDatasets = [...(config.analytics_engine_datasets ?? []), ...(prod?.analytics_engine_datasets ?? [])];
    const analyticsDatasets = [...new Set(allDatasets.map((d) => d.dataset).filter((d): d is string => !!d))];

    return {
        appName,
        appDir,
        wranglerPath,
        wranglerContent,
        wranglerCmd: `pnpm --dir "${appDir}" exec wrangler`,
        resources: {
            d1: { production: d1Prod, preview: d1Preview },
            kv: { production: kvBinding, preview: kvPreview },
            r2: { production: r2Prod, preview: r2Preview },
            queue: { production: queueProd, preview: queuePreview },
        },
        analyticsDatasets,
    };
}

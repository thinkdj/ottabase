import fs from 'fs';
import path from 'path';

type WranglerResource = {
    binding?: string;
    database_name?: string;
    preview_database_id?: string;
    preview_bucket_name?: string;
    bucket_name?: string;
    id?: string;
    preview_id?: string;
    queue?: string;
};

type WranglerConfig = {
    d1_databases?: WranglerResource[];
    kv_namespaces?: WranglerResource[];
    r2_buckets?: WranglerResource[];
    queues?: {
        producers?: WranglerResource[];
    };
    env?: {
        production?: WranglerConfig;
        preview?: WranglerConfig;
    };
};

export type CloudflareManagedResource = {
    production?: string;
    preview?: string;
};

export type CloudflareAppConfig = {
    appName: string;
    appDir: string;
    wranglerPath: string;
    wranglerCmd: string;
    wranglerContent: string;
    resources: {
        d1: CloudflareManagedResource;
        kv: CloudflareManagedResource;
        r2: CloudflareManagedResource;
        queue: CloudflareManagedResource;
    };
};

export function getCliArgValue(args: string[], name: string): string | undefined {
    const exact = `--${name}`;
    const withValue = `--${name}=`;

    for (let argIndex = 0; argIndex < args.length; argIndex++) {
        const arg = args[argIndex];
        if (arg === exact) {
            const next = args[argIndex + 1];
            return next && !next.startsWith('--') ? next : undefined;
        }
        if (arg.startsWith(withValue)) {
            return arg.slice(withValue.length);
        }
    }

    return undefined;
}

function stripJsonComments(input: string): string {
    let output = '';
    let inString = false;
    let isEscaped = false;

    for (let charIndex = 0; charIndex < input.length; charIndex++) {
        const current = input[charIndex];
        const next = input[charIndex + 1];

        if (inString) {
            output += current;
            if (isEscaped) {
                isEscaped = false;
            } else if (current === '\\') {
                isEscaped = true;
            } else if (current === '"') {
                inString = false;
            }
            continue;
        }

        if (current === '"') {
            inString = true;
            output += current;
            continue;
        }

        if (current === '/' && next === '/') {
            while (charIndex < input.length && input[charIndex] !== '\n') {
                charIndex++;
            }
            if (charIndex < input.length) output += input[charIndex];
            continue;
        }

        if (current === '/' && next === '*') {
            charIndex += 2;
            while (charIndex < input.length && !(input[charIndex] === '*' && input[charIndex + 1] === '/')) {
                charIndex++;
            }
            charIndex++;
            continue;
        }

        output += current;
    }

    return output;
}

function stripTrailingCommas(input: string): string {
    let output = '';
    let inString = false;
    let isEscaped = false;

    for (let charIndex = 0; charIndex < input.length; charIndex++) {
        const current = input[charIndex];

        if (inString) {
            output += current;
            if (isEscaped) {
                isEscaped = false;
            } else if (current === '\\') {
                isEscaped = true;
            } else if (current === '"') {
                inString = false;
            }
            continue;
        }

        if (current === '"') {
            inString = true;
            output += current;
            continue;
        }

        if (current === ',') {
            let lookAheadIndex = charIndex + 1;
            while (lookAheadIndex < input.length && /\s/.test(input[lookAheadIndex])) {
                lookAheadIndex++;
            }

            const next = input[lookAheadIndex];
            if (next === '}' || next === ']') {
                continue;
            }
        }

        output += current;
    }

    return output;
}

function parseJsonc<T>(content: string): T {
    return JSON.parse(stripTrailingCommas(stripJsonComments(content))) as T;
}

function getFirstDefined<T>(...values: Array<T | undefined>): T | undefined {
    return values.find((value) => value !== undefined);
}

function getQueueName(config?: WranglerConfig): string | undefined {
    return config?.queues?.producers?.[0]?.queue;
}

export function getCloudflareAppConfig(appName: string, cwd: string = process.cwd()): CloudflareAppConfig {
    const appDir = path.join(cwd, 'apps', appName);
    const wranglerPath = path.join(appDir, 'wrangler.jsonc');

    if (!fs.existsSync(wranglerPath)) {
        throw new Error(`App "${appName}" does not have ${wranglerPath}`);
    }

    const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    const config = parseJsonc<WranglerConfig>(wranglerContent);
    const production = config.env?.production;
    const preview = config.env?.preview;

    const kvBinding = getFirstDefined(production?.kv_namespaces?.[0]?.binding, config.kv_namespaces?.[0]?.binding);
    const hasPreviewKv =
        preview?.kv_namespaces?.[0]?.binding !== undefined || config.kv_namespaces?.[0]?.preview_id !== undefined;

    return {
        appName,
        appDir,
        wranglerPath,
        wranglerContent,
        wranglerCmd: `pnpm --dir "${appDir}" exec wrangler`,
        resources: {
            d1: {
                production: getFirstDefined(
                    production?.d1_databases?.[0]?.database_name,
                    config.d1_databases?.[0]?.database_name,
                ),
                preview: preview?.d1_databases?.[0]?.database_name,
            },
            kv: {
                production: kvBinding,
                preview: kvBinding && hasPreviewKv ? `${kvBinding}_preview` : undefined,
            },
            r2: {
                production: getFirstDefined(
                    production?.r2_buckets?.[0]?.bucket_name,
                    config.r2_buckets?.[0]?.bucket_name,
                ),
                preview: getFirstDefined(
                    preview?.r2_buckets?.[0]?.bucket_name,
                    config.r2_buckets?.[0]?.preview_bucket_name,
                ),
            },
            queue: {
                production: getFirstDefined(getQueueName(production), getQueueName(config)),
                preview: getQueueName(preview),
            },
        },
    };
}

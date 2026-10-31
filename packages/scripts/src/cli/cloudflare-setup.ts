import checkbox from '@inquirer/checkbox';
import { execSync } from 'child_process';
import { escapeRegExp, resolveCfApp, type CfResourceNames } from './cf-app';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

/** Resource types that can be created. */
const RESOURCE_IDS = ['d1', 'kv', 'r2', 'queue'] as const;
type ResourceId = (typeof RESOURCE_IDS)[number];

/** `--json`: the ids go to stdout as one JSON object at the end; everything else goes to stderr. */
const jsonMode = process.argv.includes('--json');

function log(msg: string, color: string = NC) {
    (jsonMode ? console.error : console.log)(`${color}${msg}${NC}`);
}

function runCommand(command: string, ignoreError = false): string {
    try {
        return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch (error: unknown) {
        if (ignoreError) return '';
        const err = error as { stderr?: string; stdout?: string; message?: string };
        const stderr = (err.stderr || '').toString().trim();
        const msg = stderr || err.message || String(error);
        throw new Error(msg);
    }
}

/** Strip ANSI escape codes and extract JSON from wrangler output (Wrangler 4+ may prefix JSON with warnings). */
function extractJson<T>(output: string): T {
    // Find first [ or { and parse from there to handle wrangler warnings before JSON
    const start = output.search(/[[{]/);
    if (start === -1) throw new Error('No JSON found in output');
    let depth = 0;
    const open = output[start];
    const close = open === '[' ? ']' : '}';
    for (let i = start; i < output.length; i++) {
        if (output[i] === open) depth++;
        else if (output[i] === close) {
            depth--;
            if (depth === 0) return JSON.parse(output.slice(start, i + 1)) as T;
        }
    }
    throw new Error('Malformed JSON in output');
}

/** Extract database_id from d1 create output. Wrangler v4+ removed --json. */
function parseD1CreateOutput(output: string): string {
    const m = output.match(/"database_id":\s*"([a-f0-9-]{36})"/);
    if (!m) throw new Error('Could not parse database_id from d1 create output');
    return m[1];
}

/** Extract id from kv namespace create output. Wrangler v4+ removed --json. */
function parseKvCreateOutput(output: string): string {
    const m = output.match(/"id":\s*"([a-f0-9]{32})"/);
    if (!m) throw new Error('Could not parse id from kv create output');
    return m[1];
}

/** Returns true if stdin is a TTY (interactive). */
function isInteractive(): boolean {
    return process.stdin.isTTY === true;
}

async function selectResources(force: boolean, res: CfResourceNames): Promise<ResourceId[]> {
    if (force || !isInteractive()) {
        log('Force/non-interactive mode: selecting all resources.', YELLOW);
        return [...RESOURCE_IDS];
    }

    const choices = [
        { name: `D1 Database (${res.d1.name} + ${res.d1.previewName})`, value: 'd1' as ResourceId, checked: true },
        {
            name: `KV namespaces (${res.kv.title} + ${res.kv.previewTitle}; binding stays ${res.kv.binding})`,
            value: 'kv' as ResourceId,
            checked: true,
        },
        {
            name: `R2 Buckets (${res.r2.map((bucket) => `${bucket.name} + ${bucket.previewName}`).join(', ')})`,
            value: 'r2' as ResourceId,
            checked: true,
        },
        { name: `Queue (${res.queue.name} + ${res.queue.previewName})`, value: 'queue' as ResourceId, checked: true },
    ];

    const selected = await checkbox({
        message: 'Select resources to create (↑↓ move, space toggle, enter confirm)',
        choices,
        required: true,
        theme: {
            icon: {
                checked: '[x]',
                unchecked: '[ ]',
                cursor: '>',
            },
        },
    });

    if (selected.length === 0) {
        log('No resources selected. Aborted.', YELLOW);
        process.exit(0);
    }

    return selected as ResourceId[];
}

async function main() {
    const force = process.argv.includes('--force') || jsonMode;
    const envFlag = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length);
    // Preview resources back `wrangler dev --remote` and PR previews of production; a named env
    // other than production has its own block and needs none.
    const withPreview = !envFlag || envFlag === 'production';

    log('', NC);
    log(`${BOLD}cf:setup - Cloudflare Resource Creation${NC}`);
    log('', NC);

    // Resolve the app + its resource names from wrangler.jsonc (single source of truth).
    const { appName, packageName, wranglerCmd, resources: res } = resolveCfApp({ env: envFlag });
    log(`App: ${appName} (${packageName})${envFlag ? `, env ${envFlag}` : ''}`, NC);
    log('', NC);

    // Check wrangler and auth first (fail fast before any prompts)
    try {
        runCommand(`${wranglerCmd} --version`);
    } catch (e) {
        log('Error: wrangler is not installed in the app. Please run "pnpm install" first.', RED);
        process.exit(1);
    }

    log('Checking Cloudflare authentication...', YELLOW);
    const whoamiResult = runCommand(`${wranglerCmd} whoami`, true);
    if (!whoamiResult || whoamiResult.includes('not authenticated')) {
        log('Not logged in to Cloudflare. Run: pnpm cf:login', RED);
        process.exit(1);
    }
    log(`Authenticated as: ${whoamiResult.split('\n')[0]}`, GREEN);
    log('', NC);

    // Interactive resource selection
    const resources = await selectResources(force, res);
    log('', NC);
    log(`Creating: ${resources.join(', ')}`, YELLOW);
    log('', NC);

    let d1Id = '';
    let d1PreviewId = '';
    let kvId = '';
    let kvPreviewId = '';

    // 1. D1 Database (Wrangler v4+: d1 create/info --json removed, use d1 list --json or parse create output)
    if (resources.includes('d1')) {
        log(`Setting up D1 Database '${res.d1.name}'...`, YELLOW);
        try {
            const d1ListOutput = runCommand(`${wranglerCmd} d1 list --json`, true);
            const existing = d1ListOutput
                ? extractJson<{ uuid: string; name: string }[]>(d1ListOutput).find((db) => db.name === res.d1.name)
                : null;
            if (existing) {
                d1Id = existing.uuid;
                log(`Database already exists. ID: ${d1Id}`, GREEN);
            } else {
                const createOutput = runCommand(`${wranglerCmd} d1 create ${res.d1.name}`);
                d1Id = parseD1CreateOutput(createOutput);
                log(`Created D1 Database. ID: ${d1Id}`, GREEN);
            }
        } catch (e) {
            log(`Error setting up D1 Database: ${e instanceof Error ? e.message : String(e)}`, RED);
        }

        // D1 Preview Database (isolated DB for `wrangler dev --remote` / PR preview deployments)
        if (withPreview) {
            log(`Setting up D1 Preview Database '${res.d1.previewName}'...`, YELLOW);
            try {
                const d1ListOutput = runCommand(`${wranglerCmd} d1 list --json`, true);
                const existing = d1ListOutput
                    ? extractJson<{ uuid: string; name: string }[]>(d1ListOutput).find(
                          (db) => db.name === res.d1.previewName,
                      )
                    : null;
                if (existing) {
                    d1PreviewId = existing.uuid;
                    log(`Preview Database already exists. ID: ${d1PreviewId}`, GREEN);
                } else {
                    const createOutput = runCommand(`${wranglerCmd} d1 create ${res.d1.previewName}`);
                    d1PreviewId = parseD1CreateOutput(createOutput);
                    log(`Created D1 Preview Database. ID: ${d1PreviewId}`, GREEN);
                }
            } catch (e) {
                log(`Error setting up D1 Preview Database: ${e instanceof Error ? e.message : String(e)}`, RED);
            }
        }
    }

    // 2. KV Namespaces (Wrangler v4+: kv namespace list/create --json removed, parse text output)
    const getKvList = () => {
        const out = runCommand(`${wranglerCmd} kv namespace list`, true);
        return out ? extractJson<{ id: string; title: string }[]>(out) : [];
    };

    if (resources.includes('kv')) {
        log(`Setting up KV namespace '${res.kv.title}' (binding ${res.kv.binding})...`, YELLOW);
        try {
            let kvList = getKvList();
            let existingKv = kvList.find((ns) => ns.title === res.kv.title);
            if (existingKv) {
                kvId = existingKv.id;
                log(`KV namespace already exists. ID: ${kvId}`, GREEN);
            } else {
                let createErr: unknown;
                try {
                    const createOutput = runCommand(`${wranglerCmd} kv namespace create ${res.kv.title}`);
                    kvId = parseKvCreateOutput(createOutput);
                    log(`Created KV namespace. ID: ${kvId}`, GREEN);
                } catch (e) {
                    createErr = e;
                    // Create failed (e.g. already exists) - re-fetch list
                    kvList = getKvList();
                    existingKv = kvList.find((ns) => ns.title === res.kv.title);
                    if (existingKv) {
                        kvId = existingKv.id;
                        log(`KV namespace already exists. ID: ${kvId}`, GREEN);
                    } else throw createErr;
                }
            }
        } catch (e) {
            log(`Error setting up KV namespace: ${e instanceof Error ? e.message : String(e)}`, RED);
        }

        if (withPreview) {
            log(`Setting up KV preview namespace '${res.kv.previewTitle}'...`, YELLOW);
            try {
                let kvList = getKvList();
                let existingKvPreview = kvList.find((ns) => ns.title === res.kv.previewTitle);
                if (existingKvPreview) {
                    kvPreviewId = existingKvPreview.id;
                    log(`KV preview namespace already exists. ID: ${kvPreviewId}`, GREEN);
                } else {
                    let createErr: unknown;
                    try {
                        const createOutput = runCommand(`${wranglerCmd} kv namespace create ${res.kv.title} --preview`);
                        kvPreviewId = parseKvCreateOutput(createOutput);
                        log(`Created KV preview namespace. ID: ${kvPreviewId}`, GREEN);
                    } catch (e) {
                        createErr = e;
                        kvList = getKvList();
                        existingKvPreview = kvList.find((ns) => ns.title === res.kv.previewTitle);
                        if (existingKvPreview) {
                            kvPreviewId = existingKvPreview.id;
                            log(`KV preview namespace already exists. ID: ${kvPreviewId}`, GREEN);
                        } else throw createErr;
                    }
                }
            } catch (e) {
                log(`Error setting up KV preview namespace: ${e instanceof Error ? e.message : String(e)}`, RED);
            }
        }
    }

    // 3. R2 Buckets (check list first to avoid redundant create): every bucket the app binds.
    if (resources.includes('r2')) {
        for (const bucket of res.r2) {
            // `(?!-)` so a bucket check doesn't match the "<name>-preview" (or "<name>-demo") entry.
            const r2Exists = new RegExp(`name:\\s*${escapeRegExp(bucket.name)}(?!-)`);
            const r2PreviewExists = new RegExp(`name:\\s*${escapeRegExp(bucket.previewName)}`);

            log(`Setting up R2 Bucket '${bucket.name}' (${bucket.binding})...`, YELLOW);
            try {
                const r2List = runCommand(`${wranglerCmd} r2 bucket list`, true);
                if (r2List && r2Exists.test(r2List)) {
                    log('R2 Bucket already exists.', GREEN);
                } else {
                    runCommand(`${wranglerCmd} r2 bucket create ${bucket.name}`);
                    log('R2 Bucket created.', GREEN);
                }
            } catch (e) {
                log(`Error setting up R2 Bucket: ${e instanceof Error ? e.message : String(e)}`, RED);
            }

            if (withPreview) {
                log(`Setting up R2 preview bucket '${bucket.previewName}' (for \`wrangler dev --remote\`)...`, YELLOW);
                try {
                    const r2List = runCommand(`${wranglerCmd} r2 bucket list`, true);
                    if (r2List && r2PreviewExists.test(r2List)) {
                        log('R2 preview bucket already exists.', GREEN);
                    } else {
                        runCommand(`${wranglerCmd} r2 bucket create ${bucket.previewName}`);
                        log('R2 preview bucket created.', GREEN);
                    }
                } catch (e) {
                    log(`Error setting up R2 preview bucket: ${e instanceof Error ? e.message : String(e)}`, RED);
                }
            }
        }
    }

    // 4. Queue (check list first; fallback: create fails with "already taken" = exists)
    if (resources.includes('queue')) {
        const queueExists = new RegExp(`[|\\u2502]\\s*${escapeRegExp(res.queue.name)}\\s*[|\\u2502]`);
        const queuePreviewExists = new RegExp(`[|\\u2502]\\s*${escapeRegExp(res.queue.previewName)}\\s*[|\\u2502]`);

        log(`Setting up Queue '${res.queue.name}'...`, YELLOW);
        try {
            const queueList = runCommand(`${wranglerCmd} queues list`, true);
            const existsInList = queueList && queueExists.test(queueList);
            if (existsInList) {
                log('Queue already exists.', GREEN);
            } else {
                let createErr: unknown;
                try {
                    runCommand(`${wranglerCmd} queues create ${res.queue.name}`);
                    log('Queue created.', GREEN);
                } catch (e) {
                    createErr = e;
                    const msg = e instanceof Error ? e.message : String(e);
                    if (msg.includes('already taken') || msg.includes('11009')) {
                        log('Queue already exists.', GREEN);
                    } else throw createErr;
                }
            }
        } catch (e) {
            log(`Error setting up Queue: ${e instanceof Error ? e.message : String(e)}`, RED);
        }

        if (withPreview) {
            log(`Setting up Queue '${res.queue.previewName}' (for PR previews)...`, YELLOW);
            try {
                const queueList = runCommand(`${wranglerCmd} queues list`, true);
                const existsPreview = queueList && queuePreviewExists.test(queueList);
                if (existsPreview) {
                    log('Preview queue already exists.', GREEN);
                } else {
                    let createErr: unknown;
                    try {
                        runCommand(`${wranglerCmd} queues create ${res.queue.previewName}`);
                        log('Preview queue created.', GREEN);
                    } catch (e) {
                        createErr = e;
                        const msg = e instanceof Error ? e.message : String(e);
                        if (msg.includes('already taken') || msg.includes('11009')) {
                            log('Preview queue already exists.', GREEN);
                        } else throw createErr;
                    }
                }
            } catch (e) {
                log(`Error setting up preview queue: ${e instanceof Error ? e.message : String(e)}`, RED);
            }
        }
    }

    // 5. Analytics Engine: Workers Analytics Engine (OBCF_ANALYTICS_*)
    log('', NC);
    log('Analytics Engine (OBCF_ANALYTICS_*):', YELLOW);
    log('  - Dataset is auto-created on first write. No setup is needed.', NC);
    log('  - For /analytics page, set `CLOUDFLARE_ACCOUNT_ID` (vars) and', NC);
    log('    `CLOUDFLARE_ANALYTICS_API_TOKEN` (secret) with `Account Analytics` Read permission.', NC);

    // Output resource IDs for GitHub Secrets (secret names come from wrangler.jsonc env.* placeholders)
    log('', NC);
    log('Setup Complete!', GREEN);
    log('', NC);
    log('Production (GitHub Secrets for main deploy):', YELLOW);
    if (d1Id) log(`  ${res.secrets.d1Id}=${d1Id}`);
    if (kvId) log(`  ${res.secrets.kvId}=${kvId}`);
    log('', NC);
    log('Preview (GitHub Secrets for PR preview deploy):', YELLOW);
    if (d1PreviewId) log(`  ${res.secrets.d1PreviewId}=${d1PreviewId}`);
    if (kvPreviewId) log(`  ${res.secrets.kvPreviewId}=${kvPreviewId}`);

    // Regenerate cloudflare-env.d.ts so TypeScript types reflect the new/updated bindings
    log('', NC);
    log('Generating cloudflare-env.d.ts (wrangler types)...', YELLOW);
    try {
        runCommand(`${wranglerCmd} types`);
        log('cloudflare-env.d.ts updated.', GREEN);
    } catch (e) {
        log(`Warning: could not generate cloudflare-env.d.ts: ${e instanceof Error ? e.message : String(e)}`, YELLOW);
        log(`Run manually: cd apps/${appName} && npx wrangler types`, YELLOW);
    }

    // The ids, machine-readable, for `otta deploy`: keyed by the placeholder names of the env block.
    if (jsonMode) {
        const ids: Record<string, string> = {};
        if (d1Id) ids[res.secrets.d1Id] = d1Id;
        if (kvId) ids[res.secrets.kvId] = kvId;
        if (d1PreviewId) ids[res.secrets.d1PreviewId] = d1PreviewId;
        if (kvPreviewId) ids[res.secrets.kvPreviewId] = kvPreviewId;
        console.log(JSON.stringify(ids));
    }
}

main().catch((err) => {
    console.error('cf:setup failed:', err);
    process.exit(1);
});

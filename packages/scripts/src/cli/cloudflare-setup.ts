import checkbox from '@inquirer/checkbox';
import { execSync } from 'child_process';
import { getCliArgValue, getCloudflareAppConfig, type CloudflareAppConfig } from './cloudflare-app-config';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

type ResourceId = 'd1' | 'kv' | 'r2' | 'queue';

function log(msg: string, color: string = NC) {
    console.log(`${color}${msg}${NC}`);
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

/**
 * Strip ANSI escape codes and extract a JSON array from wrangler output.
 * Wrangler 4+ may prefix JSON with warnings.
 */
function extractJson<T>(output: string): T {
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

/** Extract database_id from `d1 create` output (Wrangler v4+ removed --json). */
function parseD1CreateOutput(output: string): string {
    const m = output.match(/"database_id":\s*"([a-f0-9-]{36})"/);
    if (!m) throw new Error('Could not parse database_id from d1 create output');
    return m[1];
}

/** Extract id from `kv namespace create` output (Wrangler v4+ removed --json). */
function parseKvCreateOutput(output: string): string {
    const m = output.match(/"id":\s*"([a-f0-9]{32})"/);
    if (!m) throw new Error('Could not parse id from kv create output');
    return m[1];
}

function isInteractive(): boolean {
    return process.stdin.isTTY === true;
}

async function selectResources(force: boolean, appConfig: CloudflareAppConfig): Promise<ResourceId[]> {
    // Only include resource types that are actually configured in wrangler.jsonc
    const resourceChoices = (
        [
            {
                id: 'd1' as ResourceId,
                label: 'D1 Database',
                names: [appConfig.resources.d1.production, appConfig.resources.d1.preview],
            },
            {
                id: 'kv' as ResourceId,
                label: 'KV Namespaces',
                names: [appConfig.resources.kv.production, appConfig.resources.kv.preview],
            },
            {
                id: 'r2' as ResourceId,
                label: 'R2 Buckets',
                names: [appConfig.resources.r2.production, appConfig.resources.r2.preview],
            },
            {
                id: 'queue' as ResourceId,
                label: 'Queue',
                names: [appConfig.resources.queue.production, appConfig.resources.queue.preview],
            },
        ] as const
    )
        .filter(({ names }) => names.some(Boolean))
        .map(({ id, label, names }) => ({
            name: `${label} (${names.filter(Boolean).join(' + ')})`,
            value: id,
            checked: true,
        }));

    if (resourceChoices.length === 0) {
        log(`No managed D1/KV/R2/Queue resources declared in ${appConfig.wranglerPath}.`, YELLOW);
        process.exit(0);
    }

    if (force || !isInteractive()) {
        log('Force/non-interactive mode: selecting all resources.', YELLOW);
        return resourceChoices.map((c) => c.value);
    }

    const selected = await checkbox({
        message: 'Select resources to create (↑↓ move, space toggle, enter confirm)',
        choices: resourceChoices,
        required: true,
        theme: { icon: { checked: '[x]', unchecked: '[ ]', cursor: '>' } },
    });

    if (selected.length === 0) {
        log('No resources selected. Aborted.', YELLOW);
        process.exit(0);
    }

    return selected as ResourceId[];
}

async function main() {
    const force = process.argv.includes('--force');
    const appName = getCliArgValue(process.argv.slice(2), 'app') || 'otta-web';
    const appConfig = getCloudflareAppConfig(appName);
    const { resources, wranglerCmd } = appConfig;

    log('', NC);
    log(`${BOLD}cf:setup - Cloudflare Resource Creation${NC}`);
    log(`App: ${appConfig.appName}`, YELLOW);
    log('', NC);

    // Fail fast before prompts: verify wrangler is installed and authenticated
    try {
        runCommand(`${wranglerCmd} --version`);
    } catch {
        log('Error: wrangler is not installed. Please run "pnpm install" first.', RED);
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

    const selectedResources = await selectResources(force, appConfig);
    log('', NC);
    log(`Creating: ${selectedResources.join(', ')}`, YELLOW);
    log('', NC);

    let d1Id = '';
    let d1PreviewId = '';
    let kvId = '';
    let kvPreviewId = '';

    // ── 1. D1 ─────────────────────────────────────────────────────────────
    if (selectedResources.includes('d1')) {
        const createOrFindD1 = async (dbName: string): Promise<string> => {
            const listOut = runCommand(`${wranglerCmd} d1 list --json`, true);
            const existing = listOut
                ? extractJson<{ uuid: string; name: string }[]>(listOut).find((db) => db.name === dbName)
                : null;
            if (existing) return existing.uuid;
            const createOut = runCommand(`${wranglerCmd} d1 create ${dbName}`);
            return parseD1CreateOutput(createOut);
        };

        if (resources.d1.production) {
            log(`Setting up D1 Database '${resources.d1.production}'...`, YELLOW);
            try {
                d1Id = await createOrFindD1(resources.d1.production);
                log(`D1 Database ready. ID: ${d1Id}`, GREEN);
            } catch (e) {
                log(`Error setting up D1 Database: ${e instanceof Error ? e.message : String(e)}`, RED);
            }
        }

        if (resources.d1.preview) {
            log(`Setting up D1 Preview Database '${resources.d1.preview}'...`, YELLOW);
            try {
                d1PreviewId = await createOrFindD1(resources.d1.preview);
                log(`D1 Preview Database ready. ID: ${d1PreviewId}`, GREEN);
            } catch (e) {
                log(`Error setting up D1 Preview Database: ${e instanceof Error ? e.message : String(e)}`, RED);
            }
        }
    }

    // ── 2. KV ─────────────────────────────────────────────────────────────
    if (selectedResources.includes('kv')) {
        const getKvList = (): { id: string; title: string }[] => {
            const out = runCommand(`${wranglerCmd} kv namespace list`, true);
            return out ? extractJson<{ id: string; title: string }[]>(out) : [];
        };

        /**
         * Creates or finds a KV namespace.
         * @param titleToFind   The namespace title to search for in the listing.
         * @param wranglerArg   The argument(s) passed to `wrangler kv namespace create`.
         *                      For the preview namespace this is `<baseBinding> --preview`,
         *                      which wrangler stores under title `<baseBinding>_preview`.
         */
        const createOrFindKv = (titleToFind: string, wranglerArg: string): string => {
            let list = getKvList();
            let existing = list.find((ns) => ns.title === titleToFind);
            if (existing) return existing.id;
            try {
                const out = runCommand(`${wranglerCmd} kv namespace create ${wranglerArg}`);
                return parseKvCreateOutput(out);
            } catch (e) {
                // Race condition: another process may have created it — re-check
                list = getKvList();
                existing = list.find((ns) => ns.title === titleToFind);
                if (existing) return existing.id;
                throw e;
            }
        };

        if (resources.kv.production) {
            log(`Setting up KV Namespace '${resources.kv.production}'...`, YELLOW);
            try {
                kvId = createOrFindKv(resources.kv.production, resources.kv.production);
                log(`KV Namespace ready. ID: ${kvId}`, GREEN);
            } catch (e) {
                log(`Error setting up KV Namespace: ${e instanceof Error ? e.message : String(e)}`, RED);
            }
        }

        // KV preview is derived from the production binding; both can only exist together
        if (resources.kv.preview && resources.kv.production) {
            log(`Setting up KV Preview Namespace '${resources.kv.preview}'...`, YELLOW);
            try {
                kvPreviewId = createOrFindKv(resources.kv.preview, `${resources.kv.production} --preview`);
                log(`KV Preview Namespace ready. ID: ${kvPreviewId}`, GREEN);
            } catch (e) {
                log(`Error setting up KV Preview Namespace: ${e instanceof Error ? e.message : String(e)}`, RED);
            }
        }
    }

    // ── 3. R2 ─────────────────────────────────────────────────────────────
    if (selectedResources.includes('r2')) {
        const createOrFindR2 = (bucketName: string): void => {
            const out = runCommand(`${wranglerCmd} r2 bucket list --json`, true);
            const existing = out ? extractJson<{ name: string }[]>(out).some((b) => b.name === bucketName) : false;
            if (existing) {
                log(`R2 Bucket '${bucketName}' already exists.`, GREEN);
                return;
            }
            runCommand(`${wranglerCmd} r2 bucket create ${bucketName}`);
            log(`R2 Bucket '${bucketName}' created.`, GREEN);
        };

        if (resources.r2.production) {
            log(`Setting up R2 Bucket '${resources.r2.production}'...`, YELLOW);
            try {
                createOrFindR2(resources.r2.production);
            } catch (e) {
                log(`Error setting up R2 Bucket: ${e instanceof Error ? e.message : String(e)}`, RED);
            }
        }

        if (resources.r2.preview) {
            log(`Setting up R2 Preview Bucket '${resources.r2.preview}'...`, YELLOW);
            try {
                createOrFindR2(resources.r2.preview);
            } catch (e) {
                log(`Error setting up R2 Preview Bucket: ${e instanceof Error ? e.message : String(e)}`, RED);
            }
        }
    }

    // ── 4. Queue ──────────────────────────────────────────────────────────
    if (selectedResources.includes('queue')) {
        const createOrFindQueue = (queueName: string): void => {
            const out = runCommand(`${wranglerCmd} queues list --json`, true);
            const existing = out
                ? extractJson<{ queue_name: string }[]>(out).some((q) => q.queue_name === queueName)
                : false;
            if (existing) {
                log(`Queue '${queueName}' already exists.`, GREEN);
                return;
            }
            try {
                runCommand(`${wranglerCmd} queues create ${queueName}`);
                log(`Queue '${queueName}' created.`, GREEN);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                // Wrangler returns an error when queue already exists; treat as success
                if (msg.includes('already taken') || msg.includes('11009')) {
                    log(`Queue '${queueName}' already exists.`, GREEN);
                } else {
                    throw e;
                }
            }
        };

        if (resources.queue.production) {
            log(`Setting up Queue '${resources.queue.production}'...`, YELLOW);
            try {
                createOrFindQueue(resources.queue.production);
            } catch (e) {
                log(`Error setting up Queue: ${e instanceof Error ? e.message : String(e)}`, RED);
            }
        }

        if (resources.queue.preview) {
            log(`Setting up Preview Queue '${resources.queue.preview}'...`, YELLOW);
            try {
                createOrFindQueue(resources.queue.preview);
            } catch (e) {
                log(`Error setting up Preview Queue: ${e instanceof Error ? e.message : String(e)}`, RED);
            }
        }
    }

    // ── Summary ────────────────────────────────────────────────────────────
    log('', NC);
    log('Setup Complete!', GREEN);
    log('', NC);

    if (d1Id || kvId) {
        log('Production (add to GitHub Secrets):', YELLOW);
        if (d1Id) log(`  D1_DATABASE_ID=${d1Id}`);
        if (kvId) log(`  KV_NAMESPACE_ID=${kvId}`);
        log('', NC);
    }

    if (d1PreviewId || kvPreviewId) {
        log('Preview (add to GitHub Secrets):', YELLOW);
        if (d1PreviewId) log(`  D1_PREVIEW_DATABASE_ID=${d1PreviewId}`);
        if (kvPreviewId) log(`  KV_PREVIEW_NAMESPACE_ID=${kvPreviewId}`);
        log('', NC);
    }

    // Show analytics note only for apps that declare Analytics Engine datasets
    if (appConfig.analyticsDatasets.length > 0) {
        log('Analytics Engine datasets (auto-created on first write):', YELLOW);
        for (const dataset of appConfig.analyticsDatasets) {
            log(`  • ${dataset}`);
        }
        log(
            '  Set CLOUDFLARE_ACCOUNT_ID (var) and CLOUDFLARE_ANALYTICS_API_TOKEN (secret) for the /analytics page.',
            NC,
        );
        log('', NC);
    }

    // Regenerate cloudflare-env.d.ts
    log('Generating cloudflare-env.d.ts (wrangler types)...', YELLOW);
    try {
        runCommand(`${wranglerCmd} types`);
        log('cloudflare-env.d.ts updated.', GREEN);
    } catch (e) {
        log(`Warning: could not generate cloudflare-env.d.ts: ${e instanceof Error ? e.message : String(e)}`, YELLOW);
        log(`Run manually: cd ${appConfig.appDir} && npx wrangler types`, YELLOW);
    }
}

main().catch((err) => {
    console.error('cf:setup failed:', err);
    process.exit(1);
});

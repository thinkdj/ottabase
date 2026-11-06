import fs from 'fs-extra';
import { applyEdits, findNodeAtLocation, getNodeValue, modify, type JSONPath, type Node } from 'jsonc-parser';
import ora from 'ora';
import path from 'path';
import { APP_TEMPLATES, getMonorepoRoot, log, validateAppName, type AppTemplate } from '../utils/index.js';
import { envSection, findPlaceholders, parseWrangler } from './deploy.js';
import { keysToStrip, PRESETS, presetNames } from './presets.js';
import { applyStrip, planStrip } from './strip.js';

/**
 * Files and directories to skip when copying template (exact name matches).
 * Any file starting with '.env' is also skipped, except `.env.example`: it is the template
 * `pnpm env:secrets` fills and `cf-typegen` reads — see shouldSkip().
 */
const SKIP_PATTERNS = ['node_modules', '.next', '.wrangler', 'dist', '.turbo', 'coverage', 'pnpm-lock.yaml', 'tmp'];

/**
 * Files that need content transformation
 */
const TRANSFORM_FILES = ['package.json', 'wrangler.jsonc', 'cloudflare-config.json', 'README.md'];

/**
 * Cloudflare resources the templates name after the framework (`ottabase-db`, `ottabase-bucket-preview`,
 * `ottabase-files-private`, `ottabase-vault-staging`, `ottabase-queue-demo`). A second app in the same account would
 * share them (its private files and backups too), so they become `ottabase-<app>-…`.
 */
const RESOURCE_PREFIX = /(?<![a-z0-9-])ottabase-(db|bucket|files-private|vault|queue)(?![a-z0-9])/g;

/** Cloudflare's longest name for an R2 bucket or a queue. */
const MAX_RESOURCE_NAME = 63;

/** Placeholders every app in the account fills with the same value: never prefixed. */
const ACCOUNT_PLACEHOLDERS = new Set(['CLOUDFLARE_ACCOUNT_ID']);

/**
 * What a landing app shares with its web app: the database the web admin writes the content to, and the
 * public files bucket its images are served from. Per binding, the keys that name or identify the resource
 * (`database_id` is the placeholder CI fills, so it must be the web app's too).
 */
const SHARED_WITH_WEB = [
    { list: 'd1_databases', binding: 'OBCF_D1', keys: ['database_name', 'database_id', 'preview_database_id'] },
    { list: 'r2_buckets', binding: 'OBCF_R2', keys: ['bucket_name', 'preview_bucket_name'] },
] as const;

/**
 * A dev port where the template writes one: a local URL, a CLI flag, wrangler's `dev.port`, the Vite config's
 * `PORT_FE`/`PORT_BE` defaults, a bare `:3003` in prose ("admin on :3003"). Anything else that looks like a number
 * (a pixel size, a timeout, a time of day) is not a port.
 */
const PORT_REFERENCE =
    /(?<=(?:127\.0\.0\.1|localhost|0\.0\.0\.0):|(?:^|[\s`(]):|--port[ =]|-p |"port":\s*|PORT_(?:FE|BE)\s*\|\|\s*'?)(\d{2,5})\b/gm;

/** The resource a key of a wrangler binding names, for a template that names it after itself (otta-worker). */
const RESOURCE_KIND: Record<string, string> = {
    database_name: 'db',
    bucket_name: 'bucket',
    preview_bucket_name: 'bucket-preview',
    queue: 'queue',
};

/** Files whose text may name a dev port. */
const TEXT_FILE = /\.(?:[cm]?[jt]sx?|json|jsonc|md|mdx|html|example|ya?ml|toml|txt)$/i;

export interface ScaffoldOptions {
    /** A preset name: strip the demo and every package the preset does not keep. */
    preset?: string;
    /** Landing only: the web app whose database and public bucket it shares. Default: the only web app. */
    web?: string;
}

export interface ScaffoldResult {
    appDir: string;
    /** Landing only: the web app it was paired with. */
    pairedWith?: string;
    /** The values CI gives a deploy of env.production and env.preview (GitHub secrets, Workers Builds variables). */
    ciValues: { production: string[]; preview: string[] };
    /** The dev ports the app listens on, moved off every other app's. */
    ports: number[];
    /** Keys stripped by the preset, in order. */
    stripped: string[];
    /** npm dependencies the preset removed from the app's package.json. */
    dependenciesDropped: string[];
}

/**
 * Creates a new app from a template
 */
export async function newApp(template: AppTemplate, appName: string, options: ScaffoldOptions = {}): Promise<void> {
    const root = getMonorepoRoot();
    const templateConfig = APP_TEMPLATES[template];
    if (!templateConfig) {
        throw new Error(
            `Invalid template "${template}". Available templates: ${Object.keys(APP_TEMPLATES).join(', ')}`,
        );
    }
    log.info(`Creating new ${template} app: ${appName}`);
    log.dim(`  Template: ${templateConfig.source}`);
    log.dim(`  Target: ${path.join(root, 'apps', appName)}`);
    if (options.preset) log.dim(`  Preset: ${options.preset}`);

    const spinner = ora('Copying template files...').start();
    let result: ScaffoldResult;
    try {
        result = scaffoldApp(root, template, appName, options);
        spinner.succeed(
            result.stripped.length
                ? `Template copied; stripped ${result.stripped.join(', ')}`
                : 'Template files copied and configured',
        );
    } catch (error) {
        spinner.fail('Failed to create app');
        throw error;
    }

    log.success(`\nApp "${appName}" created successfully!`);
    if (result.pairedWith)
        log.dim(`  Reads apps/${result.pairedWith}'s database and public bucket; its admin writes the content.`);
    if (result.ports.length) log.dim(`  Dev ports: ${result.ports.join(', ')} (no other app in apps/ uses them)`);
    log.info('\nNext steps:');
    log.dim('  1. pnpm install');
    if (fs.existsSync(path.join(result.appDir, '.env.example')))
        log.dim(`  2. pnpm env:secrets --app=${appName}   # .env.local with development secrets`);
    log.dim(
        `  3. otta dev ${appName}   # pnpm dev runs ottabase.defaultApp in package.json; set it to ${appName} to make it this one`,
    );
    if (template === 'web')
        log.dim(
            '     First run: the bootstrap wizard creates the tables and the owner. Name and brand: ottabase/ottabase.config.ts',
        );
    log.dim(`  4. otta deploy ${appName}   # from a terminal: creates its Cloudflare resources and deploys`);
    const { production, preview } = result.ciValues;
    if (production.length || preview.length) {
        log.info(
            '\nCI (GitHub secrets, or Workers Builds variables) gives each deploy these values; cf:setup prints them:',
        );
        if (production.length) log.dim(`  production: ${production.join(', ')}`);
        if (preview.length) log.dim(`  preview:    ${preview.join(', ')}`);
    }
    if (options.preset) log.dim(`\nAdd a package later with: otta add <package> ${appName}`);
    log.dim('\nThe whole walkthrough: docs/NEW_APP.md');
}

/**
 * Copy the template into `apps/<name>`, rename it, and apply the preset. Pure of logging, so the
 * preset check and the tests can drive it. The target is removed again when anything fails.
 */
export function scaffoldApp(
    root: string,
    template: AppTemplate,
    appName: string,
    options: ScaffoldOptions = {},
): ScaffoldResult {
    const templateConfig = APP_TEMPLATES[template];
    if (!templateConfig) {
        throw new Error(
            `Invalid template "${template}". Available templates: ${Object.keys(APP_TEMPLATES).join(', ')}`,
        );
    }
    const preset = options.preset ? PRESETS[options.preset] : undefined;
    if (options.preset && !preset) {
        throw new Error(`Unknown preset "${options.preset}". Presets: ${presetNames().join(', ')}.`);
    }
    if (preset && template !== 'web') throw new Error('Presets apply to the web template only.');
    if (options.web && template !== 'landing') throw new Error('--web applies to the landing template only.');

    // validateAppName covers format + existence check
    const validation = validateAppName(appName, root);
    if (!validation.valid) throw new Error(validation.error);
    const pairedWith = template === 'landing' ? pairedWebApp(root, options.web) : undefined;

    const sourceDir = path.join(root, 'apps', templateConfig.source);
    const targetDir = path.join(root, 'apps', appName);
    if (!fs.existsSync(sourceDir)) {
        throw new Error(`Template source "${templateConfig.source}" not found at ${sourceDir}`);
    }

    try {
        copyTemplateFiles(sourceDir, targetDir);
        transformFiles(targetDir, appName, templateConfig.source);
        nameIdentity(targetDir, appName);
        uniqueRateLimits(root, targetDir);
        namespaceBareResources(targetDir, appName);
        prefixPlaceholders(targetDir, appName);
        const ports = uniquePorts(root, targetDir, pairedWith);
        if (pairedWith) pairWithWebApp(root, targetDir, pairedWith);
        checkResourceNames(targetDir);
        const made = { appDir: targetDir, pairedWith, ciValues: ciValuesOf(targetDir), ports };
        if (!preset) return { ...made, stripped: [], dependenciesDropped: [] };

        const plan = planStrip(root, appName, keysToStrip(targetDir, preset));
        applyStrip(root, plan);
        const dropped = plan.steps.find((step) => step.file.endsWith('/package.json') && step.action === 'edit');
        const dependenciesDropped = dropped ? dropped.detail.replace(/^drop /, '').split(', ') : [];
        fs.writeFileSync(
            path.join(targetDir, 'README.md'),
            presetReadme(appName, options.preset as string, preset.keep),
        );
        return { ...made, stripped: plan.keys, dependenciesDropped };
    } catch (error) {
        // Cleanup on failure
        if (fs.existsSync(targetDir)) fs.removeSync(targetDir);
        throw error;
    }
}

/**
 * Returns true if a file/dir should be excluded from the template copy.
 * Handles both exact name matches (SKIP_PATTERNS) and any .env* file other than the
 * example (.env, .env.local, .env.production, .env.staging, etc.).
 */
function shouldSkip(name: string): boolean {
    if (name.startsWith('.env') && name !== '.env.example') return true;
    return SKIP_PATTERNS.includes(name);
}

/**
 * Recursively copies template files with filtering.
 */
function copyTemplateFiles(sourceDir: string, targetDir: string): void {
    fs.ensureDirSync(targetDir);
    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
        if (shouldSkip(entry.name)) continue;
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);
        if (entry.isDirectory()) copyTemplateFiles(sourcePath, targetPath);
        else fs.copySync(sourcePath, targetPath);
    }
}

/**
 * Transforms files to use the new app name
 */
function transformFiles(targetDir: string, appName: string, sourceName: string): void {
    for (const file of TRANSFORM_FILES) {
        const filePath = path.join(targetDir, file);
        if (!fs.existsSync(filePath)) continue;

        let content = fs.readFileSync(filePath, 'utf8');

        // Replace scoped package name — specific enough that split/join is safe
        const sourcePackageName = `@ottabase/${sourceName}`;
        const targetPackageName = `@ottabase/${appName}`;
        content = content.split(sourcePackageName).join(targetPackageName);

        // Replace bare app name only at identifier boundaries to avoid partial-string corruption
        // (e.g. "otta-web" must not match inside "otta-web-v2" or "prev-otta-web")
        const escapedName = sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const namePattern = new RegExp(`(?<![a-z0-9-])${escapedName}(?![a-z0-9-])`, 'g');
        content = content.replace(namePattern, appName);

        // Cloudflare resources get the app's name, so two apps in one account never share a database.
        if (file === 'wrangler.jsonc') content = content.replace(RESOURCE_PREFIX, `ottabase-${appName}-$1`);

        // A template may stay out of CI (`deployable: false`, otta-worker); an app made from it is meant to ship.
        if (file === 'cloudflare-config.json') {
            try {
                const config = JSON.parse(content) as Record<string, unknown>;
                if (config.deployable === false) {
                    config.deployable = true;
                    content = JSON.stringify(config, null, 4) + '\n';
                }
            } catch {
                // Not JSON: leave it to otta deploy, which names the error.
            }
        }

        // For package.json, also update other fields
        if (file === 'package.json') {
            try {
                const pkg = JSON.parse(content);
                pkg.name = targetPackageName;
                pkg.homepage = pkg.homepage?.replace(sourceName, appName);
                // Only update directory if repository is already a proper object; never create a sparse one
                if (pkg.repository && typeof pkg.repository === 'object') {
                    pkg.repository.directory = `apps/${appName}`;
                }
                content = JSON.stringify(pkg, null, 4) + '\n';
            } catch {
                // If JSON parsing fails, use the string replacement
            }
        }

        fs.writeFileSync(filePath, content, 'utf8');
    }

    // Create a basic README if the template does not include one
    const readmePath = path.join(targetDir, 'README.md');
    if (!fs.existsSync(readmePath)) fs.writeFileSync(readmePath, starterReadme(appName, sourceName), 'utf8');
}

/**
 * The app's identity is its own: `appId` (which scopes rows in a database apps may share, e.g. alerts, and the
 * auth cookies) and `appName` live once, in `ottabase/ottabase.config.ts`; the health route, logs and the app
 * package read them. `APP_ID` in `.env.example` (copied to `.env.local` by `pnpm env:secrets`) outranks the file,
 * so it takes the same value. The template's byline (company, author, description) is the framework's, not the
 * app's: the company becomes the app's name, the author and description are left for the maker to write.
 */
function nameIdentity(targetDir: string, appName: string): void {
    const file = path.join(targetDir, 'ottabase', 'ottabase.config.ts');
    if (!fs.existsSync(file)) return;
    const title = appName
        .split('-')
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(' ');
    const content = fs
        .readFileSync(file, 'utf8')
        .replace(/(\bappId:\s*)(['"])[^'"]*\2/, `$1'${appName}'`)
        .replace(/(\bappName:\s*)(['"])[^'"]*\2/, `$1'${title}'`)
        .replace(/(\bcompanyName:\s*)(['"])[^'"]*\2/, `$1'${title}'`)
        .replace(/(\bauthor:\s*)(['"])[^'"]*\2/, `$1''`)
        .replace(/(\bdescription:\s*)(['"])[^'"]*\2/, `$1'${title}'`);
    fs.writeFileSync(file, content, 'utf8');

    const envExample = path.join(targetDir, '.env.example');
    if (fs.existsSync(envExample)) {
        const text = fs.readFileSync(envExample, 'utf8');
        fs.writeFileSync(envExample, text.replace(/^APP_ID=.*$/m, `APP_ID=${appName}`), 'utf8');
    }
}

/**
 * The values CI fills a deploy's placeholders with come from one bag (GitHub's secrets, one environment), so
 * two apps using `D1_DATABASE_ID` would deploy against one database. Every placeholder of the new app but the
 * account's becomes `OTTABASE_<APP>_<NAME>`, comments included. A landing app's shared ones are set to its web
 * app's afterwards.
 */
function prefixPlaceholders(targetDir: string, appName: string): void {
    const file = path.join(targetDir, 'wrangler.jsonc');
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, 'utf8');
    const names = findPlaceholders(text).filter((name) => !ACCOUNT_PLACEHOLDERS.has(name));
    if (!names.length) return;
    const prefix = `OTTABASE_${appName.toUpperCase().replace(/-/g, '_')}_`;
    const longestFirst = [...names].sort((a, b) => b.length - a.length).join('|');
    const pattern = new RegExp(`(?<![A-Z0-9_])(?:${longestFirst})(?![A-Z0-9_])`, 'g');
    fs.writeFileSync(
        file,
        text.replace(pattern, (name) => prefix + name),
        'utf8',
    );
}

/** The placeholders of env.production and env.preview: what CI must have to deploy the app and its previews. */
function ciValuesOf(targetDir: string): { production: string[]; preview: string[] } {
    const file = path.join(targetDir, 'wrangler.jsonc');
    if (!fs.existsSync(file)) return { production: [], preview: [] };
    const text = fs.readFileSync(file, 'utf8');
    const of = (env: string) => {
        const section = envSection(text, env);
        return section ? findPlaceholders(text.slice(section.start, section.end)) : [];
    };
    return { production: of('production'), preview: of('preview') };
}

/**
 * A template that names its resources after itself (otta-worker's database and bucket are `otta-worker`) leaves
 * the new app's named just `<app>`; they become `ottabase-<app>-db`, `-bucket`, `-queue` like every other app's.
 */
function namespaceBareResources(targetDir: string, appName: string): void {
    const file = path.join(targetDir, 'wrangler.jsonc');
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, 'utf8');
    const nodes: { node: Node; kind: string }[] = [];
    const visit = (node: Node | undefined) => {
        if (!node) return;
        const [key, value] = node.children ?? [];
        const kind = RESOURCE_KIND[String(key?.value)];
        if (node.type === 'property' && kind && value?.type === 'string' && value.value === appName) {
            nodes.push({ node: value, kind });
            return;
        }
        for (const child of node.children ?? []) visit(child);
    };
    visit(parseWrangler(text));
    let content = text;
    for (const { node, kind } of nodes.sort((a, b) => b.node.offset - a.node.offset)) {
        const name = JSON.stringify(`ottabase-${appName}-${kind}`);
        content = content.slice(0, node.offset) + name + content.slice(node.offset + node.length);
    }
    if (content !== text) fs.writeFileSync(file, content, 'utf8');
}

/** Bucket and queue names longer than Cloudflare allows: `ottabase-<app>-files-private-preview` grows with the app. */
function checkResourceNames(targetDir: string): void {
    const file = path.join(targetDir, 'wrangler.jsonc');
    if (!fs.existsSync(file)) return;
    const tooLong: string[] = [];
    const visit = (node: Node | undefined) => {
        if (!node) return;
        const [key, value] = node.children ?? [];
        if (node.type === 'property' && value?.type === 'string') {
            if (/^(?:bucket_name|preview_bucket_name|queue)$/.test(String(key?.value))) {
                const name = String(value.value);
                if (name.length > MAX_RESOURCE_NAME) tooLong.push(name);
            }
            return;
        }
        for (const child of node.children ?? []) visit(child);
    };
    visit(parseWrangler(fs.readFileSync(file, 'utf8')));
    if (tooLong.length)
        throw new Error(
            `Cloudflare allows ${MAX_RESOURCE_NAME} characters in a bucket or queue name; ${[...new Set(tooLong)].join(', ')} ${tooLong.length > 1 ? 'are' : 'is'} longer. Choose a shorter app name.`,
        );
}

/**
 * The dev ports an app declares: the URLs of its `ottabase.start` processes (what `otta dev` starts and
 * `dev:kill` frees) and wrangler's `dev.port`.
 */
function declaredPorts(appDir: string): number[] {
    const ports = new Set<number>();
    const collect = (value: unknown): void => {
        if (typeof value === 'string') {
            try {
                const port = Number(new URL(value).port);
                if (port > 0) ports.add(port);
            } catch {
                // not a URL
            }
        } else if (value && typeof value === 'object') {
            for (const item of Object.values(value)) collect(item);
        }
    };
    const pkg = path.join(appDir, 'package.json');
    if (fs.existsSync(pkg)) {
        try {
            collect((fs.readJsonSync(pkg) as { ottabase?: { start?: unknown } }).ottabase?.start);
        } catch {
            // a broken package.json declares nothing
        }
    }
    const wrangler = path.join(appDir, 'wrangler.jsonc');
    if (fs.existsSync(wrangler)) {
        const node = findNodeAtLocation(parseWrangler(fs.readFileSync(wrangler, 'utf8')), ['dev', 'port']);
        if (typeof node?.value === 'number') ports.add(node.value);
    }
    return [...ports].sort((a, b) => a - b);
}

/** Every text file under `dir`, skipping what the template copy skips. */
function textFiles(dir: string, found: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (shouldSkip(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) textFiles(full, found);
        else if (TEXT_FILE.test(entry.name) || entry.name === '.env.example') found.push(full);
    }
    return found;
}

/**
 * Two apps on one dev port cannot run side by side, so each port the template declares moves to the first one
 * at or above it that no other app in `apps/` declares, wherever the app writes it (start URLs, wrangler's
 * `dev.port`, the Vite config, scripts, docs). A landing app's references to its web app's ports (the README's
 * "admin on :3003") follow the web app it pairs with. Returns the app's new ports.
 */
function uniquePorts(root: string, targetDir: string, pairedWith?: string): number[] {
    const appsDir = path.join(root, 'apps');
    const used = new Set<number>();
    for (const app of fs.readdirSync(appsDir)) {
        const dir = path.join(appsDir, app);
        if (dir !== targetDir && fs.statSync(dir).isDirectory()) for (const port of declaredPorts(dir)) used.add(port);
    }
    const moves = new Map<number, number>();
    for (const port of declaredPorts(targetDir)) {
        let next = port;
        while (used.has(next)) next++;
        used.add(next);
        moves.set(port, next);
    }
    if (pairedWith) {
        const template = declaredPorts(path.join(appsDir, 'otta-web'));
        const web = declaredPorts(path.join(appsDir, pairedWith));
        if (template.length === web.length) template.forEach((port, i) => moves.set(port, web[i] as number));
    }
    if ([...moves].every(([from, to]) => from === to)) return declaredPorts(targetDir);
    for (const file of textFiles(targetDir)) {
        const text = fs.readFileSync(file, 'utf8');
        const moved = text.replace(PORT_REFERENCE, (port) => String(moves.get(Number(port)) ?? port));
        if (moved !== text) fs.writeFileSync(file, moved, 'utf8');
    }
    return declaredPorts(targetDir);
}

/** The `appId` a web app's `ottabase/ottabase.config.ts` sets. */
function appIdOf(appDir: string): string {
    const config = path.join(appDir, 'ottabase', 'ottabase.config.ts');
    const match = /\bappId:\s*['"]([^'"]+)['"]/.exec(fs.readFileSync(config, 'utf8'));
    if (!match) throw new Error(`apps/${path.basename(appDir)}/ottabase/ottabase.config.ts sets no appId.`);
    return match[1];
}

/** The value nodes of every `namespace_id` in a wrangler config, wherever the rate limiter is declared. */
function namespaceIdNodes(node: Node | undefined, found: Node[] = []): Node[] {
    if (!node) return found;
    const [key, value] = node.children ?? [];
    if (node.type === 'property' && key?.value === 'namespace_id' && value) {
        found.push(value);
        return found;
    }
    for (const child of node.children ?? []) namespaceIdNodes(child, found);
    return found;
}

/**
 * A rate limiter's `namespace_id` is unique to the Cloudflare account: two Workers with the same one share
 * the counters. Each distinct id the template uses gets the next one no other app in `apps/` holds, so ids the
 * template keeps equal (local dev and production) stay equal and every env keeps its own.
 */
function uniqueRateLimits(root: string, targetDir: string): void {
    const file = path.join(targetDir, 'wrangler.jsonc');
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, 'utf8');
    const nodes = namespaceIdNodes(parseWrangler(text));
    if (!nodes.length) return;

    const used: number[] = [];
    const appsDir = path.join(root, 'apps');
    for (const app of fs.readdirSync(appsDir)) {
        const other = path.join(appsDir, app, 'wrangler.jsonc');
        if (path.join(appsDir, app) === targetDir || !fs.existsSync(other)) continue;
        for (const node of namespaceIdNodes(parseWrangler(fs.readFileSync(other, 'utf8')))) {
            const id = Number(node.value);
            if (Number.isInteger(id)) used.push(id);
        }
    }
    let next = Math.max(0, ...used) + 1;
    const fresh = new Map<string, number>();
    for (const node of nodes) if (!fresh.has(String(node.value))) fresh.set(String(node.value), next++);

    let content = text;
    // From the end backwards, so every earlier node's offset still holds.
    for (const node of [...nodes].sort((a, b) => b.offset - a.offset)) {
        const id = fresh.get(String(node.value)) as number;
        const value = node.type === 'string' ? JSON.stringify(String(id)) : String(id);
        content = content.slice(0, node.offset) + value + content.slice(node.offset + node.length);
    }
    fs.writeFileSync(file, content, 'utf8');
}

/** The apps made from the web template: they carry `ottabase/ottabase.config.ts`. */
function webApps(root: string): string[] {
    const appsDir = path.join(root, 'apps');
    return fs
        .readdirSync(appsDir)
        .filter((app) => fs.existsSync(path.join(appsDir, app, 'ottabase', 'ottabase.config.ts')))
        .sort();
}

/** The web app a new landing app pairs with: the one named, or the only one there is. */
function pairedWebApp(root: string, requested?: string): string {
    const apps = webApps(root);
    if (requested) {
        if (!apps.includes(requested))
            throw new Error(`--web ${requested}: no web app by that name (web apps: ${apps.join(', ') || 'none'}).`);
        return requested;
    }
    if (apps.length === 1) return apps[0];
    if (!apps.length)
        throw new Error(
            "A landing app shows the content a web app's admin writes, and there is no web app. Create one first: otta new web <name>",
        );
    throw new Error(`A landing app reads one web app's database; pass --web with one of: ${apps.join(', ')}.`);
}

/**
 * A landing app reads the content its web app's admin writes, so it binds that app's database and public
 * bucket (every env block, by the names the web app's wrangler.jsonc gives them: `otta deploy` creates a
 * resource it does not find, so another name would be an empty database), shows that app's `appId`, and
 * opens its local `.wrangler` state in dev.
 */
function pairWithWebApp(root: string, targetDir: string, webApp: string): void {
    const webDir = path.join(root, 'apps', webApp);
    const landing = path.basename(targetDir);

    // The template is written against otta-web: its comments, README and the dev state path name it.
    const templateWeb = /(?<![a-z0-9-])otta-web(?![a-z0-9-])/g;
    for (const name of ['wrangler.jsonc', 'README.md', 'next.config.js']) {
        const file = path.join(targetDir, name);
        if (fs.existsSync(file))
            fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(templateWeb, webApp), 'utf8');
    }

    const file = path.join(targetDir, 'wrangler.jsonc');
    let text = fs.readFileSync(file, 'utf8');
    const tree = parseWrangler(text);
    const webTree = parseWrangler(fs.readFileSync(path.join(webDir, 'wrangler.jsonc'), 'utf8'));
    const entriesAt = (config: Node, at: JSONPath) => {
        const node = findNodeAtLocation(config, at);
        const value: unknown = node ? getNodeValue(node) : undefined;
        return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    };
    const envNode = findNodeAtLocation(tree, ['env']);
    const envs = envNode?.type === 'object' ? Object.keys(getNodeValue(envNode) as object) : [];
    const appId = appIdOf(webDir);

    const edits: [JSONPath, string][] = [];
    for (const block of [[], ...envs.map((env) => ['env', env])]) {
        const where = block.length ? `env.${block[1]}` : 'its top level';
        for (const { list, binding, keys } of SHARED_WITH_WEB) {
            const index = entriesAt(tree, [...block, list]).findIndex((entry) => entry?.binding === binding);
            if (index < 0) continue;
            const mine = entriesAt(tree, [...block, list])[index];
            const theirs = entriesAt(webTree, [...block, list]).find((entry) => entry?.binding === binding);
            for (const key of keys) {
                if (!(key in mine)) continue;
                const name = theirs?.[key];
                if (typeof name !== 'string')
                    throw new Error(
                        `apps/${landing} shares ${binding} with apps/${webApp}, whose wrangler.jsonc gives no ${key} for it at ${where}.`,
                    );
                edits.push([[...block, list, index, key], name]);
            }
        }
        if (findNodeAtLocation(tree, [...block, 'vars', 'APP_ID'])) edits.push([[...block, 'vars', 'APP_ID'], appId]);
    }
    for (const [at, value] of edits) text = applyEdits(text, modify(text, at, value, {}));
    fs.writeFileSync(file, text, 'utf8');
}

function starterReadme(appName: string, sourceName: string): string {
    return `# ${appName}

A new Ottabase app scaffolded from the \`${sourceName}\` template.

## Development

\`\`\`bash
# From monorepo root
otta dev ${appName}

# Or with pnpm
pnpm --filter @ottabase/${appName} dev
\`\`\`

## Build

\`\`\`bash
otta build ${appName}
\`\`\`

## Test

\`\`\`bash
otta test ${appName}
\`\`\`
`;
}

function presetReadme(appName: string, preset: string, keep: string[]): string {
    const packages = keep.length ? keep.map((key) => `\`${key}\``).join(', ') : 'none beyond the core';
    return `# ${appName}

An Ottabase app from the \`web\` template, preset \`${preset}\`: auth, organizations and RBAC, the admin shell and
Brand Engine, plus ${packages}. The demo gallery and the other packages were stripped; add one back with
\`otta add <package> ${appName}\` (its pages are copied from \`apps/otta-web\`, whose routes for them are marked
\`otta:only <package>\`).

## Run it

\`\`\`bash
pnpm install
otta dev ${appName}          # Vite + a local Worker; open the URL it prints
\`\`\`

First run: the app shows its bootstrap wizard (\`/__bootstrap__\`), which creates the tables and the owner account.
\`pnpm env:secrets --app=${appName}\` fills \`.env.local\` with development secrets.

## Ship it

\`\`\`bash
otta deploy ${appName}       # creates the Cloudflare resources, sets the secrets, deploys, bootstraps
\`\`\`

## Where things are

- \`ottabase/packages.ts\`: the one list of installed packages; \`ottabase/packages/*.ts\` their settings.
- \`ottabase/models/\`, \`ottabase/db/schema.ts\`: your tables and models (OttaORM, see \`AGENTS.MD\` at the root).
- \`src/pages/\`, \`src/router.tsx\`: the pages; \`worker/routes/\`: the API.
- \`ottabase/footprints.json\`: what \`otta strip\` can still take out.
`;
}

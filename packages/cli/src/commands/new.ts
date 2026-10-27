import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import { APP_TEMPLATES, getMonorepoRoot, log, validateAppName, type AppTemplate } from '../utils/index.js';
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
 * `ottabase-queue-demo`). A second app in the same account would share them, so they take the app's name.
 */
const RESOURCE_PREFIX = /(?<![a-z0-9-])ottabase-(db|bucket|queue)(?![a-z0-9])/g;

export interface ScaffoldOptions {
    /** A preset name: strip the demo and every package the preset does not keep. */
    preset?: string;
}

export interface ScaffoldResult {
    appDir: string;
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
    try {
        const result = scaffoldApp(root, template, appName, options);
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
    log.info('\nNext steps:');
    log.dim('  1. pnpm install');
    log.dim(`  2. otta dev ${appName}`);
    log.dim(`  3. otta deploy ${appName}   # when it is ready for the world`);
    if (options.preset) log.dim(`\nAdd a package later with: otta add <package> ${appName}`);
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

    // validateAppName covers format + existence check
    const validation = validateAppName(appName, root);
    if (!validation.valid) throw new Error(validation.error);

    const sourceDir = path.join(root, 'apps', templateConfig.source);
    const targetDir = path.join(root, 'apps', appName);
    if (!fs.existsSync(sourceDir)) {
        throw new Error(`Template source "${templateConfig.source}" not found at ${sourceDir}`);
    }

    try {
        copyTemplateFiles(sourceDir, targetDir);
        transformFiles(targetDir, appName, templateConfig.source);
        if (!preset) return { appDir: targetDir, stripped: [], dependenciesDropped: [] };

        const plan = planStrip(root, appName, keysToStrip(targetDir, preset));
        applyStrip(root, plan);
        const dropped = plan.steps.find((step) => step.file.endsWith('/package.json') && step.action === 'edit');
        const dependenciesDropped = dropped ? dropped.detail.replace(/^drop /, '').split(', ') : [];
        fs.writeFileSync(
            path.join(targetDir, 'README.md'),
            presetReadme(appName, options.preset as string, preset.keep),
        );
        return { appDir: targetDir, stripped: plan.keys, dependenciesDropped };
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
        if (file === 'wrangler.jsonc') content = content.replace(RESOURCE_PREFIX, `${appName}-$1`);

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

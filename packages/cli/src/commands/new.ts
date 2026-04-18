import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import { APP_TEMPLATES, getMonorepoRoot, log, validateAppName, type AppTemplate } from '../utils/index.js';

/**
 * Files and directories to skip when copying template (exact name matches).
 * Any file starting with '.env' is also skipped — see shouldSkip().
 */
const SKIP_PATTERNS = ['node_modules', '.next', '.wrangler', 'dist', '.turbo', 'coverage', 'pnpm-lock.yaml'];

/**
 * Files that need content transformation
 */
const TRANSFORM_FILES = ['package.json', 'wrangler.jsonc', 'README.md'];

/**
 * Creates a new app from a template
 */
export async function newApp(template: AppTemplate, appName: string): Promise<void> {
    // The template key is validated by the caller (cli.ts) for interactive use,
    // but newApp also validates here to be safe when called programmatically.
    const templateConfig = APP_TEMPLATES[template];
    if (!templateConfig) {
        throw new Error(
            `Invalid template "${template}". Available templates: ${Object.keys(APP_TEMPLATES).join(', ')}`,
        );
    }

    // validateAppName covers format + existence check
    const validation = validateAppName(appName);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const root = getMonorepoRoot();
    const sourceDir = path.join(root, 'apps', templateConfig.source);
    const targetDir = path.join(root, 'apps', appName);

    // Verify source exists
    if (!fs.existsSync(sourceDir)) {
        throw new Error(`Template source "${templateConfig.source}" not found at ${sourceDir}`);
    }

    log.info(`Creating new ${template} app: ${appName}`);
    log.dim(`  Template: ${templateConfig.source}`);
    log.dim(`  Target: ${targetDir}`);

    const spinner = ora('Copying template files...').start();

    try {
        // Copy files
        await copyTemplateFiles(sourceDir, targetDir);
        spinner.succeed('Template files copied');

        // Transform package.json
        spinner.start('Transforming configuration files...');
        await transformFiles(targetDir, appName, templateConfig.source);
        spinner.succeed('Configuration files transformed');

        // Show success message
        log.success(`\nApp "${appName}" created successfully!`);
        log.info('\nNext steps:');
        log.dim(`  1. cd apps/${appName}`);
        log.dim('  2. pnpm install');
        log.dim(`  3. otta dev ${appName}`);
        log.info('\nOr from the monorepo root:');
        log.dim(`  otta dev ${appName}`);
    } catch (error) {
        spinner.fail('Failed to create app');
        // Cleanup on failure
        if (fs.existsSync(targetDir)) {
            await fs.remove(targetDir);
        }
        throw error;
    }
}

/**
 * Returns true if a file/dir should be excluded from the template copy.
 * Handles both exact name matches (SKIP_PATTERNS) and any .env* file
 * (.env, .env.local, .env.production, .env.staging, etc.).
 */
function shouldSkip(name: string): boolean {
    if (name.startsWith('.env')) return true;
    return SKIP_PATTERNS.includes(name);
}

/**
 * Recursively copies template files with filtering.
 * Uses Promise.all for parallel I/O within each directory level.
 */
async function copyTemplateFiles(sourceDir: string, targetDir: string): Promise<void> {
    await fs.ensureDir(targetDir);

    const entries = await fs.readdir(sourceDir, { withFileTypes: true });

    // Filter first, then copy all entries in parallel
    const eligible = entries.filter((e) => !shouldSkip(e.name));

    await Promise.all(
        eligible.map((entry) => {
            const sourcePath = path.join(sourceDir, entry.name);
            const targetPath = path.join(targetDir, entry.name);

            if (entry.isDirectory()) {
                return copyTemplateFiles(sourcePath, targetPath);
            }
            return fs.copy(sourcePath, targetPath);
        }),
    );
}

/**
 * Transforms files to use the new app name
 */
async function transformFiles(targetDir: string, appName: string, sourceName: string): Promise<void> {
    for (const file of TRANSFORM_FILES) {
        const filePath = path.join(targetDir, file);
        if (!fs.existsSync(filePath)) continue;

        let content = await fs.readFile(filePath, 'utf8');

        // Replace scoped package name — specific enough that split/join is safe
        const sourcePackageName = `@ottabase/${sourceName}`;
        const targetPackageName = `@ottabase/${appName}`;
        content = content.split(sourcePackageName).join(targetPackageName);

        // Replace bare app name only at identifier boundaries to avoid partial-string corruption
        // (e.g. "otta-web" must not match inside "otta-web-v2" or "prev-otta-web")
        const escapedName = sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const namePattern = new RegExp(`(?<![a-z0-9-])${escapedName}(?![a-z0-9-])`, 'g');
        content = content.replace(namePattern, appName);

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

        await fs.writeFile(filePath, content, 'utf8');
    }

    // Create a basic README if the template does not include one
    const readmePath = path.join(targetDir, 'README.md');
    if (!fs.existsSync(readmePath)) {
        const readmeContent = `# ${appName}

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
        await fs.writeFile(readmePath, readmeContent, 'utf8');
    }
}

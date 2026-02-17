#!/usr/bin/env node
/**
 * create-app – Scaffold a new Ottabase app from the TanStack template.
 *
 * Usage:
 *   pnpm create-app my-app
 *   pnpm create-app my-app --template tanstack
 *
 * Creates a new app in apps/<name> based on the template app,
 * with a clean starting point (no demo pages, fresh config).
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

function log(msg: string, color: string = NC) {
    console.log(`${color}${msg}${NC}`);
}

function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

/**
 * Recursively copy a directory, skipping excluded paths.
 */
function copyDirSync(src: string, dest: string, excludes: string[] = []): void {
    fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        // Check if this path should be excluded
        const relativePath = path.relative(src, srcPath);
        if (excludes.some((ex) => relativePath === ex || relativePath.startsWith(ex + path.sep))) {
            continue;
        }

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath, excludes.map((ex) => {
                if (ex.startsWith(relativePath + path.sep)) {
                    return ex.slice(relativePath.length + 1);
                }
                return ex;
            }).filter(Boolean));
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function main() {
    const args = process.argv.slice(2);

    // Parse arguments
    let appName = '';
    let template = 'tanstack';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--template' && args[i + 1]) {
            template = args[i + 1];
            i++;
        } else if (!args[i].startsWith('-')) {
            appName = args[i];
        }
    }

    if (!appName) {
        log('');
        log(`${BOLD}Usage:${NC} pnpm create-app <app-name> [--template tanstack]`);
        log('');
        log('Creates a new Ottabase app in apps/<app-name>.');
        log('');
        log(`${BOLD}Options:${NC}`);
        log('  --template <name>  Template to use (default: tanstack)');
        log('');
        log(`${BOLD}Examples:${NC}`);
        log('  pnpm create-app my-saas');
        log('  pnpm create-app landing-page --template tanstack');
        log('');
        process.exit(1);
    }

    // Validate app name (lowercase, alphanumeric, hyphens)
    if (!/^[a-z][a-z0-9-]*$/.test(appName)) {
        log(`${RED}Error: App name must start with a letter and contain only lowercase letters, numbers, and hyphens.${NC}`);
        process.exit(1);
    }

    // Find monorepo root (walk up from cwd looking for pnpm-workspace.yaml)
    let root = process.cwd();
    while (!fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))) {
        const parent = path.dirname(root);
        if (parent === root) {
            log(`${RED}Error: Could not find monorepo root (no pnpm-workspace.yaml found).${NC}`);
            process.exit(1);
        }
        root = parent;
    }

    const templateMap: Record<string, string> = {
        tanstack: 'ottabase-template-app-tanstack',
    };

    const templateDir = templateMap[template];
    if (!templateDir) {
        log(`${RED}Error: Unknown template "${template}". Available: ${Object.keys(templateMap).join(', ')}${NC}`);
        process.exit(1);
    }

    const srcDir = path.join(root, 'apps', templateDir);
    const destDir = path.join(root, 'apps', appName);

    if (!fs.existsSync(srcDir)) {
        log(`${RED}Error: Template app not found at ${srcDir}${NC}`);
        process.exit(1);
    }

    if (fs.existsSync(destDir)) {
        log(`${RED}Error: Directory already exists: apps/${appName}${NC}`);
        log(`${YELLOW}Choose a different name or remove the existing directory.${NC}`);
        process.exit(1);
    }

    log('');
    log(`${BOLD}${CYAN}🚀 Ottabase Create App${NC}`);
    log('');
    log(`  App name:  ${BOLD}${appName}${NC}`);
    log(`  Template:  ${template} (${templateDir})`);
    log(`  Location:  apps/${appName}/`);
    log('');

    const answer = await prompt(`${BOLD}Continue? (y/N): ${NC}`);
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        log('Aborted.', RED);
        process.exit(0);
    }

    log('');
    log('Creating app...', YELLOW);

    // Directories and files to exclude from the copy
    const excludes = [
        'node_modules',
        '.turbo',
        '.wrangler',
        'dist',
        '.env',
        '.env.local',
        '.env.development.local',
        'cloudflare-env.d.ts',
        // Demo pages (user starts fresh)
        path.join('src', 'pages', 'demo'),
    ];

    // Copy template
    copyDirSync(srcDir, destDir, excludes);
    log(`  ${GREEN}✓${NC} Copied template files`);

    // Update package.json
    const pkgJsonPath = path.join(destDir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        pkgJson.name = `@ottabase/${appName}`;
        pkgJson.version = '0.1.0';
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4) + '\n');
        log(`  ${GREEN}✓${NC} Updated package.json (name: @ottabase/${appName})`);
    }

    // Copy .env.example if it exists
    const envExampleSrc = path.join(srcDir, '.env.example');
    const envExampleDest = path.join(destDir, '.env.example');
    if (fs.existsSync(envExampleSrc) && !fs.existsSync(envExampleDest)) {
        fs.copyFileSync(envExampleSrc, envExampleDest);
        log(`  ${GREEN}✓${NC} Copied .env.example`);
    }

    log('');
    log(`${GREEN}${BOLD}✅ App created successfully!${NC}`);
    log('');
    log(`${BOLD}Next steps:${NC}`);
    log('');
    log(`  1. Install dependencies:`);
    log(`     ${CYAN}pnpm install${NC}`);
    log('');
    log(`  2. Set up your environment:`);
    log(`     ${CYAN}cp apps/${appName}/.env.example apps/${appName}/.env.local${NC}`);
    log('');
    log(`  3. Build packages:`);
    log(`     ${CYAN}pnpm build:pkg${NC}`);
    log('');
    log(`  4. Start development:`);
    log(`     ${CYAN}cd apps/${appName} && pnpm dev${NC}`);
    log('');
    log(`  5. Initialize database:`);
    log(`     ${CYAN}curl -X POST http://localhost:3004/api/ottaorm/init${NC}`);
    log('');
}

main().catch((err) => {
    console.error('create-app failed:', err);
    process.exit(1);
});

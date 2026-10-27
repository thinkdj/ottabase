import { Command } from 'commander';
import pkg from '../package.json' with { type: 'json' };
import {
    addPackage,
    buildApp,
    checkPresets,
    cleanApp,
    deployCommand,
    lintApp,
    listAllApps,
    newApp,
    presetNames,
    proUpdateCommand,
    showAppInfo,
    showPresets,
    showTemplates,
    startApp,
    stripPackages,
    testApp,
    typeCheckApp,
} from './commands/index.js';
import { log, type AppTemplate } from './utils/index.js';

// version is read from package.json at build time via JSON import to avoid
// hardcoding and version drift between package.json and the CLI banner.
const { version } = pkg;

const program = new Command();

// CLI metadata
program.name('otta').description('Ottabase monorepo CLI - scaffold, develop, build, and test apps').version(version);

// Commander v12 exits with code 1 when no subcommand is provided.
// The default action overrides that: show help and exit cleanly (code 0).
program.action(() => {
    program.help();
});

// =====================================================
// SCAFFOLDING COMMANDS
// =====================================================

program
    .command('new <template> <name>')
    .description('Create a new app from a template')
    .option('--preset <preset>', `Keep only part of the web template: ${presetNames().join(', ')}`)
    .option('--minimal', 'Shorthand for --preset minimal')
    .addHelpText(
        'after',
        `
Templates:
  web       Full-featured Vite + TanStack Router + Cloudflare Workers app
  landing   Next.js landing page with Cloudflare Workers deployment
  worker    Single Worker, server-rendered and API-first (no SPA)

Presets (web only; otta presets lists them):
  minimal   Auth, organizations, RBAC, the admin shell, Brand Engine. Nothing else.
  blog      minimal plus the blog, comments and the legal pages
  saas      minimal plus alerts, API keys, flags, meter, postmaster, legal, referrals, vault, webhooks

Examples:
  $ otta new web my-app
  $ otta new web my-app --minimal
  $ otta new web my-app --preset saas
  $ otta new landing my-site
  $ otta new worker my-tool
`,
    )
    .action(async (template: string, name: string, options: { preset?: string; minimal?: boolean }) => {
        try {
            await newApp(template as AppTemplate, name, { preset: options.minimal ? 'minimal' : options.preset });
        } catch (error) {
            log.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

program
    .command('templates')
    .description('Show available app templates')
    .action(() => {
        showTemplates();
    });

const presets = program
    .command('presets')
    .description('Show the presets of otta new web, or check that they scaffold working apps')
    .action(() => {
        showPresets();
    });
presets
    .command('check [presets...]')
    .description('Scaffold each preset (all by default), then type-check, lint and test the result')
    .option('--keep', 'Leave apps/preset-check-<preset> in place to look at')
    .action((names: string[], options: { keep?: boolean }) => {
        try {
            if (!checkPresets(names, { keep: options.keep })) process.exit(1);
        } catch (error) {
            log.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

program
    .command('strip <keys> [app]')
    .description('Take the demo, or a package, out of an app: the inverse of otta add')
    .option('--dry-run', 'Print the planned file changes without writing them')
    .addHelpText(
        'after',
        `
Examples:
  $ otta strip demo my-app             The demo gallery, fixtures, seed content and demo routes
  $ otta strip ottablog my-app         The blog: pages, routes, worker handlers, tables, the dependency
  $ otta strip ottaai,shortlinks       Several at once, from the default app
  $ otta strip demo my-app --dry-run

What goes: what otta add wrote (dependency, composition, list entry, client key, table re-exports),
the files the app's ottabase/footprints.json lists for the key, and the lines marked
"otta:only <key>" or "otta:begin <key> … otta:end <key>" in the files the app keeps. A key that
another one needs takes it along (stripping ottablog strips comments).
`,
    )
    .action(async (keys: string, app: string | undefined, options: { dryRun?: boolean }) => {
        try {
            await stripPackages(
                keys
                    .split(',')
                    .map((key) => key.trim())
                    .filter(Boolean),
                app,
                { dryRun: options.dryRun },
            );
        } catch (error) {
            log.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

program
    .command('add <package> [app]')
    .description('Install a workspace package into an app: dependency, composition, package list, client key, tables')
    .option('--dry-run', 'Print the planned file changes without writing them')
    .addHelpText(
        'after',
        `
Examples:
  $ otta add vault                 Add @ottabase/vault to the default app
  $ otta add @ottabase/postmaster my-app
  $ otta add meter my-app --dry-run
  $ otta add pro my-app            Every package of a bundle: packages/pro/*

The package declares itself in its package.json "ottabase" field ({ key, factory, export?, tables?, adminPages? }).
A bundle is a folder under packages/ with packages inside and no package.json of its own, such as packages/pro.
The composition and pages come from the package's app/ folder when it ships one, else the composition is copied
from apps/otta-web, else a stub is written for you to fill in.
`,
    )
    .action(async (packageName: string, app: string | undefined, options: { dryRun?: boolean }) => {
        try {
            await addPackage(packageName, app, { dryRun: options.dryRun });
        } catch (error) {
            log.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

// =====================================================
// DEVELOPMENT COMMANDS
// =====================================================

interface StartCommandOptions {
    env?: string;
    port?: string;
    portFor?: string[];
    process?: string;
    skipBuild?: boolean;
    open?: boolean;
    dryRun?: boolean;
    timeout?: string;
}

function collect(value: string, previous: string[]): string[] {
    return [...previous, value];
}

function parsePort(value: string | undefined, label: string): number | undefined {
    if (value === undefined) return undefined;
    const port = Number(value);
    if (!Number.isInteger(port) || port <= 0 || port >= 65536) {
        throw new Error(`Invalid ${label} "${value}". Must be a number between 1 and 65535.`);
    }
    return port;
}

function parseProcessPorts(values: string[] = []): Record<string, number> {
    const result: Record<string, number> = {};
    for (const value of values) {
        const separator = value.indexOf('=');
        if (separator <= 0) {
            throw new Error(`Invalid --port-for "${value}". Use <process>=<port>, for example worker=3101.`);
        }
        const name = value.slice(0, separator);
        if (!/^[a-z][a-z0-9_-]*$/.test(name)) {
            throw new Error(`Invalid process name "${name}" in --port-for.`);
        }
        result[name] = parsePort(value.slice(separator + 1), `${name} port`) as number;
    }
    return result;
}

function parseTimeout(value: string | undefined): number | undefined {
    if (value === undefined) return undefined;
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) {
        throw new Error(`Invalid timeout "${value}". Must be a positive number of seconds.`);
    }
    return Math.round(seconds * 1000);
}

async function handleStart(app: string | undefined, options: StartCommandOptions, environment?: string): Promise<void> {
    try {
        await startApp(app, {
            environment: environment || options.env,
            process: options.process,
            port: parsePort(options.port, 'port'),
            processPorts: parseProcessPorts(options.portFor),
            skipBuild: options.skipBuild,
            noOpen: options.open === false,
            dryRun: options.dryRun,
            timeoutMs: parseTimeout(options.timeout),
        });
    } catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

function addStartOptions(command: Command, defaultEnvironment?: string): Command {
    if (defaultEnvironment) {
        command.option(
            '-e, --env <environment>',
            'Environment to start: development, preview, staging, production, or any Wrangler env',
            defaultEnvironment,
        );
    }
    return command
        .option('-p, --port <port>', 'Override the primary development process or local Worker port')
        .option('--port-for <process=port>', 'Override a named development process port', collect, [])
        .option('--process <name>', 'Start one development process instead of the full app topology')
        .option('--skip-build', 'Reuse existing output for a named Wrangler environment')
        .option('--no-open', 'Do not open the app in a browser after readiness checks pass')
        .option('--timeout <seconds>', 'Readiness timeout in seconds')
        .option('--dry-run', 'Print the resolved build and process plan without executing it');
}

addStartOptions(
    program.command('start [app]').description('Start an app in development or a local Wrangler environment'),
    'development',
).action((app: string | undefined, options: StartCommandOptions) => handleStart(app, options));

addStartOptions(program.command('dev [app]').description('Start the hot-reload dev server(s) for an app')).action(
    (app: string | undefined, options: StartCommandOptions) => handleStart(app, options, 'development'),
);

addStartOptions(
    program.command('preview [app]').description('Build and start an app locally with a named Wrangler environment'),
    'preview',
).action((app: string | undefined, options: StartCommandOptions) => handleStart(app, options));

// =====================================================
// DEPLOY
// =====================================================

program
    .command('deploy [app]')
    .description('Deploy an app straight to Cloudflare: resources, config, build, deploy, secrets, bootstrap')
    .option('-e, --env <environment>', 'The env block of wrangler.jsonc to deploy', 'production')
    .option('--set <KEY=VALUE>', 'A value for a placeholder the resources do not provide', collect, [])
    .option('--url <url>', 'The public URL (AUTH_URL) when a custom domain fronts the Worker')
    .option('--owner-email <email>', 'With --owner-password: bootstrap the empty database and create this owner')
    .option('--owner-password <password>', 'The owner password (or OTTA_OWNER_PASSWORD in the environment)')
    .option('--owner-name <name>', 'The owner display name')
    .option('--skip-build', 'Reuse the app build output')
    .option('--skip-packages', 'Do not rebuild the workspace packages first')
    .option('--dry-run', 'Print the plan, deploy nothing')
    .addHelpText(
        'after',
        `
Examples:
  $ otta deploy my-app
  $ otta deploy my-app --owner-email me@example.com --owner-password 'correct horse'
  $ otta deploy my-app --env demo --set DEMO_URL=https://demo.example.com
  $ otta deploy my-app --url https://my-app.example.com     # after pointing a custom domain at it

Needs a Cloudflare login (pnpm cf:login). Creates the D1, KV, R2 and queue the env block names, writes
wrangler.<env>.jsonc with their ids, builds, deploys, generates and sets the framework secrets that are
not set yet (AUTH_SECRET, MIGRATION_SECRET, BOOTSTRAP_OWNER_SECRET, …, AUTH_URL), and bootstraps the
database when an owner is given. Safe to run again: it finds what exists and redeploys.
`,
    )
    .action(
        async (
            app: string | undefined,
            options: {
                env?: string;
                set?: string[];
                url?: string;
                ownerEmail?: string;
                ownerPassword?: string;
                ownerName?: string;
                skipBuild?: boolean;
                skipPackages?: boolean;
                dryRun?: boolean;
            },
        ) => {
            try {
                await deployCommand(app, {
                    ...options,
                    ownerPassword: options.ownerPassword ?? process.env.OTTA_OWNER_PASSWORD,
                });
            } catch (error) {
                log.error(error instanceof Error ? error.message : String(error));
                process.exit(1);
            }
        },
    );

// =====================================================
// OTTABASE PRO
// =====================================================

const pro = program.command('pro').description('Ottabase Pro, installed as a git subtree at packages/pro');
pro.command('update [app]')
    .description('Pull a Pro release into packages/pro, wire what is new, show its release notes')
    .option('--tag <tag>', 'The release to pull (vX.Y.Z); default: the newest')
    .option('--repo <url>', 'The Pro repository', 'https://github.com/ottabase/pro.git')
    .option('--dry-run', 'Show what would be pulled, pull nothing')
    .addHelpText(
        'after',
        `
Examples:
  $ otta pro update                 The newest release, into the default app
  $ otta pro update my-app --tag v1.2.0
  $ otta pro update --dry-run

Runs git subtree pull --squash (so the tree must be clean), then otta add pro <app> for anything the
release adds, then prints the release's CHANGELOG entry. Then: pnpm install, pnpm build:pkg, the gates,
the migrations in each environment, and a commit.
`,
    )
    .action(async (app: string | undefined, options: { tag?: string; repo?: string; dryRun?: boolean }) => {
        try {
            await proUpdateCommand(app, options);
        } catch (error) {
            log.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

// =====================================================
// BUILD & TEST COMMANDS
// =====================================================

program
    .command('build <app>')
    .description('Build an app for production')
    .action(async (app: string) => {
        try {
            await buildApp(app);
        } catch (error) {
            log.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

program
    .command('test <app>')
    .description('Run tests for an app')
    .option('-w, --watch', 'Run tests in watch mode')
    .option('-c, --coverage', 'Generate coverage report')
    .action(async (app: string, options: { watch?: boolean; coverage?: boolean }) => {
        try {
            await testApp(app, options);
        } catch (error) {
            log.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

program
    .command('lint <app>')
    .description('Lint an app')
    .option('-f, --fix', 'Automatically fix problems')
    .action(async (app: string, options: { fix?: boolean }) => {
        try {
            await lintApp(app, options);
        } catch (error) {
            log.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

program
    .command('type-check <app>')
    .alias('types')
    .description('Type check an app')
    .action(async (app: string) => {
        try {
            await typeCheckApp(app);
        } catch (error) {
            log.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

program
    .command('clean <app>')
    .description('Clean build artifacts for an app')
    .action(async (app: string) => {
        try {
            await cleanApp(app);
        } catch (error) {
            log.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

// =====================================================
// INFO COMMANDS
// =====================================================

program
    .command('list')
    .alias('ls')
    .description('List all apps in the monorepo')
    .action(() => {
        listAllApps();
    });

program
    .command('info <app>')
    .description('Show detailed info about an app')
    .action((app: string) => {
        if (!showAppInfo(app)) {
            process.exit(1);
        }
    });

// =====================================================
// RUN CLI
// =====================================================

/**
 * Parses and executes the CLI from an argv array.
 *
 * @param args - Full argv array in Node.js format (first two elements are node
 *   binary and script path and are stripped by Commander automatically).
 *   Defaults to `process.argv`. Pass `['node', 'otta', ...yourArgs]` when
 *   calling programmatically.
 */
export function run(args: string[] = process.argv): void {
    program.parse(args);
}

export { program };

import { Command } from 'commander';
import pkg from '../package.json' with { type: 'json' };
import {
    buildApp,
    cleanApp,
    lintApp,
    listAllApps,
    newApp,
    showAppInfo,
    showTemplates,
    startApp,
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
    .addHelpText(
        'after',
        `
Templates:
  web       Full-featured Vite + TanStack Router + Cloudflare Workers app
  landing   Next.js landing page with Cloudflare Workers deployment

Examples:
  $ otta new web my-app
  $ otta new landing my-site
`,
    )
    .action(async (template: string, name: string) => {
        try {
            await newApp(template as AppTemplate, name);
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

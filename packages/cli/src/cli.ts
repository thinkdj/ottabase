import { Command } from 'commander';
import pkg from '../package.json' with { type: 'json' };
import {
    buildApp,
    cleanApp,
    devApp,
    lintApp,
    listAllApps,
    newApp,
    showAppInfo,
    showTemplates,
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

program
    .command('dev <app>')
    .description('Start the dev server for an app')
    .option('-p, --port <port>', 'Port to run on')
    .action(async (app: string, options: { port?: string }) => {
        try {
            let port: number | undefined;
            if (options.port !== undefined) {
                port = parseInt(options.port, 10);
                if (Number.isNaN(port) || port <= 0 || port >= 65536) {
                    log.error(`Invalid port "${options.port}". Must be a number between 1 and 65535.`);
                    process.exit(1);
                }
            }
            await devApp(app, { port });
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

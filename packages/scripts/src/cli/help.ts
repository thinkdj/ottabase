#!/usr/bin/env node
/**
 * help – Print every pnpm script in the monorepo as a grouped, annotated table.
 *
 * The command list is read from the root package.json at runtime and joined with the
 * descriptions below, so the table can never advertise a script that does not exist.
 * Scripts with no entry in COMMAND_REGISTRY show up under "Other" as undocumented,
 * and registry entries whose script has been removed are reported as stale - both
 * directions of drift are visible instead of silently rotting.
 *
 * If package.json can't be found or fails to parse, that surfaces as a clear error
 * instead of quietly rendering an empty table - see readRootScripts.
 */
import fs from 'node:fs';
import path from 'node:path';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

/** Group order in the output. Everything else falls into "Other". */
const GROUP_ORDER = [
    'Development',
    'Build',
    'Quality',
    'Testing',
    'Cloudflare',
    'Environment',
    'Cleanup',
    'Docs',
    'Repo',
    'Other',
] as const;

type Group = (typeof GROUP_ORDER)[number];

/** Notes rendered under a group heading. Used to make the local/remote split obvious. */
const GROUP_NOTES: Partial<Record<Group, string>> = {
    Cloudflare: 'Acts on your REMOTE Cloudflare account.',
    Cleanup: 'Local only - deletes files in your working copy, never touches your Cloudflare account.',
    Other: 'Present in package.json but not documented here - add them to COMMAND_REGISTRY in help.ts.',
};

/**
 * Risk tier shown as a marker before the command:
 *   'data'   - deletes real local data (D1/KV/R2); prompts for a typed YES
 *   'remote' - creates billable resources in your Cloudflare account
 *   'cache'  - prompts for a typed YES but only clears a trivially-rebuildable cache
 * These are deliberately distinct: a build-cache clear and a database wipe both prompt
 * for confirmation, but they are not the same kind of "destructive".
 */
type RiskTier = 'data' | 'remote' | 'cache';

interface CommandDoc {
    /** Script name exactly as it appears in the root package.json. */
    name: string;
    group: Group;
    desc: string;
    risk?: RiskTier;
    /** Lifecycle/tooling scripts you never run by hand. Hidden unless --all is passed. */
    internal?: boolean;
}

const COMMAND_REGISTRY: CommandDoc[] = [
    // Development
    { name: 'dev', group: 'Development', desc: 'Start Vite (3003) + Wrangler (3004)' },
    { name: 'dev:fe', group: 'Development', desc: 'Vite dev server only (3003)' },
    { name: 'dev:be', group: 'Development', desc: 'Wrangler worker only (3004)' },
    { name: 'dev:landing', group: 'Development', desc: 'Dev server for the otta-landing app' },
    { name: 'dev:kill', group: 'Development', desc: 'Kill stuck processes on ports 3003/3004' },
    { name: 'dev:ui', group: 'Development', desc: 'Watch otta-web plus every ui-* package' },
    { name: 'dev:pkg', group: 'Development', desc: 'Watch every @ottabase/* package' },
    { name: 'dev:full', group: 'Development', desc: 'Install, build packages, test, then start dev' },

    // Build
    { name: 'build', group: 'Build', desc: 'Build all packages + otta-web' },
    { name: 'build:app', group: 'Build', desc: 'Build otta-web only' },
    { name: 'build:pkg', group: 'Build', desc: 'Build shared packages (required before first dev)' },

    // Quality
    { name: 'lint', group: 'Quality', desc: 'ESLint across all packages' },
    { name: 'type-check', group: 'Quality', desc: 'TypeScript check across all packages' },
    { name: 'format', group: 'Quality', desc: 'Prettier --write across the repo' },
    { name: 'ci:check', group: 'Quality', desc: 'Full CI gate: lint, type-check, test, build' },

    // Testing
    { name: 'test', group: 'Testing', desc: 'Run every test once' },
    { name: 'test:all', group: 'Testing', desc: 'Run tests for all packages and apps' },
    { name: 'test:packages', group: 'Testing', desc: 'Run tests for packages only' },
    { name: 'test:apps', group: 'Testing', desc: 'Run tests for apps only' },
    { name: 'test:otta-web', group: 'Testing', desc: 'Run tests for the otta-web app' },
    { name: 'test:otta-landing', group: 'Testing', desc: 'Run tests for the otta-landing app' },
    { name: 'test:analytics', group: 'Testing', desc: 'Run tests for @ottabase/analytics' },
    { name: 'test:watch', group: 'Testing', desc: 'Re-run tests on change' },
    { name: 'test:ui', group: 'Testing', desc: 'Open the Vitest UI' },
    { name: 'test:coverage', group: 'Testing', desc: 'Run tests with coverage' },
    { name: 'test:coverage:packages', group: 'Testing', desc: 'Coverage for packages only' },
    { name: 'test:coverage:apps', group: 'Testing', desc: 'Coverage for apps only' },

    // Cloudflare (remote)
    { name: 'cf:login', group: 'Cloudflare', desc: 'Authenticate Wrangler with Cloudflare' },
    {
        name: 'cf:setup',
        group: 'Cloudflare',
        desc: 'Create D1, KV, R2 and Queue resources in your account',
        risk: 'remote',
    },
    { name: 'cf:validate', group: 'Cloudflare', desc: 'Verify wrangler.jsonc resources exist (read-only)' },

    // Environment
    { name: 'env:secrets', group: 'Environment', desc: "Fill the app's .env.local with dev-safe secrets" },

    // Cleanup (local only)
    { name: 'clean', group: 'Cleanup', desc: 'Remove build output (turbo clean)' },
    { name: 'clean:cache', group: 'Cleanup', desc: 'Delete Turborepo caches', risk: 'cache' },
    { name: 'clean:d1', group: 'Cleanup', desc: 'Delete local D1 state', risk: 'data' },
    { name: 'clean:kv', group: 'Cleanup', desc: 'Delete local KV state', risk: 'data' },
    { name: 'clean:state', group: 'Cleanup', desc: 'Delete all local Wrangler state (D1 + KV + R2)', risk: 'data' },
    { name: 'clean:all', group: 'Cleanup', desc: 'Local state + build caches + packages/*/dist', risk: 'data' },

    // Docs
    { name: 'storybook', group: 'Docs', desc: 'Start Storybook on port 6006' },
    { name: 'storybook:build', group: 'Docs', desc: 'Build static Storybook output' },

    // Repo
    // `pnpm help` is a pnpm builtin and never reaches this script, so `commands` exists
    // as the alias that works bare. Both point at the same bin.
    { name: 'commands', group: 'Repo', desc: 'Show this table' },
    { name: 'help', group: 'Repo', desc: 'Same table, via `pnpm run help`' },
    { name: 'otta', group: 'Repo', desc: 'App-scoped CLI - scaffold, dev, build, test an app' },
    { name: 'git:normalize', group: 'Repo', desc: 'Re-normalize line endings in the git index' },
    { name: 'prepare', group: 'Repo', desc: 'Husky install hook', internal: true },
    { name: 'postinstall', group: 'Repo', desc: 'Build the otta CLI if missing', internal: true },
    { name: 'lint-staged', group: 'Repo', desc: 'Pre-commit formatting hook', internal: true },
];

/**
 * Colors are dropped when piped to a file or when NO_COLOR is set.
 * Evaluated per call rather than at module load so NO_COLOR still applies to an
 * already-imported module (which is what makes the rendering testable).
 */
function colorEnabled(): boolean {
    return process.stdout.isTTY === true && !process.env.NO_COLOR;
}

function paint(text: string, ...codes: string[]): string {
    if (!colorEnabled()) return text;
    return `${codes.join('')}${text}${RESET}`;
}

function findMonorepoRoot(startPath: string = process.cwd()): string {
    let current = path.resolve(startPath);
    for (;;) {
        if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current;
        const parent = path.dirname(current);
        if (parent === current) return path.resolve(startPath);
        current = parent;
    }
}

/**
 * Reads the `scripts` map from `root`'s package.json.
 *
 * Throws rather than swallowing failures - a missing/unreadable file or malformed JSON
 * must not look identical to "this repo genuinely has zero scripts", because the render
 * layer treats an empty result as "nothing matched" and would otherwise blame a filter
 * the user never typed for what is actually a broken package.json.
 */
export function readRootScripts(root: string = findMonorepoRoot()): Record<string, string> {
    const pkgPath = path.join(root, 'package.json');

    let raw: string;
    try {
        raw = fs.readFileSync(pkgPath, 'utf8');
    } catch (error) {
        throw new Error(`Could not read ${pkgPath}: ${error instanceof Error ? error.message : String(error)}`);
    }

    let pkg: unknown;
    try {
        pkg = JSON.parse(raw);
    } catch (error) {
        throw new Error(
            `Could not parse ${pkgPath} as JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
    }

    const scripts = (pkg as { scripts?: unknown } | null)?.scripts;
    return scripts && typeof scripts === 'object' ? (scripts as Record<string, string>) : {};
}

export interface HelpOptions {
    /** Only show commands whose name or description contains this text. */
    filter?: string;
    /** Include internal lifecycle scripts (prepare, postinstall, ...). */
    all?: boolean;
    /** Script map to document. Defaults to the root package.json. */
    scripts?: Record<string, string>;
}

export interface HelpRow extends CommandDoc {
    /** The underlying command the script runs, straight from package.json. */
    runs: string;
}

export interface HelpModel {
    groups: { group: Group; note?: string; rows: HelpRow[] }[];
    total: number;
    /** Registry entries whose script no longer exists in package.json. */
    stale: string[];
}

/**
 * Joins the registry with the real scripts. Anything in package.json without a registry
 * entry becomes an undocumented "Other" row so the table stays exhaustive.
 */
export function buildHelpModel(options: HelpOptions = {}): HelpModel {
    const scripts = options.scripts ?? readRootScripts();
    const documented = new Map(COMMAND_REGISTRY.map((entry) => [entry.name, entry]));
    const filter = options.filter?.trim().toLowerCase();

    const rows: HelpRow[] = Object.keys(scripts).map((name) => {
        const doc = documented.get(name);
        return {
            name,
            group: doc?.group ?? 'Other',
            desc: doc?.desc ?? '(undocumented)',
            risk: doc?.risk,
            internal: doc?.internal,
            runs: scripts[name] ?? '',
        };
    });

    // hasOwnProperty (not `in`) so a registry entry can't accidentally read as "present"
    // via an inherited Object.prototype member (e.g. a script literally named "toString").
    const stale = COMMAND_REGISTRY.filter((entry) => !Object.prototype.hasOwnProperty.call(scripts, entry.name)).map(
        (entry) => entry.name,
    );

    const visible = rows
        .filter((row) => options.all === true || row.internal !== true)
        .filter((row) => {
            if (!filter) return true;
            return (
                row.name.toLowerCase().includes(filter) ||
                row.desc.toLowerCase().includes(filter) ||
                row.group.toLowerCase().includes(filter)
            );
        });

    const groups = GROUP_ORDER.map((group) => ({
        group,
        note: GROUP_NOTES[group],
        rows: visible.filter((row) => row.group === group),
    })).filter((entry) => entry.rows.length > 0);

    return { groups, total: visible.length, stale };
}

function rule(width: number, label: string): string {
    const head = `── ${label} `;
    const tail = '─'.repeat(Math.max(0, width - head.length));
    return paint(`${head}${tail}`, DIM);
}

/** Marker + legend copy per risk tier. Order here is the order they appear in the legend. */
const RISK_MARKERS: Record<RiskTier, { symbol: string; codes: string[]; legend: string }> = {
    data: { symbol: '!', codes: [RED, BOLD], legend: 'deletes real local data - prompts for a typed YES' },
    remote: { symbol: '$', codes: [YELLOW, BOLD], legend: 'creates billable resources in your Cloudflare account' },
    cache: { symbol: '~', codes: [DIM], legend: 'rebuildable cache only - safe to clear anytime' },
};

export function render(model: HelpModel, options: HelpOptions = {}): string {
    const width = Math.min(Math.max(process.stdout.columns ?? 100, 60), 110);
    const out: string[] = [];

    out.push('');
    out.push(`  ${paint('Ottabase', BOLD, CYAN)} ${paint('· monorepo commands', DIM)}`);

    if (model.total === 0) {
        out.push('');
        if (options.filter) {
            out.push(`  ${paint(`No command matches "${options.filter}".`, YELLOW)}`);
            out.push(`  ${paint('Run without a filter to see everything.', DIM)}`);
        } else {
            // Reachable only if package.json's scripts map is genuinely empty, or every
            // remaining command is internal and --all wasn't passed - readRootScripts
            // throws rather than getting here silently on a missing/malformed file.
            out.push(`  ${paint('No commands found.', YELLOW)}`);
            out.push(`  ${paint('package.json has no scripts, or try pnpm commands --all.', DIM)}`);
        }
        out.push('');
        return out.join('\n');
    }

    const summary = options.filter
        ? `${model.total} command${model.total === 1 ? '' : 's'} matching "${options.filter}"`
        : `${model.total} commands · run from the repo root`;
    out.push(`  ${paint(summary, DIM)}`);

    // Width of the command column, so descriptions line up across every group.
    const allRows = model.groups.flatMap((entry) => entry.rows);
    const nameWidth = Math.max(...allRows.map((row) => row.name.length)) + 'pnpm '.length;

    const seenRisks = new Set<RiskTier>();

    for (const { group, note, rows } of model.groups) {
        out.push('');
        out.push(`  ${rule(width - 2, group)}`);
        if (note) out.push(`  ${paint(note, DIM)}`);

        for (const row of rows) {
            const risk = row.risk ? RISK_MARKERS[row.risk] : undefined;
            if (row.risk) seenRisks.add(row.risk);
            const marker = risk ? paint(risk.symbol, ...risk.codes) : ' ';
            const command = `pnpm ${row.name}`.padEnd(nameWidth);
            const desc = row.desc === '(undocumented)' ? paint(row.desc, YELLOW) : row.desc;
            out.push(`  ${marker} ${paint(command, GREEN)}  ${desc}`);
        }
    }

    if (seenRisks.size) {
        out.push('');
        for (const tier of ['data', 'remote', 'cache'] as const) {
            if (!seenRisks.has(tier)) continue;
            const { symbol, codes, legend } = RISK_MARKERS[tier];
            out.push(`  ${paint(symbol, ...codes)} ${paint(legend, DIM)}`);
        }
    }
    out.push(`  ${paint('Filter:', DIM)}   pnpm commands <text>   ${paint('e.g. pnpm commands clean', DIM)}`);
    if (options.all !== true) {
        out.push(
            `  ${paint('All:', DIM)}      pnpm commands --all    ${paint('include internal lifecycle scripts', DIM)}`,
        );
    }
    out.push(`  ${paint('App CLI:', DIM)}  pnpm otta --help       ${paint('scaffold/dev/build a single app', DIM)}`);

    if (model.stale.length) {
        out.push('');
        out.push(
            `  ${paint('Stale docs:', YELLOW)} ${model.stale.join(', ')} ${paint('- documented in help.ts but missing from package.json', DIM)}`,
        );
    }

    out.push('');
    return out.join('\n');
}

export function main(): void {
    const args = process.argv.slice(2);
    const all = args.includes('--all') || args.includes('-a');
    const filter = args.find((arg) => !arg.startsWith('-'));

    let model: HelpModel;
    try {
        model = buildHelpModel({ filter, all });
    } catch (error) {
        console.error(`\n  Couldn't read the command list: ${error instanceof Error ? error.message : String(error)}`);
        console.error('  Run this from inside the Ottabase repo (or a subdirectory of it).\n');
        process.exitCode = 1;
        return;
    }

    console.log(render(model, { filter, all }));
}

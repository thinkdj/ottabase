#!/usr/bin/env node
/**
 * Ottabase CLI - The One Base CLI
 * Interactive command-line interface for the Ottabase monorepo.
 * Supports `ottabase` and `ob` commands.
 */
import readline from 'readline';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// ─── ANSI Colors & Styles ───────────────────────────────────────────
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const ITALIC = '\x1b[3m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const BLUE = '\x1b[34m';
const WHITE = '\x1b[37m';
const BG_CYAN = '\x1b[46m';
const BG_BLUE = '\x1b[44m';

// Gradient-like colors (256-color)
const C = {
    o1: '\x1b[38;5;39m', // bright blue
    o2: '\x1b[38;5;45m', // cyan-blue
    o3: '\x1b[38;5;51m', // cyan
    o4: '\x1b[38;5;87m', // light cyan
    o5: '\x1b[38;5;123m', // pale cyan
    accent: '\x1b[38;5;215m', // warm orange
    muted: '\x1b[38;5;245m', // grey
    success: '\x1b[38;5;84m', // green
    warn: '\x1b[38;5;220m', // yellow
    err: '\x1b[38;5;196m', // red
};

// ─── ASCII Art Logo ─────────────────────────────────────────────────
// Raw logo lines (no color) — the Big O
const LOGO_RAW = [
    '     ████████████████     ',
    '   ██████████████████████ ',
    '  ████                ████',
    ' ████    ██████████    ████',
    ' ████   ████████████   ████',
    ' ████   ████████████   ████',
    ' ████   ████████████   ████',
    '  ████   ██████████   ████',
    '  ████                ████',
    '   ██████████████████████ ',
    '     ████████████████     ',
];

// Center of the O for radial-reveal (row, col)
const LOGO_CENTER_ROW = 5;
const LOGO_CENTER_COL = 14;

// Gradient palette for row-based coloring
const ROW_COLORS = [C.o1, C.o1, C.o2, C.o2, C.o3, C.o3, C.o4, C.o4, C.o5, C.o5, C.o5];

// Compute distance of each character from the center of the O
function buildDistanceMap(): number[][] {
    return LOGO_RAW.map((line, row) =>
        [...line].map((_, col) => {
            const dr = row - LOGO_CENTER_ROW;
            const dc = (col - LOGO_CENTER_COL) * 0.55; // chars are taller than wide
            return Math.sqrt(dr * dr + dc * dc);
        }),
    );
}

const DISTANCE_MAP = buildDistanceMap();
const MAX_DISTANCE = Math.max(...DISTANCE_MAP.flat());

// Render a single frame of the radial reveal at a given threshold
function renderRevealFrame(threshold: number, colorOverride?: string): string[] {
    return LOGO_RAW.map((line, row) => {
        const color = colorOverride || ROW_COLORS[row] || C.o3;
        const chars = [...line].map((ch, col) => {
            if (ch === ' ') return ' ';
            return DISTANCE_MAP[row][col] <= threshold ? `${color}█${RESET}` : ' ';
        });
        return chars.join('');
    });
}

// Full colored logo (final resting state)
const LOGO_LINES = LOGO_RAW.map((line, row) => {
    const color = ROW_COLORS[row] || C.o3;
    return `${color}${line}${RESET}`;
});

const TITLE_LINES = [
    `${C.o2}${BOLD} ╔═══════════════════════════════════╗${RESET}`,
    `${C.o3}${BOLD} ║${RESET}  ${C.o1}${BOLD}O T T A B A S E${RESET}  ${C.muted}// the one base${RESET}  ${C.o3}${BOLD}║${RESET}`,
    `${C.o4}${BOLD} ╚═══════════════════════════════════╝${RESET}`,
];

// ─── Utility Functions ──────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function clearLine(): void {
    process.stdout.write('\r\x1b[K');
}

function hideCursor(): void {
    process.stdout.write('\x1b[?25l');
}

function showCursor(): void {
    process.stdout.write('\x1b[?25h');
}

function getVersion(): string {
    try {
        const pkgPath = path.resolve(__dirname, '../../package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return pkg.version || '1.0.0';
    } catch {
        return '1.0.0';
    }
}

// ─── Animation Functions ────────────────────────────────────────────
async function animateSpinner(text: string, durationMs: number): Promise<void> {
    const frames = ['◐', '◓', '◑', '◒'];
    const start = Date.now();
    let i = 0;
    hideCursor();
    while (Date.now() - start < durationMs) {
        clearLine();
        process.stdout.write(`  ${C.o3}${frames[i % frames.length]}${RESET} ${C.muted}${text}${RESET}`);
        i++;
        await sleep(80);
    }
    clearLine();
    showCursor();
}

async function typeText(text: string, delay: number = 25): Promise<void> {
    for (const char of text) {
        process.stdout.write(char);
        await sleep(delay);
    }
    process.stdout.write('\n');
}

async function animateLogo(): Promise<void> {
    hideCursor();
    const logoHeight = LOGO_RAW.length;

    // Print placeholder lines to reserve screen space
    for (let i = 0; i < logoHeight; i++) {
        console.log('');
    }

    // ── Phase 1: Radial reveal — O materializes from center outward ──
    const revealSteps = 18;
    for (let step = 0; step <= revealSteps; step++) {
        // Ease-out: fast start, gentle finish
        const t = step / revealSteps;
        const eased = 1 - (1 - t) * (1 - t);
        const threshold = eased * MAX_DISTANCE;

        const frame = renderRevealFrame(threshold);
        process.stdout.write(`\x1b[${logoHeight}A`);
        for (const line of frame) {
            clearLine();
            console.log(line);
        }
        await sleep(40);
    }

    // ── Phase 2: Color-sweep glow pulse ──
    const sweepPalette = [
        '\x1b[38;5;195m', // white-ish highlight
        '\x1b[38;5;159m', // light cyan glow
        '\x1b[38;5;123m', // bright cyan
    ];
    for (const glow of sweepPalette) {
        const frame = renderRevealFrame(MAX_DISTANCE, glow);
        process.stdout.write(`\x1b[${logoHeight}A`);
        for (const line of frame) {
            clearLine();
            console.log(line);
        }
        await sleep(60);
    }

    // ── Phase 3: Settle to final gradient colors ──
    process.stdout.write(`\x1b[${logoHeight}A`);
    for (let i = 0; i < LOGO_LINES.length; i++) {
        clearLine();
        console.log(LOGO_LINES[i]);
    }
    await sleep(80);

    // ── Phase 4: Sparkle on top-right ✦ ──
    const sparkleSeq = ['✦', '✧', '✦', '⋆', '✦'];
    for (const sp of sparkleSeq) {
        process.stdout.write(`\x1b[${logoHeight}A`);
        clearLine();
        console.log(`${LOGO_LINES[0]}  ${C.accent}${BOLD}${sp}${RESET}`);
        process.stdout.write(`\x1b[${logoHeight - 1}B`);
        await sleep(90);
    }

    console.log('');

    // ── Reveal title ──
    for (const line of TITLE_LINES) {
        console.log(line);
        await sleep(60);
    }

    showCursor();
    console.log('');
}

async function animateWelcome(): Promise<void> {
    const version = getVersion();
    await typeText(`  ${C.muted}v${version}${RESET}`, 15);
    console.log('');
}

// ─── Command Definitions ────────────────────────────────────────────
interface Command {
    name: string;
    description: string;
    group: 'Dev' | 'Build' | 'Test' | 'Quality' | 'Clean' | 'Tooling' | 'Cloudflare';
    action: () => void | Promise<void>;
}

function runPnpm(args: string): void {
    try {
        execSync(`pnpm ${args}`, { stdio: 'inherit', cwd: findMonorepoRoot() });
    } catch {
        // Command failed - error already shown by inherited stdio
    }
}

function findMonorepoRoot(): string {
    let dir = process.cwd();
    while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')) && fs.existsSync(path.join(dir, 'turbo.json'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return process.cwd();
}

const COMMANDS: Command[] = [
    {
        name: 'dev',
        description: 'Start development server (Vite + Wrangler)',
        group: 'Dev',
        action: () => runPnpm('dev'),
    },
    {
        name: 'dev:fe',
        description: 'Start frontend dev server only',
        group: 'Dev',
        action: () => runPnpm('dev:fe'),
    },
    {
        name: 'dev:be',
        description: 'Start worker/backend dev only',
        group: 'Dev',
        action: () => runPnpm('dev:be'),
    },
    {
        name: 'dev:ui',
        description: 'Start app + UI packages in dev mode',
        group: 'Dev',
        action: () => runPnpm('dev:ui'),
    },
    {
        name: 'dev:pkg',
        description: 'Start all packages in dev mode',
        group: 'Dev',
        action: () => runPnpm('dev:pkg'),
    },
    {
        name: 'dev:kill:ports',
        description: 'Kill dev ports used by local services',
        group: 'Dev',
        action: () => runPnpm('dev:kill:ports'),
    },
    {
        name: 'dev:full',
        description: 'Install, build, test, then start dev',
        group: 'Dev',
        action: () => runPnpm('dev:full'),
    },
    {
        name: 'build',
        description: 'Build all packages and apps',
        group: 'Build',
        action: () => runPnpm('build'),
    },
    {
        name: 'build:app',
        description: 'Build app only',
        group: 'Build',
        action: () => runPnpm('build:app'),
    },
    {
        name: 'build:pkg',
        description: 'Build packages only',
        group: 'Build',
        action: () => runPnpm('build:pkg'),
    },
    {
        name: 'test',
        description: 'Run test suite',
        group: 'Test',
        action: () => runPnpm('test'),
    },
    {
        name: 'test:all',
        description: 'Run tests for packages and apps',
        group: 'Test',
        action: () => runPnpm('test:all'),
    },
    {
        name: 'test:packages',
        description: 'Run package tests only',
        group: 'Test',
        action: () => runPnpm('test:packages'),
    },
    {
        name: 'test:apps',
        description: 'Run app tests only',
        group: 'Test',
        action: () => runPnpm('test:apps'),
    },
    {
        name: 'test:tanstack',
        description: 'Run TanStack app tests',
        group: 'Test',
        action: () => runPnpm('test:tanstack'),
    },
    {
        name: 'test:coverage',
        description: 'Run tests with coverage',
        group: 'Test',
        action: () => runPnpm('test:coverage'),
    },
    {
        name: 'test:analytics',
        description: 'Run analytics package tests',
        group: 'Test',
        action: () => runPnpm('test:analytics'),
    },
    {
        name: 'test:watch',
        description: 'Run tests in watch mode',
        group: 'Test',
        action: () => runPnpm('test:watch'),
    },
    {
        name: 'test:ui',
        description: 'Run tests with Vitest UI',
        group: 'Test',
        action: () => runPnpm('test:ui'),
    },
    {
        name: 'lint',
        description: 'Lint all packages',
        group: 'Quality',
        action: () => runPnpm('lint'),
    },
    {
        name: 'type-check',
        description: 'Run TypeScript type checking',
        group: 'Quality',
        action: () => runPnpm('type-check'),
    },
    {
        name: 'format',
        description: 'Format files with Prettier',
        group: 'Quality',
        action: () => runPnpm('format'),
    },
    {
        name: 'clean',
        description: 'Clean build artifacts',
        group: 'Clean',
        action: () => runPnpm('clean'),
    },
    {
        name: 'clean:cache',
        description: 'Clear Turborepo cache',
        group: 'Clean',
        action: () => runPnpm('clean:cache'),
    },
    {
        name: 'clean:reset',
        description: 'Reset local build/cache state',
        group: 'Clean',
        action: () => runPnpm('clean:reset'),
    },
    {
        name: 'clean:db',
        description: 'Clean local database resources',
        group: 'Clean',
        action: () => runPnpm('clean:db'),
    },
    {
        name: 'clean:kv',
        description: 'Clean local KV resources',
        group: 'Clean',
        action: () => runPnpm('clean:kv'),
    },
    {
        name: 'storybook',
        description: 'Start Storybook',
        group: 'Tooling',
        action: () => runPnpm('storybook'),
    },
    {
        name: 'storybook:build',
        description: 'Build Storybook static output',
        group: 'Tooling',
        action: () => runPnpm('storybook:build'),
    },
    {
        name: 'cf:login',
        description: 'Login to Cloudflare from the CLI',
        group: 'Cloudflare',
        action: () => runPnpm('cf:login'),
    },
    {
        name: 'cf:setup',
        description: 'Setup Cloudflare resources (canonical alias)',
        group: 'Cloudflare',
        action: () => runPnpm('cf:setup'),
    },
    {
        name: 'cf:validate',
        description: 'Validate Cloudflare configuration (canonical alias)',
        group: 'Cloudflare',
        action: () => runPnpm('cf:validate'),
    },
    {
        name: 'cloudflare:setup',
        description: 'Setup Cloudflare resources (legacy alias)',
        group: 'Cloudflare',
        action: () => runPnpm('cloudflare:setup'),
    },
    {
        name: 'cloudflare:validate',
        description: 'Validate Cloudflare configuration (legacy alias)',
        group: 'Cloudflare',
        action: () => runPnpm('cloudflare:validate'),
    },
];

// ─── Help Display ───────────────────────────────────────────────────
function showHelp(): void {
    console.log(
        `  ${C.o2}${BOLD}Usage:${RESET}  ${WHITE}ottabase${RESET} ${C.muted}<command>${RESET}  ${DIM}or${RESET}  ${WHITE}ob${RESET} ${C.muted}<command>${RESET}`,
    );
    console.log('');
    const GROUP_ORDER: Command['group'][] = ['Dev', 'Build', 'Test', 'Quality', 'Clean', 'Tooling', 'Cloudflare'];
    const tabLine = GROUP_ORDER.map((group) => `${C.o2}[${group}]${RESET}`).join(` ${C.muted}|${RESET} `);
    console.log(`  ${C.o3}${BOLD}Command Tabs:${RESET} ${tabLine}`);
    console.log('');

    const maxLen = Math.max(...COMMANDS.map((c) => c.name.length));
    for (const group of GROUP_ORDER) {
        const groupCommands = COMMANDS.filter((c) => c.group === group);
        if (groupCommands.length === 0) continue;
        console.log(`  ${C.o4}${BOLD}${group}${RESET}`);
        for (const cmd of groupCommands) {
            const padded = cmd.name.padEnd(maxLen + 2);
            console.log(`    ${C.o1}${padded}${RESET}${C.muted}${cmd.description}${RESET}`);
        }
        console.log('');
    }

    console.log(`    ${C.o1}${'help'.padEnd(maxLen + 2)}${RESET}${C.muted}Show this help message${RESET}`);
    console.log(`    ${C.o1}${'version'.padEnd(maxLen + 2)}${RESET}${C.muted}Show version information${RESET}`);
    console.log('');
    console.log(`  ${C.o4}${BOLD}Interactive:${RESET}`);
    console.log(
        `    ${C.muted}Run ${WHITE}ottabase${RESET} ${C.muted}or ${WHITE}ob${RESET} ${C.muted}without arguments for interactive mode${RESET}`,
    );
    console.log('');
}

// ─── Interactive Mode ───────────────────────────────────────────────
async function interactiveMode(): Promise<void> {
    showHelp();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const prompt = (): void => {
        rl.question(`  ${C.o3}❯${RESET} `, (answer) => {
            const input = answer.trim().toLowerCase();

            if (!input) {
                prompt();
                return;
            }

            if (input === 'exit' || input === 'quit' || input === 'q') {
                console.log('');
                console.log(`  ${C.muted}${ITALIC}Otta. ✦${RESET}`);
                console.log('');
                rl.close();
                return;
            }

            if (input === 'help' || input === 'h' || input === '?') {
                showHelp();
                prompt();
                return;
            }

            if (input === 'version' || input === 'v') {
                console.log(`  ${C.o2}ottabase${RESET} ${C.muted}v${getVersion()}${RESET}`);
                console.log('');
                prompt();
                return;
            }

            if (input === 'clear' || input === 'cls') {
                process.stdout.write('\x1b[2J\x1b[H');
                prompt();
                return;
            }

            const cmd = COMMANDS.find((c) => c.name === input);
            if (cmd) {
                console.log(`  ${C.o1}▸${RESET} ${C.muted}Running ${WHITE}${cmd.name}${RESET}${C.muted}...${RESET}`);
                console.log('');
                const result = cmd.action();
                if (result instanceof Promise) {
                    result.then(() => {
                        console.log('');
                        prompt();
                    });
                } else {
                    console.log('');
                    prompt();
                }
            } else {
                console.log(`  ${C.err}✗${RESET} ${C.muted}Unknown command: ${WHITE}${input}${RESET}`);
                console.log(`  ${C.muted}Type ${WHITE}help${RESET} ${C.muted}for available commands${RESET}`);
                console.log('');
                prompt();
            }
        });
    };

    prompt();
}

// ─── Direct Command Execution ───────────────────────────────────────
function executeCommand(commandName: string): void {
    if (commandName === 'help' || commandName === '--help' || commandName === '-h') {
        showHelp();
        return;
    }

    if (commandName === 'version' || commandName === '--version' || commandName === '-v') {
        console.log(`ottabase v${getVersion()}`);
        return;
    }

    const cmd = COMMANDS.find((c) => c.name === commandName);
    if (cmd) {
        cmd.action();
    } else {
        console.log(`${C.err}Unknown command: ${commandName}${RESET}`);
        console.log(`Run ${BOLD}ottabase help${RESET} for available commands.`);
        process.exit(1);
    }
}

// ─── Main Entry ─────────────────────────────────────────────────────
export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
    // Handle SIGINT gracefully
    process.on('SIGINT', () => {
        showCursor();
        console.log('');
        console.log(`  ${C.muted}${ITALIC}Otta. ✦${RESET}`);
        console.log('');
        process.exit(0);
    });

    if (args.length > 0) {
        // Direct command mode
        executeCommand(args[0]);
    } else {
        // Interactive mode with animated intro
        console.log('');
        await animateLogo();
        await animateWelcome();
        await interactiveMode();
    }
}

main();

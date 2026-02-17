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
// Raw logo lines (no color) - each line is 25 chars wide
// Pattern: outer ring + inner hole + inner ring
const LOGO_RAW = [
    '     ████████████████     ', //  0: top cap
    '   ██████████████████████ ', //  1: upper rim (solid)
    '  ████                ████', //  2: outer ring
    ' ████    ██████████    ████', //  3: outer + inner ring
    ' ████   ████████████   ████', //  4: outer + inner ring
    ' ████   ████████████   ████', //  5: outer + inner ring
    ' ████   ████████████   ████', //  6: outer + inner ring
    '  ████   ██████████   ████', //  7: outer + inner ring
    '  ████                ████', //  8: outer ring
    '   ██████████████████████ ', //  9: lower rim (solid)
    '     ████████████████     ', // 10: bottom cap
];

const LOGO_WIDTH = 27; // visual char width of widest line

// Apply gradient colors to raw logo lines
function colorizeLogo(lines: string[]): string[] {
    const colors = [C.o1, C.o1, C.o2, C.o2, C.o3, C.o3, C.o4, C.o4, C.o5, C.o5, C.o5];
    return lines.map((line, i) => `${colors[i] || C.o3}${line}${RESET}`);
}

const LOGO_LINES = colorizeLogo(LOGO_RAW);

// ─── Coin Spin Frames ───────────────────────────────────────────────
// Simulate a coin spinning on vertical axis by horizontally compressing
// each line of the O. At scale 1.0 = full width, 0.0 = edge-on (thin line).
function scaleLineHorizontally(line: string, scale: number): string {
    if (scale <= 0.05) {
        // Edge-on: thin vertical line
        const pad = Math.floor(LOGO_WIDTH / 2);
        return ' '.repeat(pad) + '▌' + ' '.repeat(pad);
    }
    const stripped = line;
    const totalLen = stripped.length;
    const newLen = Math.max(1, Math.round(totalLen * scale));
    const result: string[] = [];
    for (let i = 0; i < newLen; i++) {
        const srcIdx = Math.round((i / newLen) * totalLen);
        result.push(stripped[Math.min(srcIdx, totalLen - 1)]);
    }
    const padTotal = LOGO_WIDTH - newLen;
    const padLeft = Math.floor(padTotal / 2);
    const padRight = padTotal - padLeft;
    return ' '.repeat(padLeft) + result.join('') + ' '.repeat(padRight);
}

function generateSpinFrame(rawLines: string[], scale: number): string[] {
    return rawLines.map((line) => scaleLineHorizontally(line, scale));
}

// Easing for smooth spin: cosine-based for that coin-flip feel
function coinSpinPhases(): number[] {
    // 2 full rotations = 720 degrees, sampled at intervals
    const phases: number[] = [];
    const totalFrames = 32; // 16 frames per rotation × 2
    for (let i = 0; i <= totalFrames; i++) {
        // cos gives us: 1 → 0 → -1 → 0 → 1 per 360°
        // abs(cos) gives: 1 → 0 → 1 → 0 → 1 (the "width" as seen)
        const angle = (i / totalFrames) * 2 * Math.PI * 2; // 2 full rotations
        phases.push(Math.abs(Math.cos(angle)));
    }
    return phases;
}

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

    const phases = coinSpinPhases();
    const logoHeight = LOGO_RAW.length;
    const frameDelay = 35; // ms per frame - snappy like a real coin

    // First, print placeholder lines we'll overwrite
    for (let i = 0; i < logoHeight; i++) {
        console.log('');
    }

    // Animate the coin spin (2 rotations)
    for (let f = 0; f < phases.length; f++) {
        const scale = phases[f];
        const frame = generateSpinFrame(LOGO_RAW, scale);
        const coloredFrame = colorizeLogo(frame);

        // Move cursor up to top of logo area
        process.stdout.write(`\x1b[${logoHeight}A`);

        // Redraw all lines
        for (const line of coloredFrame) {
            clearLine();
            console.log(line);
        }

        await sleep(frameDelay);
    }

    // Final frame: the full O with sparkle on top-right ✦
    process.stdout.write(`\x1b[${logoHeight}A`);
    for (let i = 0; i < LOGO_LINES.length; i++) {
        clearLine();
        if (i === 0) {
            // Add sparkle to top-right of first line
            console.log(`${LOGO_LINES[i]} ${C.accent}${BOLD}✦${RESET}`);
        } else {
            console.log(LOGO_LINES[i]);
        }
    }

    // Brief sparkle twinkle effect
    const sparkleFrames = ['✦', '✧', '✦', '⋆', '✦'];
    for (const sp of sparkleFrames) {
        await sleep(100);
        // Move up to first line, overwrite sparkle
        process.stdout.write(`\x1b[${logoHeight}A`);
        clearLine();
        console.log(`${LOGO_LINES[0]} ${C.accent}${BOLD}${sp}${RESET}`);
        // Move back down
        process.stdout.write(`\x1b[${logoHeight - 1}B`);
    }

    // Final sparkle settled
    await sleep(80);
    process.stdout.write(`\x1b[${logoHeight}A`);
    clearLine();
    console.log(`${LOGO_LINES[0]} ${C.accent}${BOLD}✦${RESET}`);
    process.stdout.write(`\x1b[${logoHeight - 1}B`);

    console.log('');

    // Reveal title with a brief pause
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
        action: () => runPnpm('dev'),
    },
    {
        name: 'build',
        description: 'Build all packages and apps',
        action: () => runPnpm('build'),
    },
    {
        name: 'build:pkg',
        description: 'Build packages only',
        action: () => runPnpm('build:pkg'),
    },
    {
        name: 'test',
        description: 'Run test suite',
        action: () => runPnpm('test'),
    },
    {
        name: 'lint',
        description: 'Lint all packages',
        action: () => runPnpm('lint'),
    },
    {
        name: 'type-check',
        description: 'Run TypeScript type checking',
        action: () => runPnpm('type-check'),
    },
    {
        name: 'clean',
        description: 'Clean build artifacts',
        action: () => runPnpm('clean'),
    },
    {
        name: 'clean:cache',
        description: 'Clear Turborepo cache',
        action: () => runPnpm('clean:cache'),
    },
    {
        name: 'cloudflare:setup',
        description: 'Setup Cloudflare resources (D1, KV, R2, Queues)',
        action: () => runPnpm('cloudflare:setup'),
    },
    {
        name: 'cloudflare:validate',
        description: 'Validate Cloudflare configuration',
        action: () => runPnpm('cloudflare:validate'),
    },
];

// ─── Help Display ───────────────────────────────────────────────────
function showHelp(): void {
    console.log(
        `  ${C.o2}${BOLD}Usage:${RESET}  ${WHITE}ottabase${RESET} ${C.muted}<command>${RESET}  ${DIM}or${RESET}  ${WHITE}ob${RESET} ${C.muted}<command>${RESET}`,
    );
    console.log('');
    console.log(`  ${C.o3}${BOLD}Commands:${RESET}`);
    console.log('');

    const maxLen = Math.max(...COMMANDS.map((c) => c.name.length));
    for (const cmd of COMMANDS) {
        const padded = cmd.name.padEnd(maxLen + 2);
        console.log(`    ${C.o1}${padded}${RESET}${C.muted}${cmd.description}${RESET}`);
    }

    console.log('');
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

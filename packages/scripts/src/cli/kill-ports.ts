#!/usr/bin/env node
/**
 * Free stuck dev-server ports.
 *
 *   kill-ports                    every port declared by every app under apps/
 *   kill-ports --app=otta-web     only that app's ports
 *   kill-ports --ports=3003,3004  explicit ports (no app lookup)
 *
 * Ports come from each app's package.json `ottabase.start.<env>` block (process urls, worker url),
 * so a new app is covered the moment it declares its start config. Only TCP LISTENING sockets on the
 * exact port are killed.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

function log(msg: string, color: string = NC) {
    console.log(`${color}${msg}${NC}`);
}

export interface AppPorts {
    /** Directory name under apps/ (e.g. `otta-web`). */
    name: string;
    /** Package name (e.g. `@ottabase/otta-web`). */
    packageName: string;
    ports: number[];
}

interface StartProcess {
    url?: string;
    readyUrl?: string;
}

/** Pull every distinct port out of an app package.json's `ottabase.start` block. */
export function portsFromPackageJson(pkg: unknown): number[] {
    const start = (pkg as { ottabase?: { start?: Record<string, unknown> } })?.ottabase?.start;
    if (!start || typeof start !== 'object') return [];
    const urls: unknown[] = [];
    for (const value of Object.values(start)) {
        if (!value || typeof value !== 'object') continue;
        const env = value as { processes?: unknown; url?: unknown; readyUrl?: unknown };
        const procs = Array.isArray(env.processes) ? (env.processes as unknown[]) : [];
        for (const proc of procs) {
            if (proc && typeof proc === 'object') {
                const p = proc as StartProcess;
                urls.push(p.url, p.readyUrl);
            }
        }
        urls.push(env.url, env.readyUrl);
    }
    const ports = new Set<number>();
    for (const raw of urls) {
        if (typeof raw !== 'string' || !raw) continue;
        try {
            const port = Number(new URL(raw).port);
            if (port > 0) ports.add(port);
        } catch {
            /* not a URL */
        }
    }
    return [...ports].sort((a, b) => a - b);
}

/** Read `apps/*` under `root` and collect declared ports per app. */
export function discoverApps(root: string): AppPorts[] {
    const appsDir = path.join(root, 'apps');
    if (!fs.existsSync(appsDir)) return [];
    const apps: AppPorts[] = [];
    for (const name of fs.readdirSync(appsDir).sort()) {
        const pkgPath = path.join(appsDir, name, 'package.json');
        if (!fs.existsSync(pkgPath)) continue;
        let pkg: { name?: string };
        try {
            pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        } catch {
            continue;
        }
        const ports = portsFromPackageJson(pkg);
        if (ports.length) apps.push({ name, packageName: pkg.name ?? name, ports });
    }
    return apps;
}

/** Match `--app` against the directory name, package name, or its unscoped tail. Throws if ambiguous. */
export function selectApp(apps: AppPorts[], app: string): AppPorts | undefined {
    const wanted = app.toLowerCase();
    const exact = apps.filter((a) => a.name.toLowerCase() === wanted || a.packageName.toLowerCase() === wanted);
    if (exact.length === 1) return exact[0];
    const tail = apps.filter((a) => a.packageName.toLowerCase().split('/').pop() === wanted);
    if (tail.length > 1) {
        throw new Error(`Ambiguous app "${app}": ${tail.map((a) => a.packageName).join(', ')}. Use the full name.`);
    }
    return tail[0];
}

export function findRepoRoot(from: string = process.cwd()): string {
    let dir = path.resolve(from);
    for (;;) {
        if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) return path.resolve(from);
        dir = parent;
    }
}

export interface ParsedArgs {
    app?: string;
    ports?: number[];
}

/** Fail closed: any unknown flag or malformed value throws rather than widening to "kill everything". */
export function parseArgs(argv: string[]): ParsedArgs {
    const out: ParsedArgs = {};
    for (let i = 0; i < argv.length; i++) {
        const [key, inline] = argv[i].split('=', 2) as [string, string | undefined];
        const value = inline ?? argv[++i];
        if (key === '--app') {
            if (!value) throw new Error('--app requires a name');
            out.app = value;
        } else if (key === '--ports' || key === '--port') {
            const ports = (value ?? '').split(',').map((p) => p.trim());
            if (!ports.length || ports.some((p) => !/^\d+$/.test(p) || Number(p) < 1 || Number(p) > 65535)) {
                throw new Error(`${key} expects comma-separated ports 1-65535, got "${value ?? ''}"`);
            }
            out.ports = [...new Set(ports.map(Number))];
        } else {
            throw new Error(`Unknown argument "${argv[i]}". Use --app=<name> or --ports=a,b`);
        }
    }
    return out;
}

/**
 * Parse `netstat -ano -p tcp` output and return PIDs LISTENING on exactly `port`.
 * Local address is column 2 (`0.0.0.0:3003`, `[::]:3003`); PID is the last column.
 */
export function pidsFromNetstat(output: string, port: number): string[] {
    const pids = new Set<string>();
    for (const line of output.split(/\r?\n/)) {
        const cols = line.trim().split(/\s+/);
        if (cols.length < 5 || cols[0].toUpperCase() !== 'TCP') continue;
        const [, local, , state, pid] = cols;
        if (state.toUpperCase() !== 'LISTENING') continue;
        const localPort = Number(local.slice(local.lastIndexOf(':') + 1));
        if (localPort === port && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
    }
    return [...pids];
}

async function listeningPids(port: number): Promise<string[]> {
    if (process.platform === 'win32') {
        const { stdout } = await execFileAsync('netstat', ['-ano', '-p', 'tcp']);
        return pidsFromNetstat(stdout, port);
    }
    // -sTCP:LISTEN + exact -iTCP:port: no substring matches, no client sockets.
    // lsof exits 1 when nothing matches, which is the common case, so only treat a missing binary as an error.
    let stdout = '';
    try {
        ({ stdout } = await execFileAsync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN']));
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('lsof not installed');
    }
    return stdout.split('\n').filter((s) => /^\d+$/.test(s.trim()));
}

async function killPid(pid: string): Promise<void> {
    if (process.platform === 'win32') await execFileAsync('taskkill', ['/PID', pid, '/F']);
    else process.kill(Number(pid), 'SIGKILL');
}

/** Returns false if lookup or any kill failed. */
async function killPort(port: number): Promise<boolean> {
    let pids: string[];
    try {
        pids = await listeningPids(port);
    } catch (err) {
        log(`  Port ${port}: Error checking port (${err instanceof Error ? err.message : err})`, RED);
        return false;
    }
    if (pids.length === 0) {
        log(`  Port ${port}: No process found`, YELLOW);
        return true;
    }
    let ok = true;
    for (const pid of pids) {
        try {
            await killPid(pid);
            log(`  Port ${port}: Killed process ${pid}`, GREEN);
        } catch {
            log(`  Port ${port}: Failed to kill process ${pid}`, RED);
            ok = false;
        }
    }
    return ok;
}

/** Resolve which ports to clear for the given args. Throws on an unknown app. */
export function resolvePorts(args: ParsedArgs, apps: AppPorts[]): { label: string; ports: number[] } {
    if (args.ports?.length) return { label: 'explicit ports', ports: args.ports };
    if (args.app) {
        const app = selectApp(apps, args.app);
        if (!app) {
            const known = apps.map((a) => a.name).join(', ') || '(none found)';
            throw new Error(`Unknown app "${args.app}". Known apps: ${known}`);
        }
        return { label: app.name, ports: app.ports };
    }
    const all = [...new Set(apps.flatMap((a) => a.ports))].sort((a, b) => a - b);
    return { label: 'all apps', ports: all };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const { label, ports } = resolvePorts(args, discoverApps(findRepoRoot()));
    log('');
    log(`${BOLD}Killing dev server processes (${label}): ${ports.join(', ') || 'no ports declared'}${NC}`, YELLOW);
    log('');
    let failed = false;
    for (const port of ports) failed = !(await killPort(port)) || failed;
    log('');
    log(failed ? `${BOLD}Done with errors${NC}` : `${BOLD}Done!${NC}`, failed ? RED : GREEN);
    log('');
    if (failed) process.exitCode = 1;
}

// Entry guard so tests can import the helpers without running the CLI.
if (/kill-ports/.test(process.argv[1] ?? '')) {
    main().catch((err) => {
        log(`${BOLD}Error:${NC} ${err.message}`, RED);
        process.exit(1);
    });
}

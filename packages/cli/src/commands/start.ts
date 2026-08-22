import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';
import { getPnpmInvocation, log, resolveApp, type AppDevelopmentProcess, type AppInfo } from '../utils/index.js';

const DEVELOPMENT_ENVIRONMENTS = new Set(['dev', 'development', 'local']);
const ENVIRONMENT_ALIASES: Record<string, string> = {
    prod: 'production',
    stage: 'staging',
};

interface CloudflareAppConfig {
    buildCommand?: string;
    workerBuildCommand?: string | null;
    wranglerConfig?: string;
}

interface WranglerConfig {
    env?: Record<string, unknown>;
}

interface ShutdownSignal {
    kind: 'signal';
    signal: NodeJS.Signals;
}

const GRACEFUL_SHUTDOWN_MS = 3_000;
const FORCED_SHUTDOWN_MS = 1_000;

export interface StartOptions {
    environment?: string;
    process?: string;
    port?: number;
    processPorts?: Record<string, number>;
    skipBuild?: boolean;
    noOpen?: boolean;
    dryRun?: boolean;
    timeoutMs?: number;
}

export interface StartCommand {
    name: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
}

export interface StartPlan {
    app: AppInfo;
    environment: string;
    mode: 'development' | 'worker';
    buildCommands: StartCommand[];
    processes: StartCommand[];
    readinessUrls: string[];
    openUrl?: string;
    platformError?: string;
    timeoutMs: number;
}

function normalizeEnvironment(value: string | undefined): string {
    const normalized = (value || 'development').trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]*$/.test(normalized)) {
        throw new Error(`Invalid environment "${value}". Use letters, numbers, hyphens, or underscores.`);
    }
    return ENVIRONMENT_ALIASES[normalized] || normalized;
}

function assertPort(port: number, label: string): void {
    if (!Number.isInteger(port) || port <= 0 || port >= 65536) {
        throw new Error(`Invalid port for ${label}: ${port}. Must be an integer between 1 and 65535.`);
    }
}

/** Honours a port exported in the shell (PORT_FE=3005 pnpm dev) so readiness URLs follow it. */
function readEnvPort(portEnv: string | undefined): number | undefined {
    const raw = portEnv ? process.env[portEnv] : undefined;
    if (!raw) return undefined;
    const port = Number(raw);
    assertPort(port, portEnv as string);
    return port;
}

function resolveTimeout(app: AppInfo, options: StartOptions): number {
    const timeout = options.timeoutMs ?? app.ottabase.start?.readyTimeoutMs ?? 90_000;
    if (!Number.isFinite(timeout) || timeout <= 0) {
        throw new Error(`Invalid readiness timeout for ${app.name}: ${timeout}. Must be a positive number.`);
    }
    return timeout;
}

function withPort(value: string | undefined, port: number | undefined): string | undefined {
    if (!value || port === undefined) return value;
    const url = new URL(value);
    url.port = String(port);
    return url.toString().replace(/\/$/, value.endsWith('/') ? '/' : '');
}

function readCloudflareConfig(app: AppInfo): CloudflareAppConfig {
    const configPath = path.join(app.path, 'cloudflare-config.json');
    if (!fs.existsSync(configPath)) return {};

    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8')) as CloudflareAppConfig;
    } catch (error) {
        throw new Error(`Could not parse ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function assertWranglerEnvironment(configPath: string, environment: string): void {
    const errors: ParseError[] = [];
    const config = parse(fs.readFileSync(configPath, 'utf8'), errors, { allowTrailingComma: true }) as WranglerConfig;
    if (errors.length > 0) {
        const first = errors[0] as ParseError;
        throw new Error(
            `Could not parse ${configPath}: ${printParseErrorCode(first.error)} at character ${first.offset}.`,
        );
    }

    const environments = config.env || {};
    if (!Object.prototype.hasOwnProperty.call(environments, environment)) {
        const available = Object.keys(environments).sort();
        throw new Error(
            `Wrangler environment "${environment}" is not defined in ${path.basename(configPath)}. ` +
                `Available: ${available.length > 0 ? available.join(', ') : 'none'}.`,
        );
    }
}

function validateDevelopmentProcesses(app: AppInfo, processes: AppDevelopmentProcess[]): void {
    if (processes.length === 0) {
        throw new Error(`App "${app.name}" has no development processes configured.`);
    }

    const names = new Set<string>();
    let primaryCount = 0;
    for (const process of processes) {
        if (!/^[a-z][a-z0-9_-]*$/.test(process.name)) {
            throw new Error(`Invalid development process name "${process.name}" in ${app.name}.`);
        }
        if (names.has(process.name)) {
            throw new Error(`Duplicate development process "${process.name}" in ${app.name}.`);
        }
        names.add(process.name);
        if (process.primary) primaryCount += 1;
        if (!app.scripts[process.script]) {
            throw new Error(
                `Development process "${process.name}" references missing package script "${process.script}".`,
            );
        }
    }

    if (primaryCount > 1) {
        throw new Error(`App "${app.name}" configures more than one primary development process.`);
    }
}

function createDevelopmentPlan(app: AppInfo, environment: string, options: StartOptions): StartPlan {
    const configured = app.ottabase.start?.development?.processes;
    const allProcesses: AppDevelopmentProcess[] =
        configured && configured.length > 0 ? configured : [{ name: 'app', script: 'dev', primary: true }];

    validateDevelopmentProcesses(app, allProcesses);

    let selected = allProcesses;
    if (options.process) {
        const match = allProcesses.find((process) => process.name === options.process);
        if (!match) {
            throw new Error(
                `Unknown process "${options.process}" for ${app.name}. Available: ${allProcesses.map((process) => process.name).join(', ')}`,
            );
        }
        selected = [match];
    }

    const configuredPrimary = allProcesses.find((process) => process.primary) || allProcesses[0];
    const primary = selected.includes(configuredPrimary as AppDevelopmentProcess)
        ? (configuredPrimary as AppDevelopmentProcess)
        : (selected[0] as AppDevelopmentProcess);

    const processPorts = options.processPorts || {};
    for (const name of Object.keys(processPorts)) {
        if (!selected.some((process) => process.name === name)) {
            throw new Error(
                `Process "${name}" is not being started. Available: ${selected.map((process) => process.name).join(', ')}`,
            );
        }
        assertPort(processPorts[name] as number, name);
    }
    if (options.port !== undefined) assertPort(options.port, primary.name);

    const planned = selected.map((config) => {
        const override = processPorts[config.name] ?? (config === primary ? options.port : undefined);
        if (override !== undefined && !config.portEnv) {
            throw new Error(`Process "${config.name}" does not declare portEnv, so its port cannot be overridden.`);
        }

        const port = override ?? readEnvPort(config.portEnv);
        return {
            config,
            port,
            url: withPort(config.url, port),
            readyUrl: withPort(config.readyUrl || config.url, port),
            command: {
                name: config.name,
                // No `--` separator: pnpm forwards it literally, and the script's binary sees it.
                args:
                    port === undefined || !config.portArg
                        ? ['run', config.script]
                        : ['run', config.script, config.portArg, String(port)],
                cwd: app.path,
                env: {},
            } satisfies StartCommand,
        };
    });

    // Siblings proxy to each other (Vite -> Worker), so every process sees the whole port map.
    const portEnv = Object.fromEntries(
        planned.flatMap(({ config, port }) =>
            port !== undefined && config.portEnv ? [[config.portEnv, String(port)]] : [],
        ),
    );
    for (const { command } of planned) Object.assign(command.env, portEnv);

    const primaryPlan = planned.find(({ config }) => config === primary) || planned[0];
    return {
        app,
        environment,
        mode: 'development',
        buildCommands: [],
        processes: planned.map(({ command }) => command),
        readinessUrls: planned.flatMap(({ readyUrl }) => (readyUrl ? [readyUrl] : [])),
        openUrl: primaryPlan?.url,
        timeoutMs: resolveTimeout(app, options),
    };
}

function createWorkerPlan(app: AppInfo, environment: string, options: StartOptions): StartPlan {
    if (options.process) {
        throw new Error('--process is only available for the development environment.');
    }

    const config = readCloudflareConfig(app);
    const buildScripts = [config.buildCommand || 'build', config.workerBuildCommand].filter(
        (script): script is string => typeof script === 'string' && script.length > 0,
    );

    for (const script of buildScripts) {
        if (!app.scripts[script]) {
            throw new Error(`Cloudflare config references missing package script "${script}" in ${app.name}.`);
        }
    }

    const wranglerConfig = config.wranglerConfig || 'wrangler.jsonc';
    const resolvedWranglerConfig = path.resolve(app.path, wranglerConfig);
    const relativeWranglerConfig = path.relative(app.path, resolvedWranglerConfig);
    if (relativeWranglerConfig.startsWith('..') || path.isAbsolute(relativeWranglerConfig)) {
        throw new Error(`Wrangler config must stay inside ${app.path}: ${wranglerConfig}`);
    }
    if (!fs.existsSync(resolvedWranglerConfig)) {
        throw new Error(`App "${app.name}" has no ${wranglerConfig}; named environment start is unavailable.`);
    }
    assertWranglerEnvironment(resolvedWranglerConfig, environment);

    if (options.port !== undefined) assertPort(options.port, 'worker');
    if (options.processPorts && Object.keys(options.processPorts).length > 0) {
        throw new Error('--port-for is only available for the development environment. Use --port for worker mode.');
    }

    const workerConfig = app.ottabase.start?.worker;
    const url = withPort(workerConfig?.url, options.port);
    const readyUrl = withPort(workerConfig?.readyUrl || workerConfig?.url, options.port);
    const args = ['exec', 'wrangler', 'dev', '--local', '--env', environment, '--config', wranglerConfig];
    if (options.port !== undefined) args.push('--port', String(options.port));

    return {
        app,
        environment,
        mode: 'worker',
        buildCommands: options.skipBuild
            ? []
            : buildScripts.map((script) => ({
                  name: script,
                  args: ['run', script],
                  cwd: app.path,
                  env: {},
              })),
        processes: [{ name: 'worker', args, cwd: app.path, env: {} }],
        readinessUrls: readyUrl ? [readyUrl] : [],
        openUrl: url,
        platformError: workerConfig?.unsupportedPlatforms?.[process.platform],
        timeoutMs: resolveTimeout(app, options),
    };
}

/** Creates a deterministic, side-effect-free execution plan for an app start. */
export function createStartPlan(appName?: string, options: StartOptions = {}): StartPlan {
    const app = resolveApp(appName);
    const environment = normalizeEnvironment(options.environment);
    return DEVELOPMENT_ENVIRONMENTS.has(environment)
        ? createDevelopmentPlan(app, 'development', options)
        : createWorkerPlan(app, environment, options);
}

export function formatStartPlan(plan: StartPlan): string {
    const lines = [`App: ${plan.app.name}`, `Environment: ${plan.environment}`, `Mode: ${plan.mode}`];
    for (const command of plan.buildCommands) {
        lines.push(`Build: pnpm ${command.args.join(' ')}`);
    }
    for (const process of plan.processes) {
        const env = Object.entries(process.env)
            .map(([key, value]) => `${key}=${value}`)
            .join(' ');
        lines.push(`Run (${process.name}): ${env ? `${env} ` : ''}pnpm ${process.args.join(' ')}`);
    }
    if (plan.openUrl) lines.push(`Open: ${plan.openUrl}`);
    if (plan.platformError) lines.push(`Unavailable on ${process.platform}: ${plan.platformError}`);
    return lines.join('\n');
}

function createProcessEnv(command: StartCommand): NodeJS.ProcessEnv {
    return {
        ...process.env,
        // Keep Wrangler diagnostics app-local and writable in restricted dev environments.
        WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || path.join(command.cwd, '.wrangler', 'logs'),
        // A supervised process must fail non-interactively; users can explicitly opt in per shell.
        WRANGLER_SEND_ERROR_REPORTS: process.env.WRANGLER_SEND_ERROR_REPORTS ?? 'false',
        ...command.env,
    };
}

/** Prefix complete output lines while preserving chunks split across stream events. */
export function pipePrefixedOutput(
    stream: NodeJS.ReadableStream | null,
    name: string,
    output: Pick<NodeJS.WriteStream, 'write'>,
): void {
    if (!stream) return;

    const prefix = `[${name}]`;
    let pending = '';
    const writeLine = (line: string) => output.write(line.length > 0 ? `${prefix} ${line}\n` : '\n');
    const flush = () => {
        if (!pending) return;
        writeLine(pending);
        pending = '';
    };

    stream.on('data', (chunk: string | Buffer) => {
        const lines = `${pending}${chunk.toString()}`.split(/\r\n|\n|\r/);
        pending = lines.pop() || '';
        for (const line of lines) writeLine(line);
    });
    stream.once('end', flush);
}

function waitForUrl(url: string, timeoutMs: number, signal: AbortSignal): Promise<void> {
    const startedAt = Date.now();
    const client = new URL(url).protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
        let settled = false;
        let timer: NodeJS.Timeout | undefined;
        let activeRequest: http.ClientRequest | undefined;

        const finish = (callback: () => void) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            callback();
        };

        const onAbort = () => {
            activeRequest?.destroy();
            finish(() => reject(new Error(`Readiness check for ${url} was cancelled.`)));
        };

        const check = () => {
            if (signal.aborted) {
                onAbort();
                return;
            }

            activeRequest = client.get(url, (response) => {
                response.resume();
                const status = response.statusCode || 0;
                if (status >= 200 && status < 400) {
                    finish(resolve);
                    return;
                }
                retry(`last status: ${status}`);
            });

            activeRequest.once('error', () => retry());
            activeRequest.setTimeout(2_000, () => activeRequest?.destroy());
        };

        const retry = (detail?: string) => {
            if (settled) return;
            if (Date.now() - startedAt >= timeoutMs) {
                finish(() =>
                    reject(
                        new Error(`${url} did not become ready within ${timeoutMs}ms${detail ? ` (${detail})` : ''}.`),
                    ),
                );
                return;
            }
            timer = setTimeout(check, 250);
        };

        signal.addEventListener('abort', onAbort, { once: true });
        check();
    });
}

function openBrowser(url: string): void {
    let command: string;
    let args: string[];
    if (process.platform === 'win32') {
        command = 'rundll32.exe';
        args = ['url.dll,FileProtocolHandler', url];
    } else if (process.platform === 'darwin') {
        command = 'open';
        args = [url];
    } else {
        command = 'xdg-open';
        args = [url];
    }

    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.once('error', (error) => log.warn(`Could not open ${url} in a browser: ${error.message}`));
    child.unref();
}

function isProcessRunning(child: ChildProcess): boolean {
    return Boolean(child.pid) && child.exitCode === null && child.signalCode === null;
}

function signalProcessTree(child: ChildProcess, force: boolean): boolean {
    if (!child.pid || !isProcessRunning(child)) return true;
    if (process.platform === 'win32') {
        const args = ['/pid', String(child.pid), '/t'];
        if (force) args.push('/f');
        return spawnSync('taskkill.exe', args, { stdio: 'ignore' }).status === 0;
    }

    const signal = force ? 'SIGKILL' : 'SIGTERM';
    try {
        process.kill(-child.pid, signal);
        return true;
    } catch {
        return child.kill(signal);
    }
}

function waitForProcessExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
    if (!isProcessRunning(child)) return Promise.resolve(true);
    return new Promise((resolve) => {
        let settled = false;
        const finish = (exited: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            child.off('close', onClose);
            resolve(exited);
        };
        const onClose = () => finish(true);
        const timer = setTimeout(() => finish(!isProcessRunning(child)), timeoutMs);
        child.once('close', onClose);
        if (!isProcessRunning(child)) finish(true);
    });
}

async function stopProcess(child: ChildProcess, name: string): Promise<void> {
    if (!isProcessRunning(child)) return;
    // Windows cannot reliably forward a graceful console signal through the
    // cmd.exe -> pnpm -> app chain. A non-forced taskkill can remove only the
    // wrapper and orphan its descendants, so terminate the captured tree once.
    if (process.platform === 'win32') {
        if (!signalProcessTree(child, true)) log.warn(`Could not terminate the ${name} process tree (${child.pid}).`);
        await waitForProcessExit(child, FORCED_SHUTDOWN_MS);
        return;
    }
    signalProcessTree(child, false);
    if (await waitForProcessExit(child, GRACEFUL_SHUTDOWN_MS)) return;
    signalProcessTree(child, true);
    await waitForProcessExit(child, FORCED_SHUTDOWN_MS);
}

function spawnBuildCommand(command: StartCommand): ChildProcess {
    const invocation = getPnpmInvocation(command.args);
    return spawn(invocation.command, invocation.args, {
        cwd: command.cwd,
        env: createProcessEnv(command),
        detached: process.platform !== 'win32',
        stdio: 'inherit',
    });
}

async function runCommand(command: StartCommand, signalPromise: Promise<ShutdownSignal>): Promise<boolean> {
    const child = spawnBuildCommand(command);
    const outcome = await Promise.race([
        new Promise<{ kind: 'exit'; code: number | null }>((resolve, reject) => {
            child.once('error', reject);
            child.once('close', (code) => resolve({ kind: 'exit', code }));
        }),
        signalPromise,
    ]);

    if (outcome.kind === 'signal') {
        await stopProcess(child, command.name);
        return false;
    }
    if (outcome.code === 0) return true;
    if (outcome.code === null) throw new Error(`${command.name} was interrupted.`);
    throw new Error(`${command.name} exited with code ${outcome.code}.`);
}

/** Executes a start plan, supervising every long-running process as one lifecycle. */
export async function runStartPlan(plan: StartPlan, options: StartOptions = {}): Promise<void> {
    log.info(`Starting ${plan.app.name} in ${plan.environment} (${plan.mode})...`);
    log.dim(formatStartPlan(plan));
    if (options.dryRun) return;
    if (plan.platformError) throw new Error(plan.platformError);

    let signal: NodeJS.Signals | undefined;
    let removeSignalHandlers = () => {};
    const signalPromise = new Promise<ShutdownSignal>((resolve) => {
        const onSigint = () => {
            signal = 'SIGINT';
            resolve({ kind: 'signal', signal });
        };
        const onSigterm = () => {
            signal = 'SIGTERM';
            resolve({ kind: 'signal', signal });
        };
        process.once('SIGINT', onSigint);
        process.once('SIGTERM', onSigterm);
        removeSignalHandlers = () => {
            process.off('SIGINT', onSigint);
            process.off('SIGTERM', onSigterm);
        };
    });
    const readinessController = new AbortController();
    const children: Array<{ command: StartCommand; child: ChildProcess }> = [];

    try {
        for (const build of plan.buildCommands) {
            log.step(`Running ${build.name}...`);
            if (!(await runCommand(build, signalPromise))) return;
        }

        for (const command of plan.processes) {
            const invocation = getPnpmInvocation(command.args);
            const child = spawn(invocation.command, invocation.args, {
                cwd: command.cwd,
                env: createProcessEnv(command),
                detached: process.platform !== 'win32',
                stdio: ['inherit', 'pipe', 'pipe'],
            });
            const width = Math.max(...plan.processes.map((process) => process.name.length));
            pipePrefixedOutput(child.stdout, command.name.padEnd(width), process.stdout);
            pipePrefixedOutput(child.stderr, command.name.padEnd(width), process.stderr);
            children.push({ command, child });
        }

        const exitPromise = Promise.race(
            children.map(
                ({ child, command }) =>
                    new Promise<{ kind: 'exit'; command: StartCommand; code: number | null }>((resolve, reject) => {
                        child.once('error', reject);
                        child.once('close', (code) => resolve({ kind: 'exit', command, code }));
                    }),
            ),
        );

        if (plan.readinessUrls.length > 0) {
            const startup = await Promise.race([
                Promise.all(
                    plan.readinessUrls.map((url) => waitForUrl(url, plan.timeoutMs, readinessController.signal)),
                ).then(() => ({ kind: 'ready' }) as const),
                exitPromise,
                signalPromise,
            ]);
            if (startup.kind === 'exit') {
                throw new Error(`${startup.command.name} exited before startup completed (code ${startup.code}).`);
            }
            if (startup.kind === 'signal') return;
        }

        log.success(`${plan.app.name} is ready.`);
        if (plan.openUrl) {
            log.info(`URL: ${plan.openUrl}`);
            if (!options.noOpen) openBrowser(plan.openUrl);
        }

        const outcome = await Promise.race([exitPromise, signalPromise]);
        if (outcome.kind === 'exit' && outcome.code !== 0 && outcome.code !== null) {
            throw new Error(`${outcome.command.name} exited with code ${outcome.code}.`);
        }
    } finally {
        readinessController.abort();
        removeSignalHandlers();
        await Promise.all(children.map(({ child, command }) => stopProcess(child, command.name)));
        if (signal) log.info(`Stopped after ${signal}.`);
    }
}

export async function startApp(appName?: string, options: StartOptions = {}): Promise<void> {
    const plan = createStartPlan(appName, options);
    await runStartPlan(plan, options);
}

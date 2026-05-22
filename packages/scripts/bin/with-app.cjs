#!/usr/bin/env node
/**
 * Generic command wrapper that resolves the active app and runs a downstream
 * command with `{app}` and `{packageName}` placeholders replaced.
 *
 * Usage:
 *   node packages/scripts/bin/with-app.cjs pnpm --filter @ottabase/{app} dev
 *   node packages/scripts/bin/with-app.cjs turbo build --filter=@ottabase/{app}...
 *
 * The wrapper accepts (and removes) `--app=<name>` before forwarding the rest
 * to the downstream command. The downstream command is spawned without a shell;
 * on Windows, `.cmd` is appended to bare binary names for compatibility.
 */

const { spawn } = require('child_process');
const { resolveActiveApp } = require('./lib/resolve-app.cjs');

function getBinFor(cmd) {
    if (process.platform !== 'win32') return cmd;
    // Windows resolves `pnpm` / `turbo` shims as .cmd. Only mangle bare binary
    // names; if the caller already passed a path or extension, leave it alone.
    if (cmd.includes('/') || cmd.includes('\\') || cmd.includes('.')) return cmd;
    return `${cmd}.cmd`;
}

function main() {
    const { app, packageName, restArgv, root } = resolveActiveApp();

    if (restArgv.length === 0) {
        console.error('with-app: no command provided. Usage: with-app.cjs <cmd> [args...]');
        process.exit(2);
    }

    const substituted = restArgv.map((a) => a.replaceAll('{app}', app).replaceAll('{packageName}', packageName));
    const [rawCmd, ...args] = substituted;
    const cmd = getBinFor(rawCmd);

    const child = spawn(cmd, args, {
        stdio: 'inherit',
        cwd: root,
        env: { ...process.env, OTTABASE_APP: app },
    });

    const forwardSignal = (sig) => () => child.kill(sig);
    process.on('SIGINT', forwardSignal('SIGINT'));
    process.on('SIGTERM', forwardSignal('SIGTERM'));

    child.on('error', (err) => {
        console.error(`with-app: failed to spawn "${cmd}": ${err.message}`);
        process.exit(1);
    });
    child.on('exit', (code, signal) => {
        if (signal) process.kill(process.pid, signal);
        else process.exit(code ?? 0);
    });
}

main();

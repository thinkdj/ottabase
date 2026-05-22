#!/usr/bin/env node
/**
 * Generic command wrapper that resolves the active app and runs a downstream
 * command with `{app}` and `{packageName}` placeholders replaced.
 *
 * Usage:
 *   node packages/scripts/bin/with-app.cjs pnpm --filter {packageName} dev
 *   node packages/scripts/bin/with-app.cjs turbo build --filter=@ottabase/{app}...
 *
 * The wrapper accepts (and strips) `--app=<name>` (or `--app <name>`) before
 * forwarding the rest. Spawns through a shell on Windows so PATHEXT picks up
 * `.cmd`/`.bat` shims for `pnpm` / `turbo`; spawns directly on Unix.
 */

const { spawn } = require('child_process');
const { resolveActiveApp } = require('./lib/resolve-app.cjs');

function main() {
    let resolved;
    try {
        resolved = resolveActiveApp();
    } catch (err) {
        console.error(`with-app: ${err.message}`);
        process.exit(1);
    }

    const { app, packageName, restArgv, root } = resolved;

    if (restArgv.length === 0) {
        console.error('with-app: no command provided. Usage: with-app.cjs <cmd> [args...]');
        process.exit(2);
    }

    const substituted = restArgv.map((a) => a.replaceAll('{app}', app).replaceAll('{packageName}', packageName));
    const [cmd, ...args] = substituted;

    // On Windows, spawning bare `pnpm` / `turbo` without a shell fails because
    // those are .cmd shims and the bare name isn't resolved via PATHEXT in
    // child_process.spawn. Use shell mode on Windows; direct spawn elsewhere.
    const useShell = process.platform === 'win32';

    const child = spawn(cmd, args, {
        stdio: 'inherit',
        cwd: root,
        env: { ...process.env, OTTABASE_APP: app },
        shell: useShell,
    });

    const forwardSignal = (sig) => () => {
        if (!child.killed) child.kill(sig);
    };
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

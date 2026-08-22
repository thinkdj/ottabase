import { once } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import {
    createStartPlan,
    formatStartPlan,
    pipePrefixedOutput,
    runStartPlan,
    type StartPlan,
} from '../commands/start.js';

const testArtifacts = path.join(process.cwd(), '.wrangler', `start-tests-${process.pid}`);

afterAll(() => {
    fs.rmSync(testArtifacts, { force: true, recursive: true });
});

async function getAvailablePort(): Promise<number> {
    const server = http.createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Could not allocate a test port.');
    const { port } = address;
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    return port;
}

function createFixturePlan(processes: StartPlan['processes'], readinessUrls: string[]): StartPlan {
    const app = createStartPlan('otta-landing').app;
    return {
        app: { ...app, name: 'start-fixture', path: process.cwd() },
        environment: 'development',
        mode: 'development',
        buildCommands: [],
        processes,
        readinessUrls,
        timeoutMs: 5_000,
    };
}

function canReach(url: string): Promise<boolean> {
    return new Promise((resolve) => {
        const request = http.get(url, (response) => {
            response.resume();
            resolve(true);
        });
        request.once('error', () => resolve(false));
        request.setTimeout(250, () => {
            request.destroy();
            resolve(false);
        });
    });
}

async function waitUntilUnavailable(url: string, timeoutMs = 2_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (!(await canReach(url))) return true;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return !(await canReach(url));
}

describe('app start planning', () => {
    it('starts the configured default app as one supervised development topology', () => {
        const plan = createStartPlan();

        expect(plan.app.name).toBe('otta-web');
        expect(plan.environment).toBe('development');
        expect(plan.mode).toBe('development');
        expect(plan.buildCommands).toEqual([]);
        expect(plan.processes.map((process) => process.name)).toEqual(['web', 'worker']);
        expect(plan.processes.map((process) => process.args)).toEqual([
            ['run', 'dev'],
            ['run', 'dev:worker'],
        ]);
        expect(plan.openUrl).toBe('http://127.0.0.1:3003');
        expect(plan.readinessUrls).toEqual(['http://127.0.0.1:3003', 'http://127.0.0.1:3004/api/health']);
    });

    it('can start one process and override named ports without framework-specific CLI flags', () => {
        const web = createStartPlan('otta-web', { process: 'web', port: 3100 });
        expect(web.processes).toHaveLength(1);
        expect(web.processes[0]?.env).toEqual({ PORT_FE: '3100' });
        expect(web.openUrl).toBe('http://127.0.0.1:3100');

        const full = createStartPlan('otta-web', { processPorts: { worker: 3101 } });
        expect(full.processes[1]?.env).toEqual({ PORT_BE: '3101' });
        expect(full.readinessUrls[1]).toBe('http://127.0.0.1:3101/api/health');
        // Wrangler reads neither PORT_BE nor a shared env, so the port must reach it as a flag,
        // and Vite must see PORT_BE to proxy at the moved port.
        expect(full.processes[1]?.args).toEqual(['run', 'dev:worker', '--port', '3101']);
        expect(full.processes[0]?.env).toEqual({ PORT_BE: '3101' });
    });

    it('follows ports exported in the shell so readiness checks track the real listeners', () => {
        process.env.PORT_FE = '3105';
        process.env.PORT_BE = '3106';
        try {
            const plan = createStartPlan('otta-web');
            expect(plan.openUrl).toBe('http://127.0.0.1:3105');
            expect(plan.readinessUrls).toEqual(['http://127.0.0.1:3105', 'http://127.0.0.1:3106/api/health']);
            expect(plan.processes[1]?.args).toEqual(['run', 'dev:worker', '--port', '3106']);
            expect(plan.processes[0]?.env).toEqual({ PORT_FE: '3105', PORT_BE: '3106' });
        } finally {
            delete process.env.PORT_FE;
            delete process.env.PORT_BE;
        }
    });

    it('uses each app package as the source of truth for its development topology', () => {
        const plan = createStartPlan('@ottabase/otta-landing');

        expect(plan.app.name).toBe('otta-landing');
        expect(plan.processes.map((process) => process.name)).toEqual(['web']);
        expect(plan.processes[0]?.env).toEqual({});
        expect(plan.openUrl).toBe('http://127.0.0.1:3000');
        expect(plan.platformError).toBeUndefined();
    });

    it('builds then starts any named Wrangler environment locally', () => {
        const plan = createStartPlan('otta-landing', { environment: 'preview', port: 8899 });

        expect(plan.mode).toBe('worker');
        expect(plan.buildCommands.map((command) => command.args)).toEqual([
            ['run', 'build'],
            ['run', 'build:worker'],
        ]);
        expect(plan.processes[0]?.args).toEqual([
            'exec',
            'wrangler',
            'dev',
            '--local',
            '--env',
            'preview',
            '--config',
            'wrangler.jsonc',
            '--port',
            '8899',
        ]);
        expect(plan.openUrl).toBe('http://127.0.0.1:8899');
        if (process.platform === 'win32') {
            expect(plan.platformError).toMatch(/OpenNext Worker packaging/);
            expect(formatStartPlan(plan)).toContain('Unavailable on win32');
        } else {
            expect(plan.platformError).toBeUndefined();
        }
    });

    it('normalizes common environment aliases and supports cached worker output', () => {
        const plan = createStartPlan('otta-web', { environment: 'prod', skipBuild: true });

        expect(plan.environment).toBe('production');
        expect(plan.buildCommands).toEqual([]);
        expect(plan.processes[0]?.args).toContain('production');
        expect(formatStartPlan(plan)).toContain('Environment: production');
        expect(formatStartPlan(plan)).not.toContain('Build:');

        const staging = createStartPlan('otta-web', { environment: 'stage', skipBuild: true });
        expect(staging.environment).toBe('staging');
        expect(staging.processes[0]?.args).toContain('staging');
    });

    it('fails early for unknown processes and invalid port mappings', () => {
        expect(() => createStartPlan('otta-web', { process: 'missing' })).toThrow(/Available: web, worker/);
        expect(() => createStartPlan('otta-web', { processPorts: { missing: 4000 } })).toThrow(/not being started/);
        expect(() => createStartPlan('otta-web', { port: 70_000 })).toThrow(/between 1 and 65535/);
    });

    it('fails before building when a named Wrangler environment is not configured', () => {
        expect(() => createStartPlan('otta-web', { environment: 'qa' })).toThrow(
            /environment "qa" is not defined.*Available: preview, production, staging/,
        );
    });

    it('prefixes process output without losing lines split across chunks', async () => {
        const stream = new PassThrough();
        let output = '';
        const destination = {
            write(chunk: string | Uint8Array) {
                output += chunk.toString();
                return true;
            },
        } as unknown as Pick<NodeJS.WriteStream, 'write'>;

        pipePrefixedOutput(stream, 'worker', destination);
        const ended = once(stream, 'end');
        stream.write('first part');
        stream.write(' done\nsecond');
        stream.end();
        await ended;

        expect(output).toBe('[worker] first part done\n[worker] second\n');
    });

    it('waits for real process readiness and completes after a clean exit', async () => {
        const port = await getAvailablePort();
        const plan = createFixturePlan(
            [
                {
                    name: 'fixture',
                    args: [
                        'exec',
                        'node',
                        'src/__tests__/fixtures/start-process.cjs',
                        '--port',
                        String(port),
                        '--exit-after',
                        '300',
                    ],
                    cwd: process.cwd(),
                    env: {},
                },
            ],
            [`http://127.0.0.1:${port}`],
        );

        await expect(runStartPlan(plan, { noOpen: true })).resolves.toBeUndefined();
    });

    it('stops sibling process trees when one supervised process fails', async () => {
        const failingPort = await getAvailablePort();
        const siblingPort = await getAvailablePort();
        const siblingMarker = path.join(testArtifacts, 'sibling.pid');
        const plan = createFixturePlan(
            [
                {
                    name: 'failing',
                    args: [
                        'exec',
                        'node',
                        'src/__tests__/fixtures/start-process.cjs',
                        '--port',
                        String(failingPort),
                        '--exit-after',
                        '500',
                        '--exit-code',
                        '7',
                    ],
                    cwd: process.cwd(),
                    env: {},
                },
                {
                    name: 'sibling',
                    args: [
                        'exec',
                        'node',
                        'src/__tests__/fixtures/start-process.cjs',
                        '--port',
                        String(siblingPort),
                        '--exit-after',
                        '10000',
                        '--marker',
                        siblingMarker,
                    ],
                    cwd: process.cwd(),
                    env: {},
                },
            ],
            [`http://127.0.0.1:${failingPort}`, `http://127.0.0.1:${siblingPort}`],
        );

        await expect(runStartPlan(plan, { noOpen: true })).rejects.toThrow(/failing exited with code 7/);
        expect(fs.existsSync(siblingMarker)).toBe(true);
        expect(await waitUntilUnavailable(`http://127.0.0.1:${siblingPort}`)).toBe(true);
    }, 15_000);
});

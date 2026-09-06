import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    discoverApps,
    parseArgs,
    pidsFromNetstat,
    portsFromPackageJson,
    resolvePorts,
    selectApp,
} from '../cli/kill-ports';

const APPS = [
    { name: 'otta-web', packageName: '@ottabase/otta-web', ports: [3003, 3004] },
    { name: 'uppcoming', packageName: '@upp/uppcoming', ports: [3203, 3204] },
];

describe('app selection', () => {
    it('reads ports from ottabase.start urls, deduped and sorted', () => {
        const pkg = {
            ottabase: {
                start: {
                    development: {
                        processes: [
                            { url: 'http://127.0.0.1:3004', readyUrl: 'http://127.0.0.1:3004/api/health' },
                            { url: 'http://127.0.0.1:3003' },
                        ],
                    },
                    worker: { url: 'http://127.0.0.1:3004' },
                },
            },
        };
        expect(portsFromPackageJson(pkg)).toEqual([3003, 3004]);
        expect(portsFromPackageJson({})).toEqual([]);
    });

    it('matches --app by dir name, package name, or unscoped tail', () => {
        expect(selectApp(APPS, 'uppcoming')?.ports).toEqual([3203, 3204]);
        expect(selectApp(APPS, '@ottabase/otta-web')?.ports).toEqual([3003, 3004]);
        expect(selectApp(APPS, 'OTTA-WEB')?.ports).toEqual([3003, 3004]);
        expect(selectApp(APPS, 'nope')).toBeUndefined();
    });

    it('resolves all ports with no app, one app with --app, explicit with --ports', () => {
        expect(resolvePorts(parseArgs([]), APPS).ports).toEqual([3003, 3004, 3203, 3204]);
        expect(resolvePorts(parseArgs(['--app=uppcoming']), APPS).ports).toEqual([3203, 3204]);
        expect(resolvePorts(parseArgs(['--app', 'otta-web']), APPS).ports).toEqual([3003, 3004]);
        expect(resolvePorts(parseArgs(['--ports=3203,3204,3203']), APPS).ports).toEqual([3203, 3204]);
        expect(() => resolvePorts(parseArgs(['--app=nope']), APPS)).toThrow(/Unknown app "nope"/);
    });

    it('fails closed on bad input instead of widening to all ports', () => {
        for (const argv of [
            ['--ports=bad'],
            ['--ports='],
            ['--ports=3003,bad'],
            ['--ports=0'],
            ['--unknown'],
            ['--app='],
        ]) {
            expect(() => parseArgs(argv), argv.join(' ')).toThrow();
        }
    });

    it('reports ambiguous unscoped tails and prefers exact matches', () => {
        const apps = [
            { name: 'a', packageName: '@one/site', ports: [1] },
            { name: 'b', packageName: '@two/site', ports: [2] },
        ];
        expect(() => selectApp(apps, 'site')).toThrow(/Ambiguous app "site"/);
        expect(selectApp(apps, '@two/site')?.ports).toEqual([2]);
        expect(selectApp(apps, 'a')?.ports).toEqual([1]);
    });

    it('skips malformed start metadata instead of throwing', () => {
        const pkg = { ottabase: { start: { development: { processes: [null, 5, { url: 7 }] }, worker: null } } };
        expect(portsFromPackageJson(pkg)).toEqual([]);
    });

    const dirs: string[] = [];
    afterEach(() => {
        for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
        dirs.length = 0;
    });

    it('discovers apps from apps/*/package.json', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kill-ports-'));
        dirs.push(root);
        fs.mkdirSync(path.join(root, 'apps', 'demo'), { recursive: true });
        fs.mkdirSync(path.join(root, 'apps', 'no-start'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'apps', 'demo', 'package.json'),
            JSON.stringify({
                name: '@x/demo',
                ottabase: { start: { development: { processes: [{ url: 'http://localhost:3203' }] } } },
            }),
        );
        fs.writeFileSync(path.join(root, 'apps', 'no-start', 'package.json'), JSON.stringify({ name: '@x/ns' }));
        expect(discoverApps(root)).toEqual([{ name: 'demo', packageName: '@x/demo', ports: [3203] }]);
    });
});

describe('windows netstat parsing', () => {
    const OUTPUT = [
        '',
        'Active Connections',
        '',
        '  Proto  Local Address          Foreign Address        State           PID',
        '  TCP    0.0.0.0:3103           0.0.0.0:0              LISTENING       1111',
        '  TCP    0.0.0.0:31030          0.0.0.0:0              LISTENING       2222',
        '  TCP    127.0.0.1:3103         127.0.0.1:50000        ESTABLISHED     3333',
        '  TCP    [::]:3103              [::]:0                 LISTENING       4444',
        '  TCP    [::1]:3104             [::]:0                 LISTENING       5555',
        '  TCP    0.0.0.0:3103           0.0.0.0:0              LISTENING       1111',
        '  UDP    0.0.0.0:3103           *:*                                    6666',
    ].join('\r\n');

    it('returns only LISTENING PIDs on the exact port, deduped', () => {
        expect(pidsFromNetstat(OUTPUT, 3103)).toEqual(['1111', '4444']);
        expect(pidsFromNetstat(OUTPUT, 3104)).toEqual(['5555']);
        expect(pidsFromNetstat(OUTPUT, 310)).toEqual([]);
        expect(pidsFromNetstat(OUTPUT, 31030)).toEqual(['2222']);
    });
});

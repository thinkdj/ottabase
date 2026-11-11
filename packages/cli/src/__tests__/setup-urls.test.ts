import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { getSetupUrls } from '@ottabase/utils/setup-urls';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { program } from '../cli.js';
import {
    buildSetupUrlsReport,
    envFileValue,
    formatSetupUrls,
    installedPackageKeys,
    localOrigin,
    setupTargets,
} from '../commands/setup-urls.js';
import type { AppInfo } from '../utils/index.js';

let dir: string;

function app(overrides: Partial<AppInfo> = {}): AppInfo {
    return {
        name: 'my-app',
        packageName: '@acme/my-app',
        path: dir,
        type: 'web',
        scripts: {},
        dependencies: { '@ottabase/auth': 'workspace:*', '@ottabase/postmaster': 'workspace:*', react: '^19' },
        devDependencies: {},
        ottabase: {
            start: {
                development: {
                    processes: [
                        { name: 'worker', script: 'dev:worker', url: 'http://127.0.0.1:3004' },
                        { name: 'web', script: 'dev', url: 'http://127.0.0.1:3003', primary: true },
                    ],
                },
            },
        },
        ...overrides,
    };
}

const WRANGLER = `{
    // a comment
    "name": "my-app",
    "env": {
        "production": { "routes": [{ "pattern": "app.example.com", "custom_domain": true }] },
        "preview": {}
    }
}`;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otta-setup-urls-'));
});
afterEach(() => fs.removeSync(dir));

describe('otta setup-urls', () => {
    it('is registered with --url and --json', () => {
        const command = program.commands.find((cmd) => cmd.name() === 'setup-urls');
        expect(command).toBeDefined();
        expect(command?.options.map((option) => option.long)).toEqual(['--url', '--json']);
    });

    it('reads a dotenv value, quotes stripped, blank as null', () => {
        expect(envFileValue('A=1\nAUTH_URL="https://a.test"\n', 'AUTH_URL')).toBe('https://a.test');
        expect(envFileValue("AUTH_URL='http://localhost:3003'", 'AUTH_URL')).toBe('http://localhost:3003');
        expect(envFileValue('AUTH_URL=\n', 'AUTH_URL')).toBeNull();
        expect(envFileValue('# AUTH_URL=x', 'AUTH_URL')).toBeNull();
    });

    it('takes the local origin from AUTH_URL in .env.local, else the primary dev URL', () => {
        expect(localOrigin(app())).toBe('http://127.0.0.1:3003');
        fs.writeFileSync(path.join(dir, '.env.local'), 'AUTH_URL=http://localhost:5173\n');
        expect(localOrigin(app())).toBe('http://localhost:5173');
        expect(localOrigin(app({ path: path.join(dir, 'none'), ottabase: {} }))).toBeNull();
    });

    it('takes preview and production from the wrangler custom domain, with a hint when there is none', () => {
        fs.writeFileSync(path.join(dir, 'wrangler.jsonc'), WRANGLER);
        const targets = setupTargets(app());
        expect(targets.map((t) => [t.name, t.origin])).toEqual([
            ['local', 'http://127.0.0.1:3003'],
            ['preview', null],
            ['production', 'https://app.example.com'],
        ]);
        const report = buildSetupUrlsReport(app());
        expect(report[1]).toEqual({ target: 'preview', hint: expect.stringContaining('pass --url') });
    });

    it('prints exactly what getSetupUrls returns for the same origin and packages', () => {
        const [report] = buildSetupUrlsReport(app(), 'App.Example.com');
        expect(report?.urls).toEqual(
            getSetupUrls('https://app.example.com', { packages: installedPackageKeys(app()) }),
        );
        expect(installedPackageKeys(app())).toEqual(['auth', 'postmaster']);
    });

    it('lists the postmaster webhooks only when the app depends on it', () => {
        const ids = (a: AppInfo) =>
            buildSetupUrlsReport(a, 'https://app.example.com')[0]?.urls?.providers.map((p) => p.id);
        expect(ids(app())).toContain('resend');
        expect(ids(app({ dependencies: {} }))).not.toContain('resend');
    });

    it('fails on a bad --url but reports a bad configured origin in place', () => {
        expect(() => buildSetupUrlsReport(app(), 'https://app.example.com/path')).toThrow(/origin only/);
        fs.writeFileSync(path.join(dir, '.dev.vars'), 'AUTH_URL=ftp://nope\n');
        expect(buildSetupUrlsReport(app())[0]).toEqual({ target: 'local', hint: expect.stringContaining('https') });
    });

    it('formats every URL on its own line after its label', () => {
        const text = formatSetupUrls(buildSetupUrlsReport(app(), 'https://app.example.com'), 'my-app');
        expect(text).toContain('Setup URLs for my-app');
        expect(text).toMatch(/Authorized redirect URI\s+https:\/\/app\.example\.com\/api\/auth\/callback\/google/);
        expect(text).toContain('https://app.example.com/api/email/hooks/resend');
    });
});

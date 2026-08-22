import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    GENERATED_ENV_CONFIG,
    GENERATED_ENV_KEYS,
    generateMissingKeys,
    isFillableKey,
    resolveTargetAppDir,
} from '../cli/env-secrets';

const GENERATED_VALUE_RE = /^[A-Z]{3}[A-Za-z0-9]{32}$/;

let tempRoots: string[] = [];

function makeRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ottabase-env-secrets-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, 'apps'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({ ottabase: { defaultApp: 'otta-web' } }, null, 4),
        'utf8',
    );
    return root;
}

function writeApp(root: string, appName: string, template: string, target?: string): string {
    const appDir = path.join(root, 'apps', appName);
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, '.env.example'), template, 'utf8');
    if (target !== undefined) {
        fs.writeFileSync(path.join(appDir, '.env.local'), target, 'utf8');
    }
    return appDir;
}

function readEnv(filePath: string): Record<string, string> {
    const entries = fs
        .readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/))
        .filter((match): match is RegExpMatchArray => !!match)
        .map((match) => [match[1], match[2]] as const);
    return Object.fromEntries(entries);
}

afterEach(() => {
    for (const root of tempRoots) {
        fs.rmSync(root, { recursive: true, force: true });
    }
    tempRoots = [];
});

describe('env-secrets', () => {
    it('uses an explicit allowlist for generated local secrets', () => {
        expect(GENERATED_ENV_CONFIG).toEqual([
            { key: 'AUTH_SECRET', prefix: 'AUT' },
            { key: 'MIGRATION_SECRET', prefix: 'MIG' },
            { key: 'BOOTSTRAP_OWNER_SECRET', prefix: 'BOS' },
            { key: 'CRON_SECRET', prefix: 'CRN' },
            { key: 'AI_CREDENTIAL_SECRET', prefix: 'AIC' },
            { key: 'BLOG_PREVIEW_SECRET', prefix: '' },
        ]);
        expect(GENERATED_ENV_KEYS).toEqual([
            'AUTH_SECRET',
            'MIGRATION_SECRET',
            'BOOTSTRAP_OWNER_SECRET',
            'CRON_SECRET',
            'AI_CREDENTIAL_SECRET',
            'BLOG_PREVIEW_SECRET',
        ]);
        expect(isFillableKey('AUTH_SECRET')).toBe(true);
        expect(isFillableKey('EMAIL_RESEND_API_KEY')).toBe(false);
        expect(isFillableKey('GOOGLE_CLIENT_SECRET')).toBe(false);
        expect(isFillableKey('CFAI_GATEWAY_TOKEN')).toBe(false);
    });

    it('generates only allowlisted missing keys and leaves provider credentials empty', () => {
        const root = makeRoot();
        writeApp(
            root,
            'otta-web',
            [
                'AUTH_SECRET=',
                'MIGRATION_SECRET=',
                'BOOTSTRAP_OWNER_SECRET=',
                'CRON_SECRET=',
                'GOOGLE_CLIENT_SECRET=',
                'EMAIL_RESEND_API_KEY=',
                'CFAI_GATEWAY_TOKEN=',
                '',
            ].join('\n'),
        );

        const result = generateMissingKeys({ cwd: root, env: {} });
        const env = readEnv(result.targetPath);

        expect(result.appName).toBe('otta-web');
        expect(result.generated).toHaveLength(4);
        expect(env.AUTH_SECRET).toMatch(/^AUT[A-Za-z0-9]{32}$/);
        expect(env.MIGRATION_SECRET).toMatch(/^MIG[A-Za-z0-9]{32}$/);
        expect(env.BOOTSTRAP_OWNER_SECRET).toMatch(/^BOS[A-Za-z0-9]{32}$/);
        expect(env.CRON_SECRET).toMatch(/^CRN[A-Za-z0-9]{32}$/);
        expect(env.AUTH_SECRET).toMatch(GENERATED_VALUE_RE);
        expect(env.GOOGLE_CLIENT_SECRET).toBe('');
        expect(env.EMAIL_RESEND_API_KEY).toBe('');
        expect(env.CFAI_GATEWAY_TOKEN).toBe('');
    });

    it('preserves existing non-empty values and is rerun-safe', () => {
        const root = makeRoot();
        writeApp(
            root,
            'otta-web',
            ['AUTH_SECRET=', 'MIGRATION_SECRET=', 'BOOTSTRAP_OWNER_SECRET=', 'GOOGLE_CLIENT_SECRET=', ''].join('\n'),
            ['AUTH_SECRET=existing-auth-secret', 'MIGRATION_SECRET=', 'GOOGLE_CLIENT_SECRET=', ''].join('\n'),
        );

        const first = generateMissingKeys({ cwd: root, env: {} });
        const firstText = fs.readFileSync(first.targetPath, 'utf8');
        const env = readEnv(first.targetPath);

        expect(first.generated).toHaveLength(2);
        expect(env.AUTH_SECRET).toBe('existing-auth-secret');
        expect(env.MIGRATION_SECRET).toMatch(/^MIG[A-Za-z0-9]{32}$/);
        expect(env.BOOTSTRAP_OWNER_SECRET).toMatch(/^BOS[A-Za-z0-9]{32}$/);
        expect(env.GOOGLE_CLIENT_SECRET).toBe('');

        const second = generateMissingKeys({ cwd: root, env: {} });
        expect(second.generated).toEqual([]);
        expect(fs.readFileSync(second.targetPath, 'utf8')).toBe(firstText);
    });

    it('uses no prefix when the allowlist configuration prefix is empty', () => {
        const root = makeRoot();
        writeApp(root, 'otta-web', 'BLOG_PREVIEW_SECRET=\n');

        const result = generateMissingKeys({ cwd: root, env: {} });
        const env = readEnv(result.targetPath);

        expect(result.generated).toHaveLength(1);
        expect(env.BLOG_PREVIEW_SECRET).toMatch(/^[A-Za-z0-9]{32}$/);
    });

    it('resolves the target app from env, flags, cwd, and the root default', () => {
        const root = makeRoot();
        const webDir = writeApp(root, 'otta-web', 'AUTH_SECRET=\n');
        const landingDir = writeApp(root, 'otta-landing', 'AUTH_SECRET=\n');

        expect(resolveTargetAppDir({ cwd: root, env: {} })).toBe(webDir);
        expect(resolveTargetAppDir({ cwd: root, env: { OTTABASE_APP: 'otta-landing' } })).toBe(landingDir);
        expect(resolveTargetAppDir({ app: 'otta-landing', cwd: root, env: { OTTABASE_APP: 'otta-web' } })).toBe(
            landingDir,
        );
        expect(resolveTargetAppDir({ cwd: path.join(landingDir, 'src'), env: {} })).toBe(landingDir);
    });
});

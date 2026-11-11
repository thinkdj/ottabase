import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPackageRegistry, definePackage } from '@ottabase/kernel';

vi.mock('../../lib/admin-guard', () => ({ requireAdminAccess: vi.fn() }));
vi.mock('../../../ottabase/config.loader', () => ({ getOttabaseConfig: () => ({ appId: 'web' }) }));
vi.mock('../../../ottabase/registry', () => ({
    packages: createPackageRegistry({
        packages: [
            definePackage({
                key: 'core',
                name: 'Core',
                version: '1.0.0',
                env: {
                    required: [
                        { key: 'OBCF_D1', kind: 'binding' },
                        { key: 'AUTH_SECRET', kind: 'secret' },
                    ],
                    optional: [{ key: 'AUTH_URL', secret: false }],
                },
                health: () => ({ name: 'd1', ok: true }),
            }),
        ],
    }),
}));

import { requireAdminAccess } from '../../lib/admin-guard';
import { handleAdminSetupUrls, handleAdminSystemReadiness } from '../admin-system';

function context(env: Record<string, unknown>) {
    const request = new Request('http://localhost/api/admin/system/readiness');
    return { request, env, url: new URL(request.url) } as never;
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/admin/system/readiness', () => {
    it('is platform-admin only', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(new Response('no', { status: 403 }) as never);
        expect((await handleAdminSystemReadiness(context({}))).status).toBe(403);
        expect(requireAdminAccess).toHaveBeenCalledWith(expect.anything(), { scope: 'system' });
    });

    it('names the missing required key and its package, and never leaks a secret character', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({ user: { id: 'owner' } } as never);
        const response = await handleAdminSystemReadiness(
            context({
                OBCF_D1: { prepare() {} },
                AUTH_SECRET: 'hunter2-hunter2-hunter2',
                AUTH_URL: 'https://app.example.com',
                ENVIRONMENT: 'production',
            }),
        );
        const body = (await response.json()) as {
            ok: boolean;
            settings: Array<{ key: string; set: boolean; preview?: string }>;
            app: { environment: string };
        };
        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(body.ok).toBe(true);
        expect(body.app.environment).toBe('production');
        expect(body.settings.find((s) => s.key === 'AUTH_SECRET')).toEqual(expect.objectContaining({ set: true }));
        expect(body.settings.find((s) => s.key === 'AUTH_SECRET')?.preview).toBeUndefined();
        expect(body.settings.find((s) => s.key === 'AUTH_URL')?.preview).toBe('ht************om');
        expect(JSON.stringify(body)).not.toContain('hunter2');

        const missing = (await (await handleAdminSystemReadiness(context({ OBCF_D1: { prepare() {} } }))).json()) as {
            ok: boolean;
            summary: { missingRequired: number };
            settings: Array<{ key: string; package: string; required: boolean; set: boolean }>;
        };
        expect(missing.ok).toBe(false);
        expect(missing.summary.missingRequired).toBe(1);
        expect(missing.settings.find((s) => !s.set && s.required)).toMatchObject({
            key: 'AUTH_SECRET',
            package: 'core',
        });
    });
});

describe('GET /api/admin/system/setup-urls', () => {
    it('is platform-admin only', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(new Response('no', { status: 403 }) as never);
        expect((await handleAdminSetupUrls(context({}))).status).toBe(403);
        expect(requireAdminAccess).toHaveBeenCalledWith(expect.anything(), { scope: 'system' });
    });

    it('reports AUTH_URL, installed packages and missing key names, never a secret value', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({ user: { id: 'owner' } } as never);
        const response = await handleAdminSetupUrls(
            context({
                AUTH_URL: 'https://app.example.com',
                GOOGLE_CLIENT_ID: 'google-id-value',
                GOOGLE_CLIENT_SECRET: 'google-secret-value',
                GITHUB_CLIENT_ID: 'github-id-value',
            }),
        );
        const body = (await response.json()) as {
            authUrl: string | null;
            packages: string[];
            providers: Array<{ id: string; missing: string[] }>;
        };
        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(body.authUrl).toBe('https://app.example.com');
        expect(body.packages).toEqual(['core']);
        expect(body.providers.find((p) => p.id === 'google')?.missing).toEqual([]);
        expect(body.providers.find((p) => p.id === 'github')?.missing).toEqual(['GITHUB_CLIENT_SECRET']);
        expect(JSON.stringify(body)).not.toMatch(/google-secret-value|google-id-value|github-id-value/);
    });
});

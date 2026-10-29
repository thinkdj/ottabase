import { describe, expect, it } from 'vitest';
import { definePackageClient, installedPackages, packageAdminPages, packageRoutes } from '../client';

const Icon = () => null;
const page = {
    path: '/admin/growth/webhooks',
    title: 'Webhooks',
    description: 'd',
    icon: Icon,
    group: 'growth',
    load: async () => ({ WebhooksPage: () => null }),
    exportName: 'WebhooksPage',
};
const route = {
    path: '/billing',
    load: async () => ({ BillingPage: () => null }),
    exportName: 'BillingPage',
    menu: { title: 'Billing', icon: Icon },
};

describe('definePackageClient', () => {
    it('validates the key and every admin page', () => {
        expect(() => definePackageClient({ key: 'Nope' })).toThrow(/Invalid package key/);
        expect(() => definePackageClient({ key: 'ok', adminPages: [{ ...page, path: '/growth' }] })).toThrow(
            /must start with "\/admin\/"/,
        );
        expect(() => definePackageClient({ key: 'ok', adminPages: [{ ...page, group: '' }] })).toThrow(/nav group/);
        expect(() => definePackageClient({ key: 'ok', adminPages: [{ ...page, exportName: '' }] })).toThrow(
            /load\(\) and exportName/,
        );
        const client = { key: 'ok', adminPages: [page] };
        expect(definePackageClient(client)).toBe(client);
    });

    it('validates every route and its menu link', () => {
        const attempt = (changes: object) => () =>
            definePackageClient({ key: 'ok', routes: [{ ...route, ...changes }] });
        expect(attempt({ path: '/admin/billing' })).toThrow(/outside \/admin/);
        expect(attempt({ path: '/admin' })).toThrow(/outside \/admin/);
        expect(attempt({ path: 'billing' })).toThrow(/lowercase path/);
        expect(attempt({ path: '/Billing' })).toThrow(/lowercase path/);
        expect(attempt({ exportName: ' ' })).toThrow(/load\(\) and exportName/);
        expect(attempt({ menu: { title: '', icon: Icon } })).toThrow(/a title and an icon/);
        expect(attempt({ menu: { title: 'Billing' } })).toThrow(/a title and an icon/);
        expect(attempt({ menu: undefined, access: 'public' })).not.toThrow();
    });

    it('derives the installed map and the flat page lists', () => {
        const clients = [
            definePackageClient({ key: 'webhooks', adminPages: [page] }),
            definePackageClient({ key: 'payport', routes: [route] }),
            definePackageClient({ key: 'notes' }),
        ];
        expect(installedPackages(clients)).toEqual({ webhooks: true, payport: true, notes: true });
        expect(packageAdminPages(clients)).toEqual([{ ...page, pkg: 'webhooks' }]);
        expect(packageRoutes(clients)).toEqual([{ ...route, pkg: 'payport' }]);
    });

    it('refuses two packages routing the same path', () => {
        const clients = [
            definePackageClient({ key: 'payport', routes: [route] }),
            definePackageClient({ key: 'stripe', routes: [{ ...route, menu: undefined }] }),
        ];
        expect(() => packageRoutes(clients)).toThrow('"payport" and "stripe" both route /billing.');
    });
});

describe('packageNotices', () => {
    it('namespaces every notice by its package key and rejects bad codes', async () => {
        const { packageNotices } = await import('../client');
        const payport = definePackageClient({
            key: 'payport',
            notices: { 'checkout-complete': { type: 'success', message: 'Paid.' } },
        });
        expect(packageNotices([payport])).toEqual({
            'payport.checkout-complete': { type: 'success', message: 'Paid.' },
        });
        expect(() => definePackageClient({ key: 'x1', notices: { BadCode: { type: 'info', message: 'x' } } })).toThrow(
            /kebab-case/,
        );
    });
});

describe('readDeploymentVersion', () => {
    it('reads the version metadata binding and returns null when it is unbound or empty', async () => {
        const { readDeploymentVersion } = await import('../version');
        expect(readDeploymentVersion({ id: 'v-1', tag: 'abc1234', timestamp: '2026-10-29T10:00:00Z' })).toEqual({
            id: 'v-1',
            tag: 'abc1234',
            createdAt: '2026-10-29T10:00:00Z',
        });
        expect(readDeploymentVersion({ id: 'v-2', tag: '', timestamp: '' })).toEqual({
            id: 'v-2',
            tag: null,
            createdAt: null,
        });
        expect(readDeploymentVersion(undefined)).toBeNull();
        expect(readDeploymentVersion({ id: '' })).toBeNull();
    });
});

describe('notice hand-off', () => {
    it('claims from the URL first, else the notice parked for this path, once', async () => {
        const { claimNotice, parkNotice } = await import('../client');
        const sso = (code: string) => code.startsWith('sso.');
        expect(claimNotice(sso, { pathname: '/sso', search: '?notice=sso.denied' })).toBe('sso.denied');
        expect(claimNotice(sso, { pathname: '/sso', search: '?notice=other' })).toBeNull();
        parkNotice('sso.state', '/sso');
        expect(claimNotice(sso, { pathname: '/elsewhere', search: '' })).toBeNull();
        expect(claimNotice(sso, { pathname: '/sso', search: '' })).toBe('sso.state');
        expect(claimNotice(sso, { pathname: '/sso', search: '' })).toBeNull();
    });
});

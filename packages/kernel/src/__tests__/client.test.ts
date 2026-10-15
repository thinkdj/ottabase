import { describe, expect, it } from 'vitest';
import { definePackageClient, installedPackages, packageAdminPages } from '../client';

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

    it('derives the installed map and the flat page list', () => {
        const clients = [
            definePackageClient({ key: 'webhooks', adminPages: [page] }),
            definePackageClient({ key: 'notes' }),
        ];
        expect(installedPackages(clients)).toEqual({ webhooks: true, notes: true });
        expect(packageAdminPages(clients)).toEqual([{ ...page, pkg: 'webhooks' }]);
    });
});

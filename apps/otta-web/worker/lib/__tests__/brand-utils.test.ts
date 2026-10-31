import { beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.hoisted(() => vi.fn());
vi.mock('../../../ottabase/files', () => ({
    files: { put, remove: vi.fn(), url: (_env: unknown, key: string) => `https://files.test/${key}` },
}));
vi.mock('../../../ottabase/config.loader', () => ({ getOttabaseConfig: () => ({ appId: 'otta-web' }) }));

import { brandAssets } from '../brand-utils';

describe('brandAssets', () => {
    beforeEach(() => put.mockReset());

    it('stores logos as the app’s files, not the uploading admin’s, recording who uploaded them', async () => {
        put.mockResolvedValue({ storageKey: 'otta-web/brand-asset/abc.svg' });
        const file = new File(['<svg/>'], 'logo.svg');
        const key = await brandAssets({} as CloudflareEnv, 'admin-1').upload(file, 'logo');
        expect(key).toBe('otta-web/brand-asset/abc.svg');
        // userId null: an account erasure of the admin (files.removeOwned) never takes the live logo.
        expect(put).toHaveBeenCalledWith(expect.anything(), {
            purpose: 'brand-asset',
            owner: { appId: 'otta-web', userId: null, organizationId: null },
            file,
            metadata: { uploadedBy: 'admin-1', logoType: 'logo' },
        });
    });
});

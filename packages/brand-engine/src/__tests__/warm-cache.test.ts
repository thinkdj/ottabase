import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateBrandCache, mockInvalidate, mockResolveFullBrandConfig } = vi.hoisted(() => ({
    mockCreateBrandCache: vi.fn(),
    mockInvalidate: vi.fn(),
    mockResolveFullBrandConfig: vi.fn(),
}));

vi.mock('../persistence/cache', () => ({
    createBrandCache: mockCreateBrandCache,
}));
vi.mock('../persistence/resolveBrandConfig', () => ({
    resolveFullBrandConfig: mockResolveFullBrandConfig,
}));

import { warmBrandCache } from '../handlers/warm-cache';

const ENV = { OBCF_D1: {} as any, OBCF_KV: {} as any, OBCF_R2: {} as any };

describe('warmBrandCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateBrandCache.mockReturnValue({ invalidate: mockInvalidate });
        mockResolveFullBrandConfig.mockResolvedValue({ brandKitsMap: {}, routeMappings: [], layoutTemplatesMap: {} });
    });

    it('invalidates first, then force-resolves (skipCacheRead) for the requesting app on a kit edit', async () => {
        await warmBrandCache(ENV, { kitId: 'kit-1', appId: 'tenant-a', requestAppId: 'tenant-b' });

        expect(mockInvalidate).toHaveBeenCalledWith({ kitId: 'kit-1', appId: 'tenant-a', requestAppId: 'tenant-b' });
        expect(mockResolveFullBrandConfig).toHaveBeenCalledWith(ENV, { appId: 'tenant-b', skipCacheRead: true });
        // invalidate must resolve before the re-warm resolve runs
        expect(mockInvalidate.mock.invocationCallOrder[0]).toBeLessThan(
            mockResolveFullBrandConfig.mock.invocationCallOrder[0],
        );
    });

    it('falls back to the kit target appId when no requestAppId is given', async () => {
        await warmBrandCache(ENV, { kitId: 'kit-1', appId: 'tenant-a' });

        expect(mockResolveFullBrandConfig).toHaveBeenCalledWith(ENV, { appId: 'tenant-a', skipCacheRead: true });
    });

    it('re-warms the target appId directly for a full-app invalidation', async () => {
        await warmBrandCache(ENV, { appId: 'tenant-c' });

        expect(mockInvalidate).toHaveBeenCalledWith({ appId: 'tenant-c' });
        expect(mockResolveFullBrandConfig).toHaveBeenCalledWith(ENV, { appId: 'tenant-c', skipCacheRead: true });
    });
});

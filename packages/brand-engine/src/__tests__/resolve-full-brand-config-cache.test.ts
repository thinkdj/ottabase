import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockCreateBrandCache,
    mockGetResolutionData,
    mockSetResolutionData,
    mockGetLayoutData,
    mockGetMenuSlotData,
    mockBrandKitFind,
    mockBrandKitToTheme,
    mockBrandKitLogos,
} = vi.hoisted(() => ({
    mockCreateBrandCache: vi.fn(),
    mockGetResolutionData: vi.fn(),
    mockSetResolutionData: vi.fn(),
    mockGetLayoutData: vi.fn(),
    mockGetMenuSlotData: vi.fn(),
    mockBrandKitFind: vi.fn(),
    mockBrandKitToTheme: vi.fn(),
    mockBrandKitLogos: vi.fn(),
}));

vi.mock('../persistence/cache', () => ({
    createBrandCache: mockCreateBrandCache,
}));
vi.mock('../persistence/layoutData', () => ({
    getLayoutData: mockGetLayoutData,
}));
vi.mock('../persistence/menuSlotData', () => ({
    getMenuSlotData: mockGetMenuSlotData,
}));
vi.mock('../persistence/BrandKit.model', () => ({
    BrandKit: { find: mockBrandKitFind },
}));
vi.mock('../persistence/brandKitToConfig', () => ({
    brandKitToTheme: mockBrandKitToTheme,
    brandKitLogos: mockBrandKitLogos,
}));

import { resolveFullBrandConfig } from '../persistence/resolveBrandConfig';

const ENV = { OBCF_D1: {} as any, OBCF_KV: {} as any, OBCF_R2: {} as any };

describe('resolveFullBrandConfig — cache read/write semantics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateBrandCache.mockReturnValue({
            getResolutionData: mockGetResolutionData,
            setResolutionData: mockSetResolutionData,
        });
        mockGetLayoutData.mockResolvedValue({
            routeMappings: [{ pathPattern: '/**', layoutTemplateId: 'app-shell', brandKitId: 'default', priority: 0 }],
            layoutTemplatesMap: {},
        });
        mockGetMenuSlotData.mockResolvedValue({});
        mockBrandKitFind.mockResolvedValue({ get: (key: string) => (key === 'id' ? 'default' : undefined) });
        mockBrandKitToTheme.mockResolvedValue({ colors: { primary: '#111111' } });
        mockBrandKitLogos.mockReturnValue({});
    });

    it('on a normal cache miss (skipCacheRead unset), reads then writes the fresh result', async () => {
        mockGetResolutionData.mockResolvedValue(null);

        await resolveFullBrandConfig(ENV, { appId: 'otta-web' });

        expect(mockGetResolutionData).toHaveBeenCalledWith('otta-web', 'all');
        expect(mockSetResolutionData).toHaveBeenCalledTimes(1);
    });

    it('on a cache hit (skipCacheRead unset), reads and returns without writing', async () => {
        mockGetResolutionData.mockResolvedValue({
            routeMappings: [],
            layoutTemplatesMap: {},
            menuSlots: {},
            brandKitsMap: { default: {} },
        });

        await resolveFullBrandConfig(ENV, { appId: 'otta-web' });

        expect(mockSetResolutionData).not.toHaveBeenCalled();
        expect(mockGetLayoutData).not.toHaveBeenCalled();
    });

    it('with skipCacheRead: true, skips the read but still writes the freshly loaded result (the warm-cache bug)', async () => {
        await resolveFullBrandConfig(ENV, { appId: 'otta-web', skipCacheRead: true });

        expect(mockGetResolutionData).not.toHaveBeenCalled();
        expect(mockGetLayoutData).toHaveBeenCalledWith('otta-web');
        expect(mockSetResolutionData).toHaveBeenCalledTimes(1);
        expect(mockSetResolutionData).toHaveBeenCalledWith(
            'otta-web',
            'all',
            expect.objectContaining({ brandKitsMap: expect.objectContaining({ default: expect.any(Object) }) }),
        );
    });
});

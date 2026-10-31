import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../handlers/warm-cache', () => ({ warmBrandCache: vi.fn(async () => undefined) }));
vi.mock('../handlers/audit-helper', () => ({ logBrandAudit: vi.fn(async () => undefined) }));

import { handleDeleteBrandKit, handleUploadBrandKitLogo } from '../handlers/brand-kit-api';
import { BrandKit } from '../persistence/BrandKit.model';

const ENV = { OBCF_D1: {} as never, OBCF_KV: {} as never, R2_PUBLIC_URL: 'https://files.test' };

function kit(values: Record<string, unknown>) {
    const data = { id: 'kit-1', appId: 'app', ...values };
    return {
        get: (key: string) => data[key as keyof typeof data] ?? null,
        set: vi.fn((key: string, value: unknown) => void Object.assign(data, { [key]: value })),
        save: vi.fn(async () => undefined),
        destroy: vi.fn(async () => true),
        assetKeys: () => BrandKit.prototype.assetKeys.call({ get: (key: string) => data[key as keyof typeof data] }),
    };
}

function upload(file: File | null) {
    const form = new FormData();
    if (file) form.append('file', file);
    return new Request('https://app.test/api/brand/kits/kit-1/logo/logo', { method: 'POST', body: form });
}

describe('brand kit logos go through the host asset client', () => {
    const assets = {
        upload: vi.fn(),
        remove: vi.fn(async () => undefined),
        url: (key: string) => `https://files.test/${key}`,
    };

    beforeEach(() => {
        vi.restoreAllMocks();
        assets.upload.mockReset();
        assets.remove.mockClear();
    });

    it('stores the key, answers its URL, and deletes the previous logo no other kit uses', async () => {
        const record = kit({ logoKey: 'app/brand-asset/old.png' });
        vi.spyOn(BrandKit, 'find').mockResolvedValue(record as never);
        vi.spyOn(BrandKit, 'count').mockResolvedValue(0);
        assets.upload.mockResolvedValue('app/brand-asset/new.svg');

        const res = await handleUploadBrandKitLogo(
            upload(new File(['<svg/>'], 'l.svg')),
            ENV,
            'kit-1',
            'app',
            'logo',
            assets,
        );
        expect(await res.json()).toEqual({
            key: 'app/brand-asset/new.svg',
            url: 'https://files.test/app/brand-asset/new.svg',
        });
        expect(record.set).toHaveBeenCalledWith('logoKey', 'app/brand-asset/new.svg');
        expect(assets.remove).toHaveBeenCalledWith('app/brand-asset/old.png');
    });

    it('keeps a previous logo a cloned kit still points at', async () => {
        vi.spyOn(BrandKit, 'find').mockResolvedValue(kit({ iconKey: 'app/brand-asset/shared.png' }) as never);
        vi.spyOn(BrandKit, 'count').mockResolvedValue(1);
        assets.upload.mockResolvedValue('app/brand-asset/new.png');
        await handleUploadBrandKitLogo(upload(new File(['x'], 'i.png')), ENV, 'kit-1', 'app', 'icon', assets);
        expect(assets.remove).not.toHaveBeenCalled();
    });

    it('passes a refusal from the files service through, and changes nothing', async () => {
        const record = kit({});
        vi.spyOn(BrandKit, 'find').mockResolvedValue(record as never);
        assets.upload.mockResolvedValue(new Response(null, { status: 415 }));
        const res = await handleUploadBrandKitLogo(
            upload(new File(['x'], 'x.exe')),
            ENV,
            'kit-1',
            'app',
            'logo',
            assets,
        );
        expect(res.status).toBe(415);
        expect(record.save).not.toHaveBeenCalled();
    });

    it('deletes a kit and the logos only it used', async () => {
        const record = kit({ logoKey: 'app/brand-asset/a.png', iconKey: 'app/brand-asset/b.png' });
        vi.spyOn(BrandKit, 'find').mockResolvedValue(record as never);
        vi.spyOn(BrandKit, 'where').mockResolvedValue([]);
        vi.spyOn(BrandKit, 'count').mockImplementation(async (where) =>
            Object.values(where ?? {}).includes('app/brand-asset/b.png') ? 1 : 0,
        );
        const res = await handleDeleteBrandKit(new Request('https://app.test'), ENV, 'kit-1', 'app', assets);
        expect(res.status).toBe(200);
        expect(assets.remove.mock.calls).toEqual([['app/brand-asset/a.png']]);
    });
});

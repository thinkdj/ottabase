import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/admin-guard', () => ({ requireAdminAccess: vi.fn() }));
vi.mock('@ottabase/shortlinks', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ottabase/shortlinks')>()),
    Shortlink: { paginate: vi.fn(), searchPaginate: vi.fn(), findByCode: vi.fn(), create: vi.fn() },
}));

import { Shortlink } from '@ottabase/shortlinks';
import { requireAdminAccess } from '../../lib/admin-guard';
import { handleShortlinksCreate, handleShortlinksList } from '../shortlinks';

const page = { data: [{ toJson: () => ({ id: 'l1' }) }], total: 1, page: 1, perPage: 15 };

function ctx(url: string, body?: unknown) {
    const request = new Request(url, {
        method: body ? 'POST' : 'GET',
        headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { request, env: { OBCF_D1: {} }, url: new URL(url) } as any;
}

describe('shortlink routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminAccess).mockResolvedValue({ user: { id: 'admin' } } as any);
    });

    it('searches code and destination when asked', async () => {
        vi.mocked(Shortlink.searchPaginate).mockResolvedValue(page as any);
        const res = await handleShortlinksList(ctx('http://x/api/shortlinks?search=git&page=2'));
        expect(res.status).toBe(200);
        expect(Shortlink.searchPaginate).toHaveBeenCalledWith(
            'git',
            ['shortCode', 'fullUrl'],
            2,
            15,
            undefined,
            expect.any(Object),
        );
        expect(Shortlink.paginate).not.toHaveBeenCalled();
    });

    it('pages without searching otherwise', async () => {
        vi.mocked(Shortlink.paginate).mockResolvedValue(page as any);
        await handleShortlinksList(ctx('http://x/api/shortlinks'));
        expect(Shortlink.paginate).toHaveBeenCalledWith(1, 15, undefined, expect.any(Object));
    });

    it('makes a readable code when none is given', async () => {
        vi.mocked(Shortlink.findByCode).mockResolvedValue(null);
        vi.mocked(Shortlink.create).mockResolvedValue({ toJson: () => ({ id: 'l1' }) } as any);
        const res = await handleShortlinksCreate(ctx('http://x/api/shortlinks', { fullUrl: 'https://example.com' }));
        expect(res.status).toBe(200);
        expect(Shortlink.create).toHaveBeenCalledWith(
            expect.objectContaining({
                fullUrl: 'https://example.com',
                shortCode: expect.stringMatching(/^[a-z0-9]{6}$/),
            }),
        );
    });

    it('refuses a code somebody already holds', async () => {
        vi.mocked(Shortlink.findByCode).mockResolvedValue({} as any);
        const res = await handleShortlinksCreate(
            ctx('http://x/api/shortlinks', { fullUrl: 'https://example.com', shortCode: 'gh' }),
        );
        expect(res.status).toBe(409);
        expect(Shortlink.create).not.toHaveBeenCalled();
    });
});

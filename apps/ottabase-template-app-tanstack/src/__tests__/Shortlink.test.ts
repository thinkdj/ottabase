import { Shortlink } from '@ottabase/shortlinks';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Shortlink Model', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should define valid fields', () => {
        expect(Shortlink.entity).toBe('shortlinks');
        expect(Shortlink.primaryKey).toBe('id');
    });

    it('should create a shortlink instance', async () => {
        vi.spyOn(Shortlink, 'create').mockResolvedValue(
            new Shortlink({
                entity: Shortlink.entity,
                data: {
                    id: '123',
                    fullUrl: 'https://example.com',
                    shortCode: 'ex',
                    type: 'redirect',
                    appId: 'test',
                    expiryDate: null,
                    clicks: 0,
                    lastClickedAt: null,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                },
            } as any),
        );

        const link = await Shortlink.create({
            fullUrl: 'https://example.com',
            shortCode: 'ex',
            type: 'redirect',
            appId: 'test',
        });

        expect(link).toBeDefined();
        expect(link.get('fullUrl')).toBe('https://example.com');
    });

    it('should find by code', async () => {
        vi.spyOn(Shortlink, 'findByCode').mockResolvedValue(
            new Shortlink({
                entity: Shortlink.entity,
                data: {
                    id: '123',
                    fullUrl: 'https://github.com',
                    shortCode: 'gh',
                    type: 'redirect',
                    appId: 'test',
                    expiryDate: null,
                    clicks: 0,
                    lastClickedAt: null,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                },
            } as any),
        );

        const link = await Shortlink.findByCode('gh');
        expect(link).not.toBeNull();
        expect(link?.get('shortCode')).toBe('gh');
    });

    it('should check expiration', () => {
        const link = new Shortlink({
            entity: Shortlink.entity,
            data: {
                expiryDate: Date.now() - 1000,
            },
        } as any);
        expect(link.isExpired()).toBe(true);

        const futureLink = new Shortlink({
            entity: Shortlink.entity,
            data: {
                expiryDate: Date.now() + 10000,
            },
        } as any);
        expect(futureLink.isExpired()).toBe(false);
    });
});

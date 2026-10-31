import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureOttaORM } from '../../runtime-config';
import { Media, mediaFileStore } from '../Media';
import { mediaTable } from '../Media.schema';
import { User } from '../User';

describe('media table', () => {
    it('has the final shape: no stored URLs, no provider, no soft delete, a unique key', () => {
        const columns = getTableConfig(mediaTable).columns.map((column) => column.name);
        for (const gone of ['provider', 'url', 'thumbnail_url', 'preview_url', 'is_public', 'deleted_at']) {
            expect(columns).not.toContain(gone);
        }
        for (const kept of ['purpose', 'audience', 'storage_key', 'variants', 'status'])
            expect(columns).toContain(kept);
        expect(getTableConfig(mediaTable).columns.find((c) => c.name === 'storage_key')?.isUnique).toBe(true);
    });

    it('lets a person change only the describing text', () => {
        expect((Media as unknown as { writable: { create: string[]; update: string[] } }).writable).toEqual({
            create: [],
            update: ['title', 'altText', 'caption'],
        });
    });
});

describe('mediaFileStore.usedBytes', () => {
    afterEach(() => vi.restoreAllMocks());

    it('sums the organization, or the user outside any organization', async () => {
        const sums = vi.spyOn(Media, 'sums').mockResolvedValue({ fileSize: 42 });
        expect(await mediaFileStore.usedBytes({ appId: 'app', userId: 'u1', organizationId: 'o1' })).toBe(42);
        expect(sums).toHaveBeenLastCalledWith(['fileSize'], { appId: 'app', organizationId: 'o1' });
        await mediaFileStore.usedBytes({ appId: 'app', userId: 'u1', organizationId: null });
        expect(sums).toHaveBeenLastCalledWith(['fileSize'], { appId: 'app', organizationId: null, userId: 'u1' });
    });
});

describe('User.imageUrl', () => {
    afterEach(() => configureOttaORM({}));

    it('prefers the uploaded avatar, on the configured public files URL, then the provider picture', () => {
        expect(User.imageUrl({ avatarKey: 'app/avatar/abc/thumb.webp', image: 'https://lh3.test/me.png' })).toBe(
            '/api/files/public/app/avatar/abc/thumb.webp',
        );
        configureOttaORM({ filesPublicUrl: 'https://files.example.com/' });
        expect(User.imageUrl({ avatarKey: 'app/avatar/abc.png' })).toBe('https://files.example.com/app/avatar/abc.png');
        expect(User.imageUrl({ avatarKey: null, image: 'https://lh3.test/me.png' })).toBe('https://lh3.test/me.png');
        expect(User.imageUrl({})).toBeNull();
    });
});

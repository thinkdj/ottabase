import { describe, expect, it, vi } from 'vitest';
import { normalizeSlugInput, prepareCreateSlug, prepareUpdateSlug, resolveUniqueSlug } from '../slug-utils';

describe('slug-utils', () => {
    describe('normalizeSlugInput', () => {
        it('should generate slug from a valid string', () => {
            expect(normalizeSlugInput('Hello World', 'fallback', 'tag')).toBe('hello-world');
        });

        it('should use fallback when value is empty', () => {
            expect(normalizeSlugInput('', 'My Fallback', 'tag')).toBe('my-fallback');
        });

        it('should use fallback when value is null/undefined', () => {
            expect(normalizeSlugInput(null, 'fallback-name', 'cat')).toBe('fallback-name');
            expect(normalizeSlugInput(undefined, 'fallback-name', 'cat')).toBe('fallback-name');
        });

        it('should use prefix + UUID when both value and fallback are empty', () => {
            const result = normalizeSlugInput('', '', 'series');
            expect(result).toMatch(/^series-[a-f0-9]{8}$/);
        });

        it('should handle special characters', () => {
            expect(normalizeSlugInput('Hello!@#$World', 'fb', 'tag')).toBe('helloworld');
        });

        it('should coerce non-string values', () => {
            expect(normalizeSlugInput(42, 'fb', 'tag')).toBe('42');
        });

        it('should trim and normalize whitespace', () => {
            expect(normalizeSlugInput('  multiple   spaces  ', 'fb', 'tag')).toBe('multiple-spaces');
        });
    });

    describe('per-blog slug uniqueness', () => {
        /** A model whose `first` reports the given slugs as taken in the probed scope. */
        const modelWith = (taken: string[]) =>
            ({
                first: vi.fn(async (where: { slug: string }) =>
                    taken.includes(where.slug) ? { get: () => 'other-id' } : null,
                ),
            }) as any;

        it('probes one blog only, so two blogs may share a slug', async () => {
            const Model = modelWith(['life']);

            const slug = await resolveUniqueSlug(Model, 'life', {
                appId: 'app',
                organizationId: 'org-1',
                type: 'post',
            });

            expect(slug).toBe('life-1');
            expect(Model.first).toHaveBeenCalledWith(
                { appId: 'app', organizationId: 'org-1', type: 'post', slug: 'life' },
                undefined,
            );
        });

        it('creates in the row blog: the site blog when no organization is set', async () => {
            const Model = modelWith([]);
            const data: Record<string, unknown> = { appId: 'app', name: 'Life' };

            await prepareCreateSlug(Model, data, {
                slugPrefix: 'category',
                nameField: 'name',
                hasType: true,
                entityLabel: 'categories',
            });

            expect(data).toMatchObject({ slug: 'life', type: 'post' });
            expect(Model.first).toHaveBeenCalledWith(
                { appId: 'app', organizationId: null, type: 'post', slug: 'life' },
                undefined,
            );
        });

        it("keeps an update in the stored row's blog", async () => {
            const Model = modelWith([]);
            const data: Record<string, unknown> = { slug: 'Trips' };

            await prepareUpdateSlug(
                Model,
                's1',
                data,
                { slugPrefix: 'series', nameField: 'title', hasType: false, entityLabel: 'series' },
                undefined,
                { id: 's1', appId: 'app', organizationId: 'org-1', slug: 'old', title: 'Old' },
            );

            expect(data.slug).toBe('trips');
            expect(Model.first).toHaveBeenCalledWith(
                { appId: 'app', organizationId: 'org-1', slug: 'trips' },
                undefined,
            );
        });
    });
});

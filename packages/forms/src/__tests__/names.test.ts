import { describe, expect, it } from 'vitest';
import { entityNames, humanize, pluralize, singularize } from '../utils/names';

describe('names', () => {
    it('humanizes keys for people', () => {
        expect(humanize('post_tags')).toBe('Post tags');
        expect(humanize('createdAt')).toBe('Created at');
        expect(humanize('slug')).toBe('Slug');
    });

    it('moves between singular and plural', () => {
        expect(singularize('categories')).toBe('category');
        expect(singularize('post_tags')).toBe('post_tag');
        expect(singularize('addresses')).toBe('address');
        expect(pluralize('Category')).toBe('Categories');
        expect(pluralize('Tag')).toBe('Tags');
        expect(pluralize('Address')).toBe('Addresses');
    });

    it('derives display names from the entity unless the config names itself', () => {
        expect(entityNames({ entity: 'post_tags' })).toEqual({ singular: 'Post tag', plural: 'Post tags' });
        expect(entityNames({ entity: 'post_tags', displayName: 'Tag' })).toEqual({ singular: 'Tag', plural: 'Tags' });
        expect(entityNames({ entity: 'post_series', displayName: 'Series', displayNamePlural: 'Series' })).toEqual({
            singular: 'Series',
            plural: 'Series',
        });
    });
});

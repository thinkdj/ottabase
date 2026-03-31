import { describe, expect, it } from 'vitest';
import { mergeHomepageConfigFromApi } from '../lib/merge-homepage-config';

describe('mergeHomepageConfigFromApi', () => {
    it('returns defaults when variant map is null', () => {
        const merged = mergeHomepageConfigFromApi(null);
        expect(merged.hero).toBeDefined();
        expect(merged.navbar).toBeDefined();
    });

    it('merges variant keys from API', () => {
        const merged = mergeHomepageConfigFromApi({ hero: 'split', features: 'cards' });
        expect(merged.hero).toBe('split');
        expect(merged.features).toBe('cards');
    });
});

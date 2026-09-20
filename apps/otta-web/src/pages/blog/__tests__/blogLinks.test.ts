import { describe, expect, it } from 'vitest';
import { localizedPostPath, localizedPostSearch } from '../blogLinks';

describe('blog links', () => {
    it('builds a canonical-slug language URL', () => {
        expect(localizedPostPath('dry-season-idris', 'ml')).toBe('/blog/dry-season-idris?lang=ml');
    });

    it('preserves the selected language for canonical and translated cards', () => {
        expect(localizedPostSearch({ language: 'en' }, 'ml')).toEqual({ lang: 'ml' });
        expect(localizedPostSearch({ language: 'ml', translationId: 'translation-1' }, 'en')).toEqual({ lang: 'ml' });
    });
});

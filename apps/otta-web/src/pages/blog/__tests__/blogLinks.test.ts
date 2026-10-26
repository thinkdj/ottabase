import { describe, expect, it } from 'vitest';
import { localizedPostSearch } from '../blogLinks';

describe('blog links', () => {
    it('preserves the selected language for canonical and translated cards', () => {
        expect(localizedPostSearch({ language: 'en' }, 'ml')).toEqual({ lang: 'ml' });
        expect(localizedPostSearch({ language: 'ml', translationId: 'translation-1' }, 'en')).toEqual({ lang: 'ml' });
    });
});

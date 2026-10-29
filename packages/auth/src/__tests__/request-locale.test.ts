import { describe, expect, it } from 'vitest';
import { pickLocaleFromAcceptLanguage, requestLocaleDefaults } from '../request-locale';

describe('request locale defaults', () => {
    it('picks the best Accept-Language tag by quality, restricted to shipped languages', () => {
        expect(pickLocaleFromAcceptLanguage('fr-CA;q=0.6, en-gb;q=0.9, de')).toBe('de');
        expect(pickLocaleFromAcceptLanguage('fr-CA;q=0.6, en-gb;q=0.9, de', ['en', 'fr'])).toBe('en-GB');
        expect(pickLocaleFromAcceptLanguage('zz-ZZ, *', ['en'])).toBeNull();
        expect(pickLocaleFromAcceptLanguage(null)).toBeNull();
    });

    it('reads the Cloudflare timezone and ignores an invalid one', () => {
        const good = new Request('http://x', { headers: { 'accept-language': 'en-IN' } });
        (good as Request & { cf?: unknown }).cf = { timezone: 'Asia/Kolkata' };
        expect(requestLocaleDefaults(good)).toEqual({ timezone: 'Asia/Kolkata', locale: 'en-IN' });

        const bad = new Request('http://x');
        (bad as Request & { cf?: unknown }).cf = { timezone: 'Mars/Olympus' };
        expect(requestLocaleDefaults(bad)).toEqual({ timezone: null, locale: null });
    });
});

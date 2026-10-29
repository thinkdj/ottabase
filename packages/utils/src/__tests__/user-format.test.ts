import { afterEach, describe, expect, it } from 'vitest';
import {
    canonicalLocale,
    canonicalTimezone,
    formatDateForUser,
    formatNumberForUser,
    getUserLocale,
    isValidLocale,
    setLocaleConfig,
    setTimezoneConfig,
} from '../timezone';

describe('user locale + timezone formatting', () => {
    afterEach(() => {
        setLocaleConfig({ userLocale: null });
        setTimezoneConfig({ userTimezone: undefined });
    });

    it('validates and canonicalises locales and zones', () => {
        expect(isValidLocale('en-us')).toBe(true);
        expect(canonicalLocale('en-us')).toBe('en-US');
        expect(isValidLocale('not a locale')).toBe(false);
        expect(canonicalTimezone('Asia/Kolkata')).toBe('Asia/Kolkata');
        expect(canonicalTimezone('Asia/Mumbai')).toBeNull();
    });

    it('formats with the configured user locale and timezone', () => {
        setLocaleConfig({ userLocale: 'de-DE' });
        setTimezoneConfig({ userTimezone: 'Asia/Kolkata' });
        expect(getUserLocale()).toBe('de-DE');
        // 2025-02-10T12:04:00Z is 17:34 in Kolkata
        const out = formatDateForUser('2025-02-10T12:04:00Z');
        expect(out).toContain('10.02.2025');
        expect(out).toContain('17:34');
        expect(formatDateForUser('2025-02-10T12:04:00Z', 'date')).toBe('10.02.2025');
        expect(formatNumberForUser(1234.5)).toBe('1.234,5');
    });

    it('never renders an invalid date', () => {
        expect(formatDateForUser('nope')).toBe('');
        expect(formatDateForUser(null)).toBe('');
    });
});

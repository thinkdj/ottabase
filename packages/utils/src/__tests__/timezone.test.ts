import { describe, it, expect, beforeEach } from 'vitest';
import {
    getCommonTimezones,
    getTimezonesForSelect,
    isValidTimezone,
    getTimezoneOffsetMinutes,
    setTimezoneConfig,
    getTimezoneConfig,
} from '../timezone';

describe('Timezone Utilities', () => {
    beforeEach(() => {
        setTimezoneConfig({ defaultTimezone: 'UTC', userTimezone: undefined });
    });

    describe('getCommonTimezones', () => {
        it('should return array of timezone objects with name, offset, label', () => {
            const tzs = getCommonTimezones();
            expect(Array.isArray(tzs)).toBe(true);
            expect(tzs.length).toBeGreaterThan(20);
            tzs.forEach((tz) => {
                expect(tz).toHaveProperty('name');
                expect(tz).toHaveProperty('offset');
                expect(tz).toHaveProperty('label');
                expect(typeof tz.name).toBe('string');
                expect(typeof tz.offset).toBe('number');
                expect(typeof tz.label).toBe('string');
            });
        });

        it('should include UTC and major regions', () => {
            const tzs = getCommonTimezones();
            const names = tzs.map((t) => t.name);
            expect(names).toContain('UTC');
            expect(names).toContain('America/New_York');
            expect(names).toContain('Europe/London');
            expect(names).toContain('Asia/Tokyo');
            expect(names).toContain('Australia/Sydney');
        });

        it('should have labels with offset format', () => {
            const tzs = getCommonTimezones();
            const utc = tzs.find((t) => t.name === 'UTC');
            expect(utc).toBeDefined();
            expect(utc!.label).toMatch(/UTC[+-]\d{2}:\d{2}/);
        });
    });

    describe('getTimezonesForSelect', () => {
        it('should return array of timezone objects', () => {
            const tzs = getTimezonesForSelect();
            expect(Array.isArray(tzs)).toBe(true);
            expect(tzs.length).toBeGreaterThan(0);
            tzs.forEach((tz) => {
                expect(tz).toHaveProperty('name');
                expect(tz).toHaveProperty('offset');
                expect(tz).toHaveProperty('label');
            });
        });

        it('should put preferredTimezone first when provided and in list', () => {
            const tzs = getTimezonesForSelect({ preferredTimezone: 'Asia/Tokyo' });
            const first = tzs[0];
            expect(first?.name).toBe('Asia/Tokyo');
        });

        it('should return unchanged list when preferredTimezone not in list', () => {
            const without = getTimezonesForSelect();
            const withInvalid = getTimezonesForSelect({ preferredTimezone: 'Invalid/Zone' });
            expect(withInvalid.length).toBe(without.length);
            expect(withInvalid[0]?.name).toBe(without[0]?.name);
        });

        it('should handle empty preferredTimezone', () => {
            const tzs = getTimezonesForSelect({ preferredTimezone: '' });
            expect(tzs.length).toBeGreaterThan(0);
        });
    });

    describe('isValidTimezone', () => {
        it('should return true for valid IANA timezones', () => {
            expect(isValidTimezone('America/New_York')).toBe(true);
            expect(isValidTimezone('UTC')).toBe(true);
            expect(isValidTimezone('Europe/London')).toBe(true);
            expect(isValidTimezone('Asia/Tokyo')).toBe(true);
        });

        it('should return false for invalid timezones', () => {
            expect(isValidTimezone('Invalid/Zone')).toBe(false);
            expect(isValidTimezone('')).toBe(false);
        });
    });

    describe('getTimezoneOffsetMinutes', () => {
        it('should return offset for valid timezone', () => {
            const utc = getTimezoneOffsetMinutes('UTC');
            expect(utc).toBe(0);
        });

        it('should return non-zero for non-UTC timezones', () => {
            const ny = getTimezoneOffsetMinutes('America/New_York');
            expect(ny).not.toBe(0);
        });
    });

    describe('setTimezoneConfig / getTimezoneConfig', () => {
        it('should set and retrieve config', () => {
            setTimezoneConfig({ userTimezone: 'America/Los_Angeles' });
            const config = getTimezoneConfig();
            expect(config.userTimezone).toBe('America/Los_Angeles');
        });

        it('should merge partial config', () => {
            setTimezoneConfig({ defaultTimezone: 'UTC', userTimezone: 'Europe/Paris' });
            setTimezoneConfig({ userTimezone: 'Asia/Tokyo' });
            const config = getTimezoneConfig();
            expect(config.defaultTimezone).toBe('UTC');
            expect(config.userTimezone).toBe('Asia/Tokyo');
        });
    });
});

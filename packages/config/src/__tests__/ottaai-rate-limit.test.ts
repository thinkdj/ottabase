// ============================================================
// AI rate-limit dials, the config path and the env path must agree.
// ============================================================
// The bug this file exists for: `defineOttabaseConfig` clamped negative limits to
// the default, while `resolveConfigWithEnv` passed `parseInt` output straight
// through. A negative limit then reads downstream as "dimension disabled", so
// `OTTAAI_RATE_LIMIT_PER_APP=-1` silently removed the only aggregate ceiling on
// operator spend, through the one path an operator is most likely to reach for
// in a hurry.
// ============================================================

import { describe, expect, it } from 'vitest';
import { defineOttabaseConfig } from '../defineOttabaseConfig';
import { resolveConfigWithEnv } from '../resolveConfigWithEnv';

const base = (rateLimit?: Record<string, number>) =>
    defineOttabaseConfig({
        appId: 'test-app',
        appName: 'Test App',
        ...(rateLimit ? { features: { ottaai: { rateLimit } } } : {}),
    });

describe('config path', () => {
    it('defaults to a positive limit on every dimension', () => {
        const { rateLimit } = base().features.ottaai;
        expect(rateLimit.perUser).toBeGreaterThan(0);
        expect(rateLimit.perOrganization).toBeGreaterThan(0);
        // The aggregate ceiling in particular must never default to "off".
        expect(rateLimit.perApp).toBeGreaterThan(0);
    });

    it('accepts a partial override without demanding the other dimensions', () => {
        const { rateLimit } = base({ perUser: 5 }).features.ottaai;
        expect(rateLimit.perUser).toBe(5);
        expect(rateLimit.perApp).toBeGreaterThan(0);
    });

    it('clamps a negative to the default rather than disabling the dimension', () => {
        expect(base({ perApp: -1 }).features.ottaai.rateLimit.perApp).toBeGreaterThan(0);
    });

    it('preserves an explicit 0, which callers read as "dimension disabled"', () => {
        expect(base({ perUser: 0 }).features.ottaai.rateLimit.perUser).toBe(0);
    });
});

describe('env path applies the SAME rule', () => {
    it('applies a valid override', () => {
        const resolved = resolveConfigWithEnv(base(), { OTTAAI_RATE_LIMIT_PER_APP: '50' });
        expect(resolved.features.ottaai.rateLimit.perApp).toBe(50);
    });

    it('falls back to the configured value for a NEGATIVE override', () => {
        // Previously survived `parseInt` and read downstream as "no aggregate ceiling".
        const resolved = resolveConfigWithEnv(base({ perApp: 300 }), { OTTAAI_RATE_LIMIT_PER_APP: '-1' });
        expect(resolved.features.ottaai.rateLimit.perApp).toBe(300);
    });

    it('falls back to the configured value for a non-numeric override', () => {
        const resolved = resolveConfigWithEnv(base({ perApp: 300 }), { OTTAAI_RATE_LIMIT_PER_APP: 'unlimited' });
        expect(resolved.features.ottaai.rateLimit.perApp).toBe(300);
    });

    it('still honours an explicit 0 for the optional per-actor dimensions', () => {
        const resolved = resolveConfigWithEnv(base(), { OTTAAI_RATE_LIMIT_PER_USER: '0' });
        expect(resolved.features.ottaai.rateLimit.perUser).toBe(0);
    });

    it('leaves every dimension alone when no override is present', () => {
        const config = base({ perUser: 7, perOrganization: 8, perApp: 9 });
        expect(resolveConfigWithEnv(config, {}).features.ottaai.rateLimit).toEqual({
            perUser: 7,
            perOrganization: 8,
            perApp: 9,
        });
    });
});

describe('image budget', () => {
    const withImages = (images?: Record<string, unknown>) =>
        defineOttabaseConfig({
            appId: 'test-app',
            appName: 'Test App',
            ...(images ? { features: { ottaai: { images } } } : {}),
        } as never);

    it('defaults every value to a positive integer', () => {
        const { images } = withImages().features.ottaai;
        expect(images).toEqual({
            maxCount: 4,
            maxBytes: 4 * 1024 * 1024,
            maxTotalBytes: 8 * 1024 * 1024,
            perUserPerMinute: 10,
        });
    });

    it('accepts a partial override and falls back on nonsense', () => {
        const { images } = withImages({ maxCount: 2, maxBytes: 0, perUserPerMinute: 'lots' }).features.ottaai;
        expect(images.maxCount).toBe(2);
        expect(images.maxBytes).toBe(4 * 1024 * 1024);
        expect(images.perUserPerMinute).toBe(10);
    });

    it('survives the env-override path, which rebuilds the ottaai block field by field', () => {
        const resolved = resolveConfigWithEnv(withImages({ maxCount: 2 }), {});
        expect(resolved.features.ottaai.images.maxCount).toBe(2);
    });
});

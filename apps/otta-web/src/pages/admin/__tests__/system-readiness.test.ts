import { describe, expect, it } from 'vitest';
import { versionLabel, wranglerCommand } from '../SystemReadiness';

describe('System readiness helpers', () => {
    it('names the running build by its tag (the commit) and its age, else a short version id', () => {
        const now = Date.parse('2026-10-29T12:00:00Z');
        expect(versionLabel({ id: 'a1b2c3d4-e5f6', tag: 'abc1234', createdAt: '2026-10-29T10:00:00Z' }, now)).toBe(
            'abc1234 · deployed 2 h ago',
        );
        expect(versionLabel({ id: 'a1b2c3d4-e5f6', tag: null, createdAt: null }, now)).toBe('a1b2c3d4');
    });

    it('offers wrangler secret put for missing secrets only', () => {
        expect(wranglerCommand({ key: 'AUTH_SECRET', kind: 'secret', secret: true })).toBe(
            'wrangler secret put AUTH_SECRET',
        );
        expect(wranglerCommand({ key: 'AUTH_URL', kind: 'var', secret: false })).toBeNull();
        expect(wranglerCommand({ key: 'OBCF_KV', kind: 'binding', secret: true })).toBeNull();
    });
});

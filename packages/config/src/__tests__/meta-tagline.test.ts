import { describe, expect, it } from 'vitest';
import { defineOttabaseConfig } from '../defineOttabaseConfig';

describe('meta.tagline', () => {
    it('defaults to empty so headers render no tagline unless the app opts in', () => {
        const config = defineOttabaseConfig({ appId: 'test', appName: 'Test App' });
        expect(config.meta.tagline).toBe('');
    });

    it('passes a configured tagline through unchanged', () => {
        const config = defineOttabaseConfig({
            appId: 'test',
            appName: 'Test App',
            meta: { tagline: 'Cloudflare-native' },
        });
        expect(config.meta.tagline).toBe('Cloudflare-native');
    });
});

import { describe, expect, it } from 'vitest';
import { defineOttabaseConfig } from '../defineOttabaseConfig';
import { resolveConfigWithEnv } from '../resolveConfigWithEnv';

describe('features.ottablog.orgBlogs', () => {
    it('defaults to the site blog only', () => {
        const config = defineOttabaseConfig({ appId: 'test', appName: 'Test App' });
        expect(config.features.ottablog).toEqual({ orgBlogs: false });
    });

    it('turns organization blogs on only for an explicit true', () => {
        const on = defineOttabaseConfig({ appId: 'test', appName: 'Test', features: { ottablog: { orgBlogs: true } } });
        expect(on.features.ottablog.orgBlogs).toBe(true);
        const loose = defineOttabaseConfig({
            appId: 'test',
            appName: 'Test',
            features: { ottablog: { orgBlogs: 'yes' as unknown as boolean } },
        });
        expect(loose.features.ottablog.orgBlogs).toBe(false);
    });

    it('is decided by the config file, never an env var (the browser cannot see env)', () => {
        const config = defineOttabaseConfig({
            appId: 'test',
            appName: 'Test',
            features: { ottablog: { orgBlogs: true } },
        });
        expect(resolveConfigWithEnv(config, { OTTABLOG_ORG_BLOGS: 'false' }).features.ottablog.orgBlogs).toBe(true);
    });
});

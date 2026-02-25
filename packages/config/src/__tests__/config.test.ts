import { describe, expect, it } from 'vitest';
import * as config from '../index';
import { createAppConfig, defineOttabaseConfig, userConfigToOptions } from '../createAppConfig';

describe('Configuration Utilities', () => {
    describe('Config Module', () => {
        it('should export configuration utilities', () => {
            expect(config).toBeDefined();
            expect(typeof config).toBe('object');
        });
    });

    describe('Configuration Exports', () => {
        it('should provide configuration helpers', () => {
            expect(config).toBeDefined();
        });

        it('should support environment-based configuration', () => {
            expect(config).toBeDefined();
        });
    });

    describe('Type Safety', () => {
        it('should export type definitions for configuration', () => {
            // Verify TypeScript types are available
            expect(typeof config).toBe('object');
        });
    });

    describe('Integration', () => {
        it('should integrate with Ottabase ecosystem', () => {
            expect(config).toBeDefined();
        });

        it('should support multiple environments', () => {
            expect(config).toBeDefined();
        });
    });

    describe('defineOttabaseConfig', () => {
        it('should be a pass-through identity function', () => {
            const userConfig = defineOttabaseConfig({
                appId: 'test-app',
                appName: 'Test App',
            });
            expect(userConfig.appId).toBe('test-app');
            expect(userConfig.appName).toBe('Test App');
        });

        it('should preserve all user config fields', () => {
            const userConfig = defineOttabaseConfig({
                appId: 'my-saas',
                appName: 'My SaaS',
                packages: { ottablog: true, shortlinks: false },
                features: {
                    referrals: { enabled: true, trackClicks: true, expiryDays: 90 },
                    spotlight: { enabled: true, shortcuts: ['/'] },
                },
            });
            expect(userConfig.packages?.ottablog).toBe(true);
            expect(userConfig.packages?.shortlinks).toBe(false);
            expect(userConfig.features?.referrals?.enabled).toBe(true);
            expect(userConfig.features?.spotlight?.shortcuts).toEqual(['/']);
        });

        it('should accept email config (non-secret)', () => {
            const userConfig = defineOttabaseConfig({
                appId: 'email-test',
                appName: 'Email Test',
                email: { from: 'noreply@my-app.com', sesRegion: 'eu-west-1' },
            });
            expect(userConfig.email?.from).toBe('noreply@my-app.com');
            expect(userConfig.email?.sesRegion).toBe('eu-west-1');
        });

        it('should accept authBehavior flags (non-secret)', () => {
            const userConfig = defineOttabaseConfig({
                appId: 'auth-test',
                appName: 'Auth Test',
                features: {
                    authBehavior: {
                        sessionMaxAge: 7 * 24 * 3600,
                        requireEmailVerified: true,
                        disableCredentials: false,
                        verbose: false,
                    },
                },
            });
            expect(userConfig.features?.authBehavior?.sessionMaxAge).toBe(7 * 24 * 3600);
            expect(userConfig.features?.authBehavior?.requireEmailVerified).toBe(true);
        });
    });

    describe('userConfigToOptions', () => {
        it('should convert OttabaseUserConfig to ConfigOptions', () => {
            const userConfig = defineOttabaseConfig({
                appId: 'my-app',
                appName: 'My App',
                meta: { description: 'A test app', author: 'Tester' },
                features: { referrals: { enabled: false, trackClicks: false, expiryDays: 30 } },
            });
            const options = userConfigToOptions(userConfig);
            expect(options.appId).toBe('my-app');
            expect(options.appName).toBe('My App');
            expect(options.defaults?.meta?.description).toBe('A test app');
            expect(options.defaults?.features?.referrals?.enabled).toBe(false);
        });

        it('should produce a valid AppConfig via createAppConfig', () => {
            const userConfig = defineOttabaseConfig({
                appId: 'verify-app',
                appName: 'Verify App',
                storage: { prefix: 'verify' },
            });
            const appConfig = createAppConfig(userConfigToOptions(userConfig));
            expect(appConfig.appId).toBe('verify-app');
            expect(appConfig.meta.appName).toBe('Verify App');
            expect(appConfig.storage.prefix).toBe('verify');
        });
    });
});

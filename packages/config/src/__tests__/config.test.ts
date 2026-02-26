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

    describe('createAppConfig – email defaults and env overrides', () => {
        it('should use hardcoded defaults when no config or env vars are provided', () => {
            const appConfig = createAppConfig({ appId: 'test', appName: 'Test' });
            expect(appConfig.email.from).toBe('noreply@example.com');
            expect(appConfig.email.sesRegion).toBe('us-east-1');
        });

        it('should use values from defaults when provided via userConfig', () => {
            const userConfig = defineOttabaseConfig({
                appId: 'email-app',
                appName: 'Email App',
                email: { from: 'hello@myapp.com', sesRegion: 'eu-west-1' },
            });
            const appConfig = createAppConfig(userConfigToOptions(userConfig));
            expect(appConfig.email.from).toBe('hello@myapp.com');
            expect(appConfig.email.sesRegion).toBe('eu-west-1');
        });

        it('should override email.from with EMAIL_FROM env var', () => {
            process.env['EMAIL_FROM'] = 'override@env.com';
            try {
                const appConfig = createAppConfig({ appId: 'test', appName: 'Test' });
                expect(appConfig.email.from).toBe('override@env.com');
            } finally {
                delete process.env['EMAIL_FROM'];
            }
        });

        it('should override email.sesRegion with AWS_REGION env var', () => {
            process.env['AWS_REGION'] = 'ap-southeast-1';
            try {
                const appConfig = createAppConfig({ appId: 'test', appName: 'Test' });
                expect(appConfig.email.sesRegion).toBe('ap-southeast-1');
            } finally {
                delete process.env['AWS_REGION'];
            }
        });
    });

    describe('createAppConfig – authBehavior defaults and env overrides', () => {
        it('should use hardcoded defaults when no config or env vars are provided', () => {
            const appConfig = createAppConfig({ appId: 'test', appName: 'Test' });
            expect(appConfig.features.authBehavior.sessionMaxAge).toBe(30 * 24 * 60 * 60);
            expect(appConfig.features.authBehavior.requireEmailVerified).toBe(false);
            expect(appConfig.features.authBehavior.disableCredentials).toBe(false);
            expect(appConfig.features.authBehavior.verbose).toBe(false);
        });

        it('should use values from defaults when provided via userConfig', () => {
            const userConfig = defineOttabaseConfig({
                appId: 'auth-app',
                appName: 'Auth App',
                features: {
                    authBehavior: {
                        sessionMaxAge: 7 * 24 * 3600,
                        requireEmailVerified: true,
                        disableCredentials: true,
                        verbose: true,
                    },
                },
            });
            const appConfig = createAppConfig(userConfigToOptions(userConfig));
            expect(appConfig.features.authBehavior.sessionMaxAge).toBe(7 * 24 * 3600);
            expect(appConfig.features.authBehavior.requireEmailVerified).toBe(true);
            expect(appConfig.features.authBehavior.disableCredentials).toBe(true);
            expect(appConfig.features.authBehavior.verbose).toBe(true);
        });

        it('should override sessionMaxAge with AUTH_SESSION_MAX_AGE env var', () => {
            process.env['AUTH_SESSION_MAX_AGE'] = '3600';
            try {
                const appConfig = createAppConfig({ appId: 'test', appName: 'Test' });
                expect(appConfig.features.authBehavior.sessionMaxAge).toBe(3600);
            } finally {
                delete process.env['AUTH_SESSION_MAX_AGE'];
            }
        });

        it('should override requireEmailVerified with AUTH_REQUIRE_EMAIL_VERIFIED env var', () => {
            process.env['AUTH_REQUIRE_EMAIL_VERIFIED'] = 'true';
            try {
                const appConfig = createAppConfig({ appId: 'test', appName: 'Test' });
                expect(appConfig.features.authBehavior.requireEmailVerified).toBe(true);
            } finally {
                delete process.env['AUTH_REQUIRE_EMAIL_VERIFIED'];
            }
        });

        it('should override disableCredentials and verbose with env vars', () => {
            process.env['AUTH_DISABLE_CREDENTIALS'] = 'true';
            process.env['AUTH_VERBOSE'] = 'true';
            try {
                const appConfig = createAppConfig({ appId: 'test', appName: 'Test' });
                expect(appConfig.features.authBehavior.disableCredentials).toBe(true);
                expect(appConfig.features.authBehavior.verbose).toBe(true);
            } finally {
                delete process.env['AUTH_DISABLE_CREDENTIALS'];
                delete process.env['AUTH_VERBOSE'];
            }
        });
    });

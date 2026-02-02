import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n, languageNames, resources, supportedLanguages } from '../config';

describe('i18n Configuration', () => {
    beforeEach(() => {
        // Reset i18n instance
        if (i18n.isInitialized) {
            // @ts-ignore - accessing private property for testing
            i18n.isInitialized = false;
        }
        localStorage.clear();
    });

    // Run Language Detection first so localStorage test runs before any init
    describe('Language Detection', () => {
        it('should use localStorage language if available', async () => {
            localStorage.setItem('i18nextLng', 'fr');

            await initI18n();

            expect(i18n.language).toBe('fr');
        });

        it('should fall back to default language if detection fails', async () => {
            localStorage.clear();
            if (i18n.isInitialized) {
                // @ts-expect-error reset so we re-init and detect
                i18n.isInitialized = false;
            }
            // supportedLngs: ['en'] so any previously detected language (e.g. 'fr') is invalid -> fall back to defaultLanguage
            await initI18n({ defaultLanguage: 'en', supportedLngs: ['en'] });

            expect(i18n.language).toBe('en');
        });
    });

    describe('initI18n', () => {
        it('should initialize i18n with default settings', async () => {
            const instance = await initI18n({ defaultLanguage: 'en', supportedLngs: ['en'] });

            expect(instance).toBe(i18n);
            expect(i18n.isInitialized).toBe(true);
            expect(i18n.language).toBe('en');
        });

        it('should use defaultLanguage when no valid language is detected', async () => {
            // supportedLngs: ['es'] so navigator's 'en' is not valid -> fall back to defaultLanguage
            await initI18n({ defaultLanguage: 'es', supportedLngs: ['es'] });

            expect(i18n.language).toBe('es');
        });

        it('should not re-initialize if already initialized', async () => {
            const first = await initI18n({ defaultLanguage: 'en', supportedLngs: ['en'] });
            const second = await initI18n({ defaultLanguage: 'fr' });

            expect(first).toBe(second);
            expect(i18n.language).toBe('en'); // Should stay 'en', not change to 'fr'
        });

        it('should merge custom resources with default resources', async () => {
            const customResources = {
                en: {
                    custom: { hello: 'Hi there!' },
                },
            };

            await initI18n({ resources: customResources });

            // Should have both default and custom namespaces
            expect(i18n.hasResourceBundle('en', 'common')).toBe(true);
            expect(i18n.hasResourceBundle('en', 'custom')).toBe(true);
        });

        it('should override default translations with custom resources', async () => {
            const customResources = {
                en: {
                    common: { welcome: 'Custom Welcome Message' },
                },
            };

            await initI18n({ resources: customResources });

            expect(i18n.t('common:welcome')).toBe('Custom Welcome Message');
        });

        it('should enable debug mode when specified', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            await initI18n({ debug: true });

            // i18next logs when debug is true
            // We just verify it doesn't crash
            expect(i18n.isInitialized).toBe(true);

            consoleSpy.mockRestore();
        });
    });

    describe('Configuration Exports', () => {
        it('should export all supported languages', () => {
            expect(supportedLanguages).toEqual(['en', 'es', 'fr', 'de']);
        });

        it('should export language names', () => {
            expect(languageNames).toEqual({
                en: 'English',
                es: 'Español',
                fr: 'Français',
                de: 'Deutsch',
            });
        });

        it('should export resources for all languages', () => {
            expect(Object.keys(resources)).toEqual(['en', 'es', 'fr', 'de']);

            // Each language should have a 'common' namespace
            Object.values(resources).forEach((langResource) => {
                expect(langResource).toHaveProperty('common');
            });
        });
    });

    describe('Translation Keys', () => {
        beforeEach(async () => {
            await initI18n({ defaultLanguage: 'en' });
            if (i18n.language !== 'en') {
                await i18n.changeLanguage('en');
            }
        });

        it('should provide common translations', () => {
            expect(i18n.t('common:welcome')).toBe('Welcome to Ottabase');
            expect(i18n.t('common:save')).toBe('Save');
            expect(i18n.t('common:cancel')).toBe('Cancel');
        });

        it('should support interpolation', () => {
            expect(i18n.t('common:greeting', { name: 'John' })).toBe('Hello, John!');
        });

        it('should support pluralization', () => {
            expect(i18n.t('common:messages', { count: 1 })).toBe('You have 1 new message');
            expect(i18n.t('common:messages', { count: 5 })).toBe('You have 5 new messages');
        });
    });
});

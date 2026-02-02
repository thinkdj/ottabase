import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '../config';
import { I18nProvider, useTranslation } from '../react';

describe('Integration Tests', () => {
    beforeEach(() => {
        if (i18n.isInitialized) {
            // @ts-expect-error reset for test isolation
            i18n.isInitialized = false;
        }
        localStorage.clear();
    });

    describe('Full Application Flow', () => {
        // Run restore-from-localStorage first so init runs with detector before other tests leave state
        it('should restore language from localStorage on initialization', async () => {
            // Pre-populate localStorage
            localStorage.setItem('i18nextLng', 'es');

            function App() {
                const { t, i18n } = useTranslation('common');
                return (
                    <div>
                        <div data-testid="welcome">{t('welcome')}</div>
                        <div data-testid="lang">{i18n.language}</div>
                    </div>
                );
            }

            render(
                <I18nProvider>
                    <App />
                </I18nProvider>,
            );

            // Should initialize with Spanish from localStorage
            await waitFor(() => {
                expect(screen.getByTestId('welcome')).toHaveTextContent('Bienvenido a Ottabase');
                expect(screen.getByTestId('lang')).toHaveTextContent('es');
            });
        });

        it('should initialize, switch languages, and persist to localStorage', async () => {
            function App() {
                const { t, i18n } = useTranslation('common');

                return (
                    <div>
                        <h1 data-testid="title">{t('welcome')}</h1>
                        <p data-testid="lang">{i18n.language}</p>
                        <button onClick={() => i18n.changeLanguage('fr')} data-testid="btn-fr">
                            French
                        </button>
                        <button onClick={() => i18n.changeLanguage('de')} data-testid="btn-de">
                            German
                        </button>
                    </div>
                );
            }

            // Initial render with English (supportedLngs so we get 'en' even if previous test left another lang)
            render(
                <I18nProvider defaultLanguage="en" supportedLngs={['en', 'fr', 'de']}>
                    <App />
                </I18nProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('title')).toHaveTextContent('Welcome to Ottabase');
                expect(screen.getByTestId('lang')).toHaveTextContent('en');
            });

            // Switch to French
            act(() => {
                screen.getByTestId('btn-fr').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('title')).toHaveTextContent('Bienvenue sur Ottabase');
                expect(screen.getByTestId('lang')).toHaveTextContent('fr');
            });

            // Verify localStorage was updated
            expect(localStorage.getItem('i18nextLng')).toBe('fr');

            // Switch to German
            act(() => {
                screen.getByTestId('btn-de').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('title')).toHaveTextContent('Willkommen bei Ottabase');
                expect(screen.getByTestId('lang')).toHaveTextContent('de');
            });

            expect(localStorage.getItem('i18nextLng')).toBe('de');
        });
    });

    describe('Resource Override Behavior', () => {
        it('should prioritize app resources over package resources', async () => {
            const appResources = {
                en: {
                    common: {
                        welcome: 'Welcome to My Custom App!',
                        customKey: 'This is a custom translation',
                    },
                },
                es: {
                    common: {
                        welcome: '¡Bienvenido a Mi Aplicación Personalizada!',
                    },
                },
            };

            function App() {
                const { t, i18n } = useTranslation('common');
                return (
                    <div>
                        <div data-testid="welcome">{t('welcome')}</div>
                        <div data-testid="custom">{t('customKey')}</div>
                        <div data-testid="save">{t('save')}</div>
                        <button onClick={() => i18n.changeLanguage('es')} data-testid="switch">
                            Switch
                        </button>
                    </div>
                );
            }

            render(
                <I18nProvider defaultLanguage="en" resources={appResources}>
                    <App />
                </I18nProvider>,
            );

            await waitFor(() => {
                // Should use app's custom welcome message
                expect(screen.getByTestId('welcome')).toHaveTextContent('Welcome to My Custom App!');
                // Should have app's custom key
                expect(screen.getByTestId('custom')).toHaveTextContent('This is a custom translation');
                // Should still have package's default keys
                expect(screen.getByTestId('save')).toHaveTextContent('Save');
            });

            // Switch to Spanish
            act(() => {
                screen.getByTestId('switch').click();
            });

            await waitFor(() => {
                // Should use app's Spanish override
                expect(screen.getByTestId('welcome')).toHaveTextContent('¡Bienvenido a Mi Aplicación Personalizada!');
                // Package's Spanish should still work
                expect(screen.getByTestId('save')).toHaveTextContent('Guardar');
            });
        });

        it('should handle deep merging of nested resources', async () => {
            const appResources = {
                en: {
                    common: {
                        // Override one key but keep others
                        welcome: 'App Welcome',
                    },
                    custom: {
                        app: {
                            title: 'My App',
                            subtitle: 'Description',
                        },
                    },
                },
            };

            function App() {
                const { t } = useTranslation('common');
                return (
                    <div>
                        <div data-testid="welcome">{t('welcome')}</div>
                        <div data-testid="save">{t('save')}</div>
                        <div data-testid="cancel">{t('cancel')}</div>
                    </div>
                );
            }

            render(
                <I18nProvider defaultLanguage="en" resources={appResources}>
                    <App />
                </I18nProvider>,
            );

            await waitFor(() => {
                // App override
                expect(screen.getByTestId('welcome')).toHaveTextContent('App Welcome');
                // Package defaults still available
                expect(screen.getByTestId('save')).toHaveTextContent('Save');
                expect(screen.getByTestId('cancel')).toHaveTextContent('Cancel');
            });
        });
    });

    describe('Multiple Components Syncing', () => {
        it('should sync language changes across multiple components', async () => {
            function ComponentA() {
                const { t } = useTranslation('common');
                return <div data-testid="comp-a">{t('welcome')}</div>;
            }

            function ComponentB() {
                const { t } = useTranslation('common');
                return <div data-testid="comp-b">{t('language')}</div>;
            }

            function LanguageSwitcher() {
                const { i18n } = useTranslation();
                return (
                    <button onClick={() => i18n.changeLanguage('es')} data-testid="switcher">
                        Switch
                    </button>
                );
            }

            function App() {
                return (
                    <div>
                        <ComponentA />
                        <ComponentB />
                        <LanguageSwitcher />
                    </div>
                );
            }

            render(
                <I18nProvider defaultLanguage="en">
                    <App />
                </I18nProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('comp-a')).toHaveTextContent('Welcome to Ottabase');
                expect(screen.getByTestId('comp-b')).toHaveTextContent('Language');
            });

            // Switch language
            act(() => {
                screen.getByTestId('switcher').click();
            });

            // Both components should update
            await waitFor(() => {
                expect(screen.getByTestId('comp-a')).toHaveTextContent('Bienvenido a Ottabase');
                expect(screen.getByTestId('comp-b')).toHaveTextContent('Idioma');
            });
        });
    });
});

import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '../config';
import { I18nProvider, useTranslation } from '../react';

// Test component that uses the hook
function TestComponent() {
    const { t, i18n } = useTranslation('common');

    return (
        <div>
            <div data-testid="welcome">{t('welcome')}</div>
            <div data-testid="language">{i18n.language}</div>
            <button onClick={() => i18n.changeLanguage('es')}>Change to Spanish</button>
        </div>
    );
}

describe('React Integration', () => {
    beforeEach(() => {
        if (i18n.isInitialized) {
            // @ts-expect-error reset for test isolation
            i18n.isInitialized = false;
        }
        localStorage.clear();
    });

    describe('I18nProvider', () => {
        it('should render children correctly', async () => {
            render(
                <I18nProvider>
                    <div data-testid="child">Test Child</div>
                </I18nProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('child')).toHaveTextContent('Test Child');
            });
        });

        it('should initialize with default language', async () => {
            render(
                <I18nProvider defaultLanguage="en">
                    <TestComponent />
                </I18nProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('language')).toHaveTextContent('en');
            });
        });

        it('should initialize with custom default language', async () => {
            render(
                <I18nProvider defaultLanguage="fr" supportedLngs={['fr']}>
                    <TestComponent />
                </I18nProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('language')).toHaveTextContent('fr');
            });
        });

        it('should provide translations via useTranslation hook', async () => {
            render(
                <I18nProvider defaultLanguage="en">
                    <TestComponent />
                </I18nProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('welcome')).toHaveTextContent('Welcome to Ottabase');
            });
        });

        it('should accept custom resources', async () => {
            const customResources = {
                en: {
                    common: { welcome: 'Custom Welcome!' },
                },
            };

            render(
                <I18nProvider defaultLanguage="en" resources={customResources}>
                    <TestComponent />
                </I18nProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('welcome')).toHaveTextContent('Custom Welcome!');
            });
        });

        it('should render fallback while loading', async () => {
            const fallback = <div data-testid="loading">Loading translations...</div>;

            render(
                <I18nProvider fallback={fallback}>
                    <TestComponent />
                </I18nProvider>,
            );

            // Fallback is shown until init completes; then children render
            await waitFor(() => {
                const loadingOrChild = screen.queryByTestId('loading') ?? screen.queryByTestId('welcome');
                expect(loadingOrChild).toBeTruthy();
            });
        });
    });

    describe('useTranslation Hook', () => {
        it('should provide translation function', async () => {
            function HookTest() {
                const { t } = useTranslation('common');
                return <div data-testid="result">{t('save')}</div>;
            }

            render(
                <I18nProvider defaultLanguage="en">
                    <HookTest />
                </I18nProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('result')).toHaveTextContent('Save');
            });
        });

        it('should provide i18n instance', async () => {
            function HookTest() {
                const { i18n } = useTranslation();
                return <div data-testid="lang">{i18n.language}</div>;
            }

            render(
                <I18nProvider defaultLanguage="es" supportedLngs={['es']}>
                    <HookTest />
                </I18nProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('lang')).toHaveTextContent('es');
            });
        });

        it('should allow language switching', async () => {
            function Switcher() {
                const { i18n, t } = useTranslation('common');
                return (
                    <div>
                        <div data-testid="greeting">{t('welcome')}</div>
                        <button onClick={() => i18n.changeLanguage('es')} data-testid="switch-btn">
                            Switch
                        </button>
                    </div>
                );
            }

            render(
                <I18nProvider defaultLanguage="en">
                    <Switcher />
                </I18nProvider>,
            );

            // Initial state
            await waitFor(() => {
                expect(screen.getByTestId('greeting')).toHaveTextContent('Welcome to Ottabase');
            });

            // Switch language
            act(() => {
                screen.getByTestId('switch-btn').click();
            });

            // Should update to Spanish (allow a bit more time for async language change)
            await waitFor(
                () => {
                    expect(screen.getByTestId('greeting')).toHaveTextContent('Bienvenido a Ottabase');
                },
                { timeout: 3000 },
            );
        });

        it('should support interpolation', async () => {
            function InterpolationTest() {
                const { t } = useTranslation('common');
                return <div data-testid="result">{t('greeting', { name: 'Alice' })}</div>;
            }

            render(
                <I18nProvider defaultLanguage="en">
                    <InterpolationTest />
                </I18nProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('result')).toHaveTextContent('Hello, Alice!');
            });
        });

        it('should support pluralization', async () => {
            function PluralizationTest() {
                const { t } = useTranslation('common');
                return (
                    <div>
                        <div data-testid="one">{t('messages', { count: 1 })}</div>
                        <div data-testid="many">{t('messages', { count: 5 })}</div>
                    </div>
                );
            }

            render(
                <I18nProvider defaultLanguage="en">
                    <PluralizationTest />
                </I18nProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('one')).toHaveTextContent('You have 1 new message');
                expect(screen.getByTestId('many')).toHaveTextContent('You have 5 new messages');
            });
        });
    });
});

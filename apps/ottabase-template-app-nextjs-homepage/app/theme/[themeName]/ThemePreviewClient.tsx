'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getLandingTheme, initOttaLanding, renderPage } from '@ottabase/ottalanding';
import { homePage, siteContent } from '@/config/landing.config';

// Ensure themes are registered on the client
initOttaLanding({ defaultThemeId: 'atlas' });

interface ThemePreviewClientProps {
    themeName: string;
    lightVars: Record<string, string>;
    darkVars: Record<string, string>;
}

function LandingPage({ themeId }: { themeId: string }) {
    const theme = getLandingTheme(themeId);
    if (!theme) return <div className="p-8 text-center text-muted-foreground">Theme "{themeId}" not found</div>;
    return renderPage(theme, siteContent, homePage);
}

export function ThemePreviewClient({ themeName, lightVars, darkVars }: ThemePreviewClientProps) {
    const [template, setTemplate] = useState<'atlas' | 'mono'>('atlas');
    const [scheme, setScheme] = useState<'light' | 'dark'>('light');

    const currentVars = scheme === 'light' ? lightVars : darkVars;

    return (
        <>
            {/* Fixed control bar — uses the host page theme, not the preview theme */}
            <div className="fixed inset-x-0 top-0 z-[200] flex h-12 items-center gap-3 border-b border-zinc-200 bg-white/95 px-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95">
                <Link
                    href="/theme"
                    className="shrink-0 text-sm text-zinc-500 hover:text-zinc-900 transition-colors dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                    ← Themes
                </Link>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <span className="font-medium text-sm capitalize text-zinc-800 dark:text-zinc-200">{themeName}</span>

                <div className="ml-auto flex items-center gap-2">
                    {/* Template toggle */}
                    <div className="flex rounded-md border border-zinc-200 dark:border-zinc-700 text-xs overflow-hidden">
                        <button
                            onClick={() => setTemplate('atlas')}
                            className={`px-3 py-1.5 transition-colors ${
                                template === 'atlas'
                                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                                    : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800'
                            }`}
                        >
                            Atlas
                        </button>
                        <button
                            onClick={() => setTemplate('mono')}
                            className={`px-3 py-1.5 transition-colors ${
                                template === 'mono'
                                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                                    : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800'
                            }`}
                        >
                            Mono
                        </button>
                    </div>

                    {/* Light/Dark toggle */}
                    <button
                        onClick={() => setScheme((s) => (s === 'light' ? 'dark' : 'light'))}
                        className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                        {scheme === 'light' ? 'Light' : 'Dark'}
                    </button>
                </div>
            </div>

            {/* Preview — scoped to the selected theme */}
            <div className={scheme === 'dark' ? 'dark' : ''} style={currentVars as React.CSSProperties}>
                <div className="bg-background pt-12">
                    <LandingPage themeId={template} />
                </div>
            </div>
        </>
    );
}

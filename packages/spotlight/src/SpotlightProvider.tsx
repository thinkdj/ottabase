import React, { useCallback, useEffect, useState } from 'react';
import { Spotlight } from './Spotlight';
import { SpotlightContext } from './context';
import type { SpotlightConfig } from './types';

export interface SpotlightProviderProps extends SpotlightConfig {
    children: React.ReactNode;
}

/** Physical-key codes (US layout) for symbol keys, used when Shift changes `e.key` ('/' → '?'). */
const SYMBOL_CODES: Record<string, string> = {
    '/': 'Slash',
    '.': 'Period',
    ',': 'Comma',
    ';': 'Semicolon',
    "'": 'Quote',
    '[': 'BracketLeft',
    ']': 'BracketRight',
    '\\': 'Backslash',
    '-': 'Minus',
    '=': 'Equal',
    '`': 'Backquote',
};

function codeFor(key: string): string | undefined {
    if (/^[a-z]$/.test(key)) return `Key${key.toUpperCase()}`;
    if (/^[0-9]$/.test(key)) return `Digit${key}`;
    return SYMBOL_CODES[key];
}

/**
 * Compile a shortcut such as `'mod+k'`, `'/'` or `'shift+/'` into a KeyboardEvent matcher.
 * `mod` is Cmd or Ctrl. Mod and Alt must match exactly, so `'/'` does not fire on Ctrl+/.
 */
export function parseShortcut(shortcut: string): (e: KeyboardEvent) => boolean {
    const parts = shortcut
        .toLowerCase()
        .split('+')
        .map((s) => s.trim());
    const mod = parts.includes('mod');
    const shift = parts.includes('shift');
    const alt = parts.includes('alt');
    const key = parts.find((part) => part !== 'mod' && part !== 'shift' && part !== 'alt');
    const code = key ? codeFor(key) : undefined;

    return (e: KeyboardEvent) => {
        if (!key) return false;
        if (mod !== (e.metaKey || e.ctrlKey) || alt !== e.altKey || (shift && !e.shiftKey)) return false;
        if (e.key.toLowerCase() === key) return true;
        // With Shift held, `e.key` is the shifted character ('?' for '/'); match the physical key.
        return shift && code !== undefined && e.code === code;
    };
}

export function SpotlightProvider({
    children,
    enabled = true,
    shortcuts = ['/'],
    onSearch,
    renderResult,
    renderLoading,
    renderEmpty,
    renderError,
    placeholder,
    emptyMessage,
    loadingMessage,
    errorMessage,
    maxResults,
    searchDebounceMs,
    minQueryLength,
    onQueryChange,
    onResultSelect,
    onOpenChange,
    defaultResults,
}: SpotlightProviderProps) {
    const [open, setOpen] = useState(false);

    const toggle = useCallback(() => {
        setOpen((prev) => !prev);
    }, []);

    // Keyboard shortcut handling
    useEffect(() => {
        if (!enabled) return;

        const handlers = shortcuts.map((shortcut) => ({
            shortcut,
            check: parseShortcut(shortcut),
        }));

        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input/textarea
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            for (const { check } of handlers) {
                if (check(e)) {
                    e.preventDefault();
                    toggle();
                    break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, shortcuts, toggle]);

    const contextValue = React.useMemo(
        () => ({
            open,
            setOpen,
            toggle,
        }),
        [open, toggle],
    );

    return (
        <SpotlightContext.Provider value={contextValue}>
            {children}
            <Spotlight
                open={open}
                onOpenChange={(newOpen) => {
                    setOpen(newOpen);
                    onOpenChange?.(newOpen);
                }}
                onSearch={onSearch}
                renderResult={renderResult}
                renderLoading={renderLoading}
                renderEmpty={renderEmpty}
                renderError={renderError}
                placeholder={placeholder}
                emptyMessage={emptyMessage}
                loadingMessage={loadingMessage}
                errorMessage={errorMessage}
                maxResults={maxResults}
                searchDebounceMs={searchDebounceMs}
                minQueryLength={minQueryLength}
                onQueryChange={onQueryChange}
                onResultSelect={onResultSelect}
                defaultResults={defaultResults}
            />
        </SpotlightContext.Provider>
    );
}

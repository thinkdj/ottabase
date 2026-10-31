'use client';

import * as React from 'react';
import { TURNSTILE_ACTION_PATTERN, TURNSTILE_HEADER, TURNSTILE_SCRIPT_URL } from '@ottabase/cf/turnstile';

import { cn } from '@ottabase/ui/lib/utils';

/*
 * Cloudflare Turnstile for a form a stranger can submit. One hook per form:
 *
 *     const human = useTurnstile('signin');
 *     ...
 *     {human.widget}
 *     await fetch(url, { method: 'POST', headers: { ...(await human.headers()), ... } });
 *
 * The widget is invisible for most people and shows a challenge only when Cloudflare wants one.
 * `headers()` waits for the token, hands it over once (tokens are single use) and resets the
 * widget for the next submit. The server checks it with `requireHuman` from
 * `@ottabase/cf/turnstile`.
 *
 * The site key comes from `configureTurnstile`, else from `<meta name="turnstile-site-key">` in the
 * document, else from the hook's option. Without one the hook renders nothing and sends no header,
 * so bot checks are off.
 */

/** The `<meta name>` an app's HTML carries the site key in. */
export const TURNSTILE_SITE_KEY_META = 'turnstile-site-key';

interface TurnstileApi {
    render(container: HTMLElement, options: Record<string, unknown>): string;
    reset(widgetId: string): void;
    remove(widgetId: string): void;
}

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

let configuredSiteKey: string | null | undefined;

/** Set the site key for every widget, once at boot. `null` turns bot checks off. */
export function configureTurnstile(options: { siteKey: string | null | undefined }): void {
    configuredSiteKey = options.siteKey?.trim() || null;
}

/** The site key a widget renders with, or null when bot checks are off. */
export function turnstileSiteKey(): string | null {
    if (configuredSiteKey !== undefined) return configuredSiteKey;
    if (typeof document === 'undefined') return null;
    const meta = document.querySelector<HTMLMetaElement>(`meta[name="${TURNSTILE_SITE_KEY_META}"]`);
    return meta?.content.trim() || null;
}

/** The page's own light or dark (the `.dark` / `.light` class the theme providers set), else the visitor's. */
function documentTheme(): 'light' | 'dark' | 'auto' {
    const classes = document.documentElement.classList;
    return classes.contains('dark') ? 'dark' : classes.contains('light') ? 'light' : 'auto';
}

const subscribeNever = () => () => undefined;
const serverSiteKey = () => null;

let scriptLoad: Promise<TurnstileApi> | null = null;

/** Load Cloudflare's script once per page, however many forms use it. */
function loadTurnstile(): Promise<TurnstileApi> {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (scriptLoad) return scriptLoad;
    scriptLoad = new Promise<TurnstileApi>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT_URL;
        script.async = true;
        script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing')));
        script.onerror = () => reject(new Error('Turnstile failed to load'));
        document.head.appendChild(script);
    }).catch((error: unknown) => {
        // Let the next form try again (a blocked network, an ad blocker that relented).
        scriptLoad = null;
        throw error;
    });
    return scriptLoad;
}

/** Test seam: forget the loaded script and the configured key. */
export function resetTurnstileForTests(): void {
    scriptLoad = null;
    configuredSiteKey = undefined;
}

export interface UseTurnstileOptions {
    /** Overrides the configured site key. */
    siteKey?: string | null;
    /** `interaction-only` (default): shown only when Cloudflare wants a challenge. `always`: always shown. */
    appearance?: 'interaction-only' | 'always';
    /** How long `headers()` waits for a token before sending none. Default 30 seconds. */
    waitMs?: number;
    className?: string;
}

export interface TurnstileHandle {
    /** False when no site key is set: nothing renders and `headers()` is empty. */
    enabled: boolean;
    /** Place it in the form, above the submit button. Null when bot checks are off. */
    widget: React.ReactElement | null;
    /** The header for the submit. Waits for the token, uses it up and readies the next one. */
    headers(): Promise<Record<string, string>>;
    /** Why the widget could not run, for the form to show. */
    error: string | null;
}

const DEFAULT_WAIT_MS = 30_000;

export function useTurnstile(action: string, options: UseTurnstileOptions = {}): TurnstileHandle {
    if (!TURNSTILE_ACTION_PATTERN.test(action)) {
        throw new Error(`Turnstile action "${action}" must be 1 to 32 letters, digits, _ or -`);
    }
    // Read through useSyncExternalStore so a server render (Next) and the first client render
    // agree on "no key", and the browser picks the key up right after hydration.
    const resolvedKey = React.useSyncExternalStore(subscribeNever, turnstileSiteKey, serverSiteKey);
    const siteKey = options.siteKey === undefined ? resolvedKey : options.siteKey?.trim() || null;
    const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
    const appearance = options.appearance ?? 'interaction-only';
    // State, not a ref: the form may place the widget later (a dialog opening), and rendering waits for it.
    const [element, setElement] = React.useState<HTMLDivElement | null>(null);
    const widgetId = React.useRef<string | null>(null);
    const token = React.useRef<string | null>(null);
    const waiters = React.useRef<Array<(token: string | null) => void>>([]);
    const [error, setError] = React.useState<string | null>(null);
    // In `interaction-only`, Cloudflare shows nothing until it wants a click; the wrapper stays out of
    // the layout (no gap in a row of fields) until then.
    const [interactive, setInteractive] = React.useState(false);

    const settle = React.useCallback((value: string | null) => {
        token.current = value;
        if (!value) return;
        for (const wake of waiters.current.splice(0)) wake(value);
    }, []);

    React.useEffect(() => {
        if (!siteKey || !element) return;
        let cancelled = false;
        loadTurnstile()
            .then((api) => {
                if (cancelled) return;
                setError(null);
                widgetId.current = api.render(element, {
                    sitekey: siteKey,
                    action,
                    theme: documentTheme(),
                    language: document.documentElement.lang || 'auto',
                    appearance,
                    size: 'flexible',
                    callback: (value: string) => settle(value),
                    'expired-callback': () => settle(null),
                    'before-interactive-callback': () => setInteractive(true),
                    'after-interactive-callback': () => setInteractive(false),
                    'unsupported-callback': () =>
                        setError('This browser cannot run the bot check. Try another browser.'),
                    'error-callback': () => {
                        settle(null);
                        setError('The bot check could not run. Reload the page and try again.');
                        return true;
                    },
                });
            })
            .catch(() => {
                if (!cancelled) setError('The bot check could not load. Check your connection or content blocker.');
            });
        return () => {
            cancelled = true;
            if (widgetId.current) window.turnstile?.remove(widgetId.current);
            widgetId.current = null;
            token.current = null;
        };
    }, [siteKey, element, action, appearance, settle]);

    const headers = React.useCallback(async (): Promise<Record<string, string>> => {
        if (!siteKey) return {};
        const value =
            token.current ??
            (await new Promise<string | null>((resolve) => {
                const timer = setTimeout(() => {
                    waiters.current = waiters.current.filter((wake) => wake !== done);
                    resolve(null);
                }, waitMs);
                const done = (next: string | null) => {
                    clearTimeout(timer);
                    resolve(next);
                };
                waiters.current.push(done);
            }));
        // Single use: whatever happens to this submit, the next one needs a fresh token.
        token.current = null;
        if (widgetId.current) window.turnstile?.reset(widgetId.current);
        return value ? { [TURNSTILE_HEADER]: value } : {};
    }, [siteKey, waitMs]);

    const widget = siteKey ? (
        <div
            data-slot="turnstile"
            data-action={action}
            className={cn(appearance === 'interaction-only' && !interactive && !error && 'hidden', options.className)}
        >
            <div ref={setElement} />
            {error && (
                <p role="alert" className="mt-1.5 text-xs text-destructive">
                    {error}
                </p>
            )}
        </div>
    ) : null;

    return { enabled: !!siteKey, widget, headers, error };
}

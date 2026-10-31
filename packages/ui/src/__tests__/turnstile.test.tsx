import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    configureTurnstile,
    resetTurnstileForTests,
    turnstileSiteKey,
    useTurnstile,
    type TurnstileHandle,
} from '../../components/ui/turnstile';

type RenderOptions = Record<string, (...args: unknown[]) => unknown> & { sitekey: string; action: string };

function installTurnstile() {
    const rendered: RenderOptions[] = [];
    const api = {
        render: vi.fn((_el: HTMLElement, options: RenderOptions) => {
            rendered.push(options);
            return `w${rendered.length}`;
        }),
        reset: vi.fn(),
        remove: vi.fn(),
    };
    window.turnstile = api;
    return { api, rendered };
}

function Form({ action, onHandle }: { action: string; onHandle: (h: TurnstileHandle) => void }) {
    const human = useTurnstile(action);
    onHandle(human);
    return <form>{human.widget}</form>;
}

beforeEach(() => resetTurnstileForTests());
afterEach(() => {
    delete window.turnstile;
    document.head.querySelectorAll('meta[name="turnstile-site-key"]').forEach((el) => el.remove());
});

describe('useTurnstile', () => {
    it('renders nothing and sends no header without a site key', async () => {
        const { result } = renderHook(() => useTurnstile('signin'));
        expect(result.current.enabled).toBe(false);
        expect(result.current.widget).toBeNull();
        expect(await result.current.headers()).toEqual({});
    });

    it('reads the site key from the meta tag unless configured', () => {
        const meta = document.createElement('meta');
        meta.name = 'turnstile-site-key';
        meta.content = 'from-meta';
        document.head.appendChild(meta);
        expect(turnstileSiteKey()).toBe('from-meta');
        configureTurnstile({ siteKey: null });
        expect(turnstileSiteKey()).toBeNull();
    });

    it('renders an invisible widget for its action and hands each token over once, then resets', async () => {
        configureTurnstile({ siteKey: 'site' });
        const { api, rendered } = installTurnstile();
        let handle!: TurnstileHandle;
        render(<Form action="signin" onHandle={(h) => (handle = h)} />);
        await waitFor(() => expect(api.render).toHaveBeenCalled());
        expect(rendered[0]).toMatchObject({ sitekey: 'site', action: 'signin', appearance: 'interaction-only' });

        // Submitted before the token arrived: headers() waits for it.
        const pending = handle.headers();
        act(() => {
            rendered[0].callback('tok-1');
        });
        expect(await pending).toEqual({ 'X-Turnstile-Token': 'tok-1' });
        expect(api.reset).toHaveBeenCalledWith('w1');

        // The token is gone: the next submit waits for a fresh one.
        const next = handle.headers();
        act(() => {
            rendered[0].callback('tok-2');
        });
        expect(await next).toEqual({ 'X-Turnstile-Token': 'tok-2' });
    });

    it('keeps the idle widget out of the layout until Cloudflare asks for a click', async () => {
        configureTurnstile({ siteKey: 'site' });
        const { api, rendered } = installTurnstile();
        const { container } = render(<Form action="signin" onHandle={() => undefined} />);
        await waitFor(() => expect(api.render).toHaveBeenCalled());
        const wrapper = container.querySelector('[data-slot="turnstile"]')!;
        expect(wrapper.className).toContain('hidden');
        act(() => {
            rendered[0]['before-interactive-callback']();
        });
        expect(wrapper.className).not.toContain('hidden');
        act(() => {
            rendered[0]['after-interactive-callback']();
        });
        expect(wrapper.className).toContain('hidden');
    });

    it('gives up waiting and sends no header, so the server answers with its own message', async () => {
        configureTurnstile({ siteKey: 'site' });
        installTurnstile();
        const { result } = renderHook(() => useTurnstile('reset', { waitMs: 10 }));
        expect(await result.current.headers()).toEqual({});
    });

    it('shows an error the form can read when the widget fails, and removes the widget on unmount', async () => {
        configureTurnstile({ siteKey: 'site' });
        const { api, rendered } = installTurnstile();
        const view = render(<Form action="register" onHandle={() => undefined} />);
        await waitFor(() => expect(api.render).toHaveBeenCalled());
        act(() => {
            rendered[0]['error-callback']();
        });
        expect(screen.getByRole('alert').textContent).toMatch(/bot check could not run/);
        view.unmount();
        expect(api.remove).toHaveBeenCalledWith('w1');
    });

    it('refuses an action Cloudflare would reject', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(() => renderHook(() => useTurnstile('sign in!'))).toThrow(/must be 1 to 32/);
        vi.mocked(console.error).mockRestore();
    });
});

// Keeps React in scope for the JSX above under the classic runtime some configs use.
void React;

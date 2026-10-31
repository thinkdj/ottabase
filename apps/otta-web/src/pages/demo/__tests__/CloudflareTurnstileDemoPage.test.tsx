import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { siteKey, useTurnstile, api } = vi.hoisted(() => ({
    api: vi.fn(),
    siteKey: vi.fn<() => string | null>(() => null),
    useTurnstile: vi.fn((_action: string, _options?: { siteKey?: string | null }) => ({
        enabled: true,
        widget: null,
        error: null,
        headers: async () => ({ 'X-Turnstile-Token': 'tok' }),
    })),
}));

vi.mock('@ottabase/ui/turnstile', () => ({ turnstileSiteKey: siteKey, useTurnstile }));
vi.mock('@/lib/api', () => ({ api, isApiError: () => false }));
vi.mock('../DemoPageHeader', () => ({
    DemoPageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
        <header>
            <h1>{title}</h1>
            {actions}
        </header>
    ),
}));

import { TURNSTILE_TEST_KEYS } from '@ottabase/cf/turnstile';
import { CloudflareTurnstileDemoPage } from '../cloudflare/CloudflareTurnstileDemoPage';

beforeEach(() => {
    siteKey.mockReturnValue(null);
    useTurnstile.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe('CloudflareTurnstileDemoPage', () => {
    it('says the check is off and starts on the always-pass test key when the app has no keys', () => {
        render(<CloudflareTurnstileDemoPage />);
        expect(screen.getByText('Off in this app')).toBeTruthy();
        expect(screen.queryByRole('option', { name: "This app's keys" })).toBeNull();
        expect(useTurnstile).toHaveBeenLastCalledWith(
            'demo',
            expect.objectContaining({ siteKey: TURNSTILE_TEST_KEYS.site.pass }),
        );
    });

    it("offers the app's own keys first when they are set", () => {
        siteKey.mockReturnValue('app-site-key');
        render(<CloudflareTurnstileDemoPage />);
        expect(screen.getByText('On in this app')).toBeTruthy();
        expect(useTurnstile).toHaveBeenLastCalledWith('demo', expect.objectContaining({ siteKey: 'app-site-key' }));
    });

    it('sends the token with the chosen mode and shows the verdict', async () => {
        api.mockResolvedValue({
            data: { mode: 'block', ok: false, reason: 'invalid', codes: ['invalid-input-response'] },
        });
        render(<CloudflareTurnstileDemoPage />);
        fireEvent.change(screen.getByLabelText('Key'), { target: { value: 'block' } });
        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
        await waitFor(() => expect(screen.getByText('Failed')).toBeTruthy());
        expect(screen.getByText('Cloudflare refused the token.')).toBeTruthy();
        expect(api).toHaveBeenCalledWith('/api/cloudflare/turnstile', {
            method: 'POST',
            headers: { 'X-Turnstile-Token': 'tok' },
            body: { mode: 'block' },
        });
    });
});

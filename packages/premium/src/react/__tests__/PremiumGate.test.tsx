// @vitest-environment jsdom
// ============================================================
// The UI gate, exercised as a real component tree.
//
// The behaviour worth pinning is the one whose failure is SILENT: a gate that reads
// "allowed" before the server has answered flashes the paid feature to every visitor
// on every page load. The package's other suites run in `node` for Web Crypto
// fidelity; this file opts into jsdom locally rather than switching the whole package.
// ============================================================

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { PremiumProvider } from '../context';
import { PremiumBadge, PremiumGate } from '../PremiumGate';
import type { PremiumPackageStatus } from '../../types';

function status(overrides: Partial<PremiumPackageStatus> = {}): PremiumPackageStatus {
    return {
        key: 'webhooks',
        name: 'Webhooks',
        version: '1.0.0',
        state: 'active',
        reason: 'OK',
        enabled: true,
        requiresLicense: true,
        licenseSource: 'env',
        plan: 'pro',
        licensee: 'Acme',
        expiresAt: null,
        features: ['deliveries.log'],
        limits: { endpoints: 5 },
        installedVersion: '1.0.0',
        installedAt: 0,
        nav: [],
        purchaseUrl: 'https://example.com/pricing',
        ...overrides,
    };
}

function renderGate(node: ReactNode, request: ReturnType<typeof vi.fn>) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={queryClient}>
            <PremiumProvider request={request as never}>{node}</PremiumProvider>
        </QueryClientProvider>,
    );
}

afterEach(cleanup);

describe('PremiumGate', () => {
    it('renders children when the package is licensed', async () => {
        const request = vi.fn().mockResolvedValue([status()]);
        renderGate(<PremiumGate packageKey="webhooks">paid content</PremiumGate>, request);

        await waitFor(() => expect(screen.getByText('paid content')).toBeTruthy());
    });

    it('never shows the children while entitlements are still loading', async () => {
        const request = vi.fn().mockReturnValue(new Promise(() => {}));
        renderGate(<PremiumGate packageKey="webhooks">paid content</PremiumGate>, request);

        expect(screen.queryByText('paid content')).toBeNull();
    });

    it('shows the upsell with a plans link when unlicensed', async () => {
        const request = vi
            .fn()
            .mockResolvedValue([status({ enabled: false, state: 'unlicensed', reason: 'LICENSE_MISSING' })]);
        renderGate(<PremiumGate packageKey="webhooks">paid content</PremiumGate>, request);

        await waitFor(() => expect(screen.getByText(/No license key is installed/i)).toBeTruthy());
        expect(screen.queryByText('paid content')).toBeNull();
        expect(screen.getByRole('link', { name: /view plans/i }).getAttribute('href')).toBe(
            'https://example.com/pricing',
        );
    });

    it('gates on a feature within a licensed package', async () => {
        const request = vi.fn().mockResolvedValue([status()]);
        renderGate(
            <PremiumGate packageKey="webhooks" feature="custom-headers">
                header editor
            </PremiumGate>,
            request,
        );

        await waitFor(() => expect(screen.getByText(/not included in the current plan/i)).toBeTruthy());
    });

    it('renders a custom fallback when one is supplied', async () => {
        const request = vi
            .fn()
            .mockResolvedValue([status({ enabled: false, state: 'expired', reason: 'LICENSE_EXPIRED' })]);
        renderGate(
            <PremiumGate packageKey="webhooks" fallback={(answer) => <span>closed: {answer.reason}</span>}>
                paid content
            </PremiumGate>,
            request,
        );

        await waitFor(() => expect(screen.getByText(/closed: LICENSE_EXPIRED/)).toBeTruthy());
    });

    it('fails closed for a package the server does not know about', async () => {
        const request = vi.fn().mockResolvedValue([]);
        renderGate(<PremiumGate packageKey="ghost">paid content</PremiumGate>, request);

        await waitFor(() => expect(screen.getByText(/not installed/i)).toBeTruthy());
    });
});

describe('PremiumBadge', () => {
    it('marks a locked package and disappears once licensed', async () => {
        const locked = vi
            .fn()
            .mockResolvedValue([status({ enabled: false, state: 'unlicensed', reason: 'LICENSE_MISSING' })]);
        const { unmount } = renderGate(<PremiumBadge packageKey="webhooks" />, locked);
        await waitFor(() => expect(screen.getByText('Premium')).toBeTruthy());
        unmount();

        renderGate(<PremiumBadge packageKey="webhooks" />, vi.fn().mockResolvedValue([status()]));
        await waitFor(() => expect(screen.queryByText('Premium')).toBeNull());
    });
});

// @vitest-environment jsdom
// ============================================================
// The settings surface, exercised as a real component tree.
//
// These cover the three UI behaviours whose failure modes are SILENT and
// expensive: sending an empty `secret` on edit (which would destroy the stored
// key), showing the org-scope option where an org row can never be selected, and
// a gate that reads "allowed" before the server has answered.
//
// The package's other suites run in `node` for Web Crypto fidelity; this file
// opts into jsdom locally rather than switching the whole package.
// ============================================================

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiStatus } from '../../resolver';
import type { CredentialView } from '../../types';
import { AiProviderSettings } from '../AiProviderSettings';
import { AiProvisioningProvider } from '../context';
import { useAiGate } from '../hooks';

const PROVIDERS = [
    {
        id: 'openai',
        displayName: 'OpenAI',
        requiresKey: true,
        keyFormatHint: 'sk-…',
        docsUrl: null,
        allowCustomModel: true,
        models: [{ id: 'gpt-4o-mini', label: 'GPT-4o mini' }],
    },
];

function credential(overrides: Partial<CredentialView> = {}): CredentialView {
    return {
        id: 'cred-1',
        label: 'Work',
        provider: 'openai',
        model: 'gpt-4o-mini',
        keyHint: '••••abcd',
        hasSecret: true,
        secretKind: 'inline',
        enabled: true,
        isActive: true,
        scope: 'user',
        organizationId: null,
        userId: 'user-1',
        appId: 'app-1',
        createdAt: 1,
        updatedAt: 2,
        lastUsedAt: null,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorCode: null,
        consecutiveFailures: 0,
        ...overrides,
    };
}

function status(overrides: Partial<AiStatus> = {}): AiStatus {
    return {
        configured: true,
        source: 'byok',
        reason: 'SELECTED',
        tenantReason: null,
        provider: 'openai',
        model: 'openai/gpt-4o-mini',
        credentialId: 'cred-1',
        keyHint: '••••abcd',
        hasSecret: true,
        gates: { chat: { allowed: true, upsell: false, gate: 'soft', source: 'byok', reason: null } },
        strategy: 'user-then-org',
        orgScopeManageable: true,
        ...overrides,
    };
}

interface Harness {
    request: ReturnType<typeof vi.fn>;
    calls: Array<{ path: string; method: string; body: unknown }>;
}

function setup(options: { credentials?: CredentialView[]; status?: AiStatus } = {}) {
    const calls: Harness['calls'] = [];
    const request = vi.fn(async (path: string, init?: { method?: string; body?: unknown }) => {
        calls.push({ path, method: init?.method ?? 'GET', body: init?.body });
        if (path.endsWith('/providers')) return PROVIDERS;
        if (path.endsWith('/status')) return options.status ?? status();
        if (path.endsWith('/credentials') && (init?.method ?? 'GET') === 'GET') {
            return options.credentials ?? [];
        }
        return { id: 'cred-1' };
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return { request, calls, client };
}

function Wrapper({
    children,
    client,
    request,
}: {
    children: React.ReactNode;
    client: QueryClient;
    request: (path: string, init?: { method?: string; body?: unknown }) => Promise<unknown>;
}) {
    return (
        <QueryClientProvider client={client}>
            <AiProvisioningProvider basePath="" request={request as never}>
                {children}
            </AiProvisioningProvider>
        </QueryClientProvider>
    );
}

/**
 * Click "Connect a provider" only once it is actually enabled.
 *
 * The button is disabled while the provider registry loads (correctly — the form cannot
 * pick a default provider before then), and fireEvent on a disabled button is a silent
 * no-op that shows up as a confusing "element not found" three assertions later.
 */
async function openCreateForm() {
    const button = await screen.findByRole('button', { name: /Connect a provider/ });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    fireEvent.click(button);
}

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

describe('the write-only secret field', () => {
    it('does NOT send `secret` when the user edits without typing a key', async () => {
        // "Leave blank to keep the existing key" is the whole UX of a write-only secret.
        // Sending an empty string here would reach the model's rule 1 as a blank — which
        // KEEPS the key — but sending the field at all on a provider change would trip the
        // re-enter-the-key guard, and any future handler that treated '' as "clear" would
        // destroy a credential the user only meant to rename.
        const { request, calls, client } = setup({ credentials: [credential()] });

        render(
            <Wrapper client={client} request={request}>
                <AiProviderSettings />
            </Wrapper>,
        );

        await screen.findByText('Work');
        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

        const label = await screen.findByLabelText('Name');
        fireEvent.change(label, { target: { value: 'Renamed' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => {
            expect(calls.some((c) => c.method === 'PATCH')).toBe(true);
        });
        const patch = calls.find((c) => c.method === 'PATCH')!;
        expect(patch.body).toMatchObject({ label: 'Renamed' });
        expect(patch.body).not.toHaveProperty('secret');
    });

    it('never prefills the key field on edit', async () => {
        const { request, client } = setup({ credentials: [credential()] });
        render(
            <Wrapper client={client} request={request}>
                <AiProviderSettings />
            </Wrapper>,
        );

        await screen.findByText('Work');
        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

        const secret = (await screen.findByLabelText('API key')) as HTMLInputElement;
        expect(secret.value).toBe('');
        expect(secret.type).toBe('password');
        // Without this, a password manager saves the provider key and later autofills it,
        // corrupting "leave blank to keep" and storing the key somewhere new.
        expect(secret.getAttribute('autocomplete')).toBe('off');
    });

    it('sends the typed key when the user actually enters one', async () => {
        const { request, calls, client } = setup({ credentials: [credential()] });
        render(
            <Wrapper client={client} request={request}>
                <AiProviderSettings />
            </Wrapper>,
        );

        await screen.findByText('Work');
        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
        fireEvent.change(await screen.findByLabelText('API key'), { target: { value: 'sk-new-key-value' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
        expect(calls.find((c) => c.method === 'PATCH')!.body).toMatchObject({ secret: 'sk-new-key-value' });
    });
});

describe('the org-scope option follows SERVER truth', () => {
    it('is hidden when the strategy cannot select an org row, even with allowOrgScope', async () => {
        const { request, client } = setup({ status: status({ orgScopeManageable: false, strategy: 'user' }) });
        render(
            <Wrapper client={client} request={request}>
                <AiProviderSettings allowOrgScope />
            </Wrapper>,
        );

        await openCreateForm();
        await screen.findByLabelText('Name');
        expect(screen.queryByLabelText('Who can use this key')).toBeNull();
    });

    it('is shown when the server says an org row is selectable', async () => {
        const { request, client } = setup({ status: status({ orgScopeManageable: true }) });
        render(
            <Wrapper client={client} request={request}>
                <AiProviderSettings allowOrgScope />
            </Wrapper>,
        );

        await openCreateForm();
        expect(await screen.findByLabelText('Who can use this key')).toBeTruthy();
    });
});

describe('"Currently in use" reports the resolver, not the list', () => {
    it('says the tenant key is in use when the server resolved one', async () => {
        const { request, client } = setup({ credentials: [credential()] });
        render(
            <Wrapper client={client} request={request}>
                <AiProviderSettings />
            </Wrapper>,
        );
        expect(await screen.findByText('Your key')).toBeTruthy();
    });

    it('explains WHY the tenant path lost when running on the platform', async () => {
        const { request, client } = setup({
            status: status({ source: 'platform', reason: 'PLATFORM_FALLBACK', tenantReason: 'ALL_DISABLED' }),
        });
        render(
            <Wrapper client={client} request={request}>
                <AiProviderSettings />
            </Wrapper>,
        );
        // Without `tenantReason`, `auto` flattens every distinct cause into PLATFORM_FALLBACK
        // and this question becomes permanently unanswerable.
        expect(await screen.findByText(/paused/i)).toBeTruthy();
    });
});

describe('a dormant deployment', () => {
    it('renders nothing when the routes answer 501 NOT_CONFIGURED', async () => {
        // The app's enable flag is build-time and cannot see the server's keyring, so this
        // component IS mounted on a deployment with no AI secret. Showing a "Connect a
        // provider" card whose every request 501s is the bug this closes.
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const request = vi.fn(async () => {
            throw Object.assign(new Error('AI is not configured on this deployment.'), {
                status: 501,
                code: 'NOT_CONFIGURED',
            });
        });

        const { container } = render(
            <Wrapper client={client} request={request as never}>
                <AiProviderSettings />
            </Wrapper>,
        );

        await waitFor(() => expect(container.firstChild).toBeNull());
        expect(screen.queryByRole('button', { name: /Connect a provider/ })).toBeNull();
    });
});

describe('useAiGate fails closed', () => {
    function GateProbe({ taskKey }: { taskKey: string }) {
        const gate = useAiGate(taskKey);
        return <span data-testid="gate">{`${gate.allowed}:${gate.reason ?? ''}`}</span>;
    }

    it('denies when rendered OUTSIDE the provider', () => {
        // A convenience no-op that ALLOWED the action would silently lose the gate for any
        // component mounted outside the tree.
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <GateProbe taskKey="chat" />
            </QueryClientProvider>,
        );
        expect(screen.getByTestId('gate').textContent).toBe('false:NO_PROVIDER');
    });

    it('denies while status is still loading, then reflects the server answer', async () => {
        const { request, client } = setup();
        render(
            <Wrapper client={client} request={request}>
                <GateProbe taskKey="chat" />
            </Wrapper>,
        );
        expect(screen.getByTestId('gate').textContent).toBe('false:LOADING');
        await waitFor(() => expect(screen.getByTestId('gate').textContent).toBe('true:'));
    });

    it('denies an unknown task rather than defaulting to allowed', async () => {
        const { request, client } = setup();
        render(
            <Wrapper client={client} request={request}>
                <GateProbe taskKey="not-a-declared-task" />
            </Wrapper>,
        );
        await waitFor(() => expect(request).toHaveBeenCalled());
        expect(screen.getByTestId('gate').textContent).toContain('false');
    });
});

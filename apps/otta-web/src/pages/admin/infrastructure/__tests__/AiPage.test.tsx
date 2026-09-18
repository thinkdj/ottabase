import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ottabase/ottaorm/client', () => ({
    useApiQuery: () => ({
        data: {
            packageEnabled: true,
            configured: true,
            byokConfigured: true,
            configurationError: null,
            transport: {
                name: 'cloudflare-ai-gateway',
                docsUrl: 'https://developers.cloudflare.com/ai-gateway/',
                getStartedUrl: 'https://developers.cloudflare.com/ai-gateway/get-started/',
            },
            gateway: {
                accountId: 'acct-1',
                name: 'production',
                tokenPresent: true,
                apiTokenPresent: false,
                source: 'env',
                proxyUrl: 'https://gateway.ai.cloudflare.com/v1/acct-1/production',
                dashboardUrl: 'https://dash.cloudflare.com/acct-1/ai/ai-gateway',
                docsUrl: 'https://developers.cloudflare.com/ai-gateway/',
            },
            dials: {
                mode: 'auto',
                strategy: 'user-then-org',
                appScope: 'strict',
                byokEnabled: true,
                allowOrgCredentials: true,
            },
            platform: {
                provider: 'openai',
                model: 'gpt-4o-mini',
                providerKeyPresent: true,
                providerKeyEnv: 'CFAI_OPENAI_API_KEY',
                billing: 'provider-key',
                routeUsable: true,
                missing: [],
                azure: { configured: false, resourceName: false, deploymentName: false, apiVersion: false },
            },
            rateLimit: { perUser: 20, perOrganization: 120, perApp: 600 },
            spend: { warning: null, kvBound: true },
            keyring: { present: true, currentKeyId: 'k1', keyIds: ['k1'], source: 'secret' },
            secrets: [
                {
                    key: 'CFAI_GATEWAY_TOKEN',
                    present: true,
                    role: 'optional',
                    note: 'Required only when the gateway is authenticated.',
                },
            ],
            tasks: [
                {
                    key: 'assist',
                    label: 'Assistant',
                    mode: null,
                    gate: 'soft',
                    modelPolicy: 'tenant-preferred',
                    defaultModel: null,
                    requiredCapabilities: [],
                    pinnedModels: null,
                },
            ],
            providers: [
                {
                    id: 'openai',
                    displayName: 'OpenAI',
                    tenantSelectable: true,
                    requiresKey: true,
                    wireVerified: true,
                    unservable: false,
                    docsUrl: 'https://platform.openai.com/api-keys',
                    gatewayDocs: 'https://developers.cloudflare.com/ai-gateway/usage/providers/openai/',
                    keyEnv: 'CFAI_OPENAI_API_KEY',
                },
            ],
            bindings: { kv: true, workersAi: true },
        },
        isLoading: false,
        error: null,
    }),
}));

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('lucide-react', () => ({
    AlertTriangle: () => null,
    CheckCircle2: () => null,
    Copy: () => null,
    ExternalLink: () => null,
    KeyRound: () => null,
    Server: () => null,
    Sparkles: () => null,
    Waypoints: () => null,
}));

vi.mock('@ottabase/ui-shadcn', () => ({
    Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Button: ({
        children,
        asChild: _asChild,
        ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => <button {...props}>{children}</button>,
    Card: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
    CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

import { AdminAiPage } from '../AiPage';

describe('AdminAiPage', () => {
    it('renders the live gateway identity and operator dials', () => {
        render(<AdminAiPage />);

        expect(screen.getByRole('heading', { name: 'AI Gateway' })).toBeTruthy();
        expect(screen.getByText('cloudflare-ai-gateway')).toBeTruthy();
        expect(screen.getByText('user-then-org')).toBeTruthy();
        expect(screen.getByText('Assistant')).toBeTruthy();
        expect(screen.getByText('CFAI_GATEWAY_TOKEN')).toBeTruthy();
        expect(screen.getAllByText(/production/).length).toBeGreaterThan(0);
        expect(screen.queryByText(/sk-/)).toBeNull();
    });
});

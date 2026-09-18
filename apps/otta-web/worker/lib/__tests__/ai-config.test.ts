import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAiConfigSnapshot } from '../ai-config';
import { TEST_MASTER_SECRET } from '@ottabase/ottaai/testing';

const SECRET_VALUE = 'sk-platform-key-MUST-NOT-LEAK';
const GATEWAY_TOKEN = 'cf-aig-token-MUST-NOT-LEAK';
const MASTER = TEST_MASTER_SECRET;

function env(overrides: Record<string, unknown> = {}): CloudflareEnv {
    return {
        AI_CREDENTIAL_SECRET: MASTER,
        CLOUDFLARE_ACCOUNT_ID: 'acc-000000000000000000000000000000000',
        CFAI_GATEWAY_NAME: 'production',
        CFAI_GATEWAY_TOKEN: GATEWAY_TOKEN,
        OTTAAI_PLATFORM_PROVIDER: 'openai',
        OTTAAI_PLATFORM_MODEL: 'gpt-4o-mini',
        CFAI_OPENAI_API_KEY: SECRET_VALUE,
        OBCF_KV: { get: async () => null, put: async () => undefined },
        ...overrides,
    } as unknown as CloudflareEnv;
}

describe('getAiConfigSnapshot', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reports a usable Cloudflare AI Gateway platform route without echoing secrets', () => {
        const snapshot = getAiConfigSnapshot(env());
        const encoded = JSON.stringify(snapshot);

        expect(snapshot.packageEnabled).toBe(true);
        expect(snapshot.configured).toBe(true);
        expect(snapshot.transport.name).toBe('cloudflare-ai-gateway');
        expect(snapshot.gateway.name).toBe('production');
        expect(snapshot.gateway.accountId).toBe('acc-000000000000000000000000000000000');
        expect(snapshot.gateway.tokenPresent).toBe(true);
        expect(snapshot.gateway.proxyUrl).toContain('/production');
        expect(snapshot.platform.routeUsable).toBe(true);
        expect(snapshot.platform.provider).toBe('openai');
        expect(snapshot.platform.providerKeyPresent).toBe(true);
        expect(snapshot.keyring.present).toBe(true);
        expect(snapshot.keyring.source).toBe('secret');

        expect(encoded).not.toContain(SECRET_VALUE);
        expect(encoded).not.toContain(GATEWAY_TOKEN);
        expect(encoded).not.toContain(MASTER);
        expect(snapshot.secrets.find((item) => item.key === 'CFAI_OPENAI_API_KEY')?.present).toBe(true);
        expect(snapshot.providers.find((item) => item.id === 'azure')?.unservable).toBe(true);
    });

    it('stays honest when the keyring is missing — dormant, not a crash', () => {
        const snapshot = getAiConfigSnapshot(env({ AI_CREDENTIAL_SECRET: undefined }));
        expect(snapshot.configured).toBe(false);
        expect(snapshot.keyring.present).toBe(false);
        expect(snapshot.configurationError).toBeNull();
    });

    it('does not require a tenant keyring for a platform-only deployment', () => {
        const snapshot = getAiConfigSnapshot(env({ AI_CREDENTIAL_SECRET: undefined, OTTAAI_BYOK_ENABLED: 'false' }));
        expect(snapshot.dials.byokEnabled).toBe(false);
        expect(snapshot.configured).toBe(true);
        expect(snapshot.byokConfigured).toBe(false);
        expect(snapshot.platform.routeUsable).toBe(true);
    });

    it('reports a Unified Billing route only when its Cloudflare API token is present', () => {
        const base = {
            CFAI_OPENAI_API_KEY: undefined,
            CFAI_GATEWAY_TOKEN: undefined,
            OTTAAI_PLATFORM_BILLING: 'unified',
        };
        expect(getAiConfigSnapshot(env(base)).platform.routeUsable).toBe(false);

        const snapshot = getAiConfigSnapshot(env({ ...base, CFAI_API_TOKEN: 'cf-api-token-MUST-NOT-LEAK' }));
        expect(snapshot.platform.billing).toBe('unified');
        expect(snapshot.gateway.apiTokenPresent).toBe(true);
        expect(snapshot.platform.routeUsable).toBe(true);
        expect(JSON.stringify(snapshot)).not.toContain('cf-api-token-MUST-NOT-LEAK');
    });

    it('does not claim platformModel is missing when a task supplies the effective model', () => {
        const snapshot = getAiConfigSnapshot(
            env({
                OTTAAI_PLATFORM_MODEL: undefined,
                OTTAAI_PLATFORM_BILLING: 'unified',
                CFAI_OPENAI_API_KEY: undefined,
                CFAI_GATEWAY_TOKEN: undefined,
                CFAI_API_TOKEN: 'cf-api-token-MUST-NOT-LEAK',
            }),
        );

        expect(snapshot.platform.routeUsable).toBe(true);
        expect(snapshot.platform.missing).toContainEqual(expect.stringMatching(/missing for: assist/));
        expect(snapshot.platform.missing).not.toContain('Set features.ottaai.platformModel.');
    });

    it('reports dynamic Unified tasks while preserving readiness for tasks with explicit models', () => {
        const snapshot = getAiConfigSnapshot(
            env({
                CFAI_OPENAI_API_KEY: undefined,
                CFAI_GATEWAY_TOKEN: undefined,
                CFAI_API_TOKEN: 'cf-api-token-MUST-NOT-LEAK',
                OTTAAI_PLATFORM_BILLING: 'unified',
                OTTAAI_PLATFORM_MODEL: 'dynamic/paid-route',
            }),
        );

        // The embedding task has its own OpenAI model and remains callable; chat tasks that
        // fall through to the dynamic platform default are named in the configuration notes.
        expect(snapshot.platform.routeUsable).toBe(true);
        expect(snapshot.platform.missing).toContainEqual(expect.stringMatching(/cannot serve dynamic routes/));
    });

    it('marks Azure servable only when all three destination values are set', () => {
        const incomplete = getAiConfigSnapshot(env({ CFAI_AZURE_RESOURCE_NAME: 'res' }));
        expect(incomplete.platform.azure.configured).toBe(false);
        expect(incomplete.providers.find((item) => item.id === 'azure')?.unservable).toBe(true);

        const complete = getAiConfigSnapshot(
            env({
                CFAI_AZURE_RESOURCE_NAME: 'res',
                CFAI_AZURE_DEPLOYMENT_NAME: 'dep',
                CFAI_AZURE_API_VERSION: '2024-10-21',
            }),
        );
        expect(complete.platform.azure.configured).toBe(true);
        expect(complete.providers.find((item) => item.id === 'azure')?.unservable).toBe(false);
    });
});

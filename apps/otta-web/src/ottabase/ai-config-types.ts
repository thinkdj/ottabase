/**
 * Redacted, serialisable contract returned by the AI Gateway admin endpoint.
 * It lives in app source so the browser never needs to type-check Worker modules.
 */
export interface AiConfigSecretPresence {
    key: string;
    present: boolean;
    role: 'required' | 'optional' | 'platform' | 'azure';
    note: string;
}

export interface AiConfigSnapshot {
    packageEnabled: boolean;
    configured: boolean;
    byokConfigured: boolean;
    configurationError: string | null;
    transport: { name: 'cloudflare-ai-gateway'; docsUrl: string; getStartedUrl: string };
    gateway: {
        accountId: string | null;
        name: string | null;
        tokenPresent: boolean;
        apiTokenPresent: boolean;
        source: 'config' | 'env' | null;
        proxyUrl: string | null;
        dashboardUrl: string | null;
        docsUrl: string;
    };
    dials: { mode: string; strategy: string; appScope: string; byokEnabled: boolean; allowOrgCredentials: boolean };
    platform: {
        provider: string | null;
        model: string | null;
        providerKeyPresent: boolean;
        providerKeyEnv: string | null;
        billing: 'provider-key' | 'unified' | null;
        routeUsable: boolean;
        missing: string[];
        azure: { configured: boolean; resourceName: boolean; deploymentName: boolean; apiVersion: boolean };
    };
    rateLimit: { perUser: number; perOrganization: number; perApp: number };
    spend: { warning: string | null; kvBound: boolean };
    keyring: { present: boolean; currentKeyId: string | null; keyIds: string[]; source: 'secret' | 'keyring' | null };
    secrets: AiConfigSecretPresence[];
    tasks: Array<{
        key: string;
        label: string;
        mode: string | null;
        gate: string;
        modelPolicy: string;
        defaultModel: string | null;
        requiredCapabilities: string[];
        pinnedModels: Record<string, string> | null;
    }>;
    providers: Array<{
        id: string;
        displayName: string;
        tenantSelectable: boolean;
        requiresKey: boolean;
        wireVerified: boolean;
        unservable: boolean;
        docsUrl: string | null;
        gatewayDocs: string | null;
        keyEnv: string;
    }>;
    bindings: { kv: boolean; workersAi: boolean };
}

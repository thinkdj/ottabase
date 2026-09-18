// ====================================================================
// otta-web — redacted OttaAI / AI Gateway operator snapshot
// --------------------------------------------------------------------
// WHAT AN OPERATOR CAN SEE WITHOUT OPENING .dev.vars. Secrets never leave this
// file as values — only present/absent, plus the non-secret dials already frozen
// in `features.ottaai`. The growth BYOK page is the tenant surface; this is the
// control-plane answer to "what is this deployment actually running?"
// ====================================================================

import { createProviderRegistry, resolveEffectiveTaskPolicy } from '@ottabase/ottaai';
import { createGatewayTransport, GATEWAY_PROVIDERS } from '@ottabase/ottaai/transports/gateway';
import type { AiConfigSecretPresence, AiConfigSnapshot } from '../../src/ottabase/ai-config-types';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { AI_TASK_POLICIES, buildAiKeyring, platformProviderKey, platformTransportConfig } from './ai';
import { platformSpendWarning } from './ai-rate-limit';

export const AI_GATEWAY_DOCS_URL = 'https://developers.cloudflare.com/ai-gateway/';
export const AI_GATEWAY_GET_STARTED_URL = 'https://developers.cloudflare.com/ai-gateway/get-started/';
const GATEWAY_PROXY_BASE = 'https://gateway.ai.cloudflare.com/v1';

function envRecord(env: CloudflareEnv): Record<string, string | undefined> {
    return env as unknown as Record<string, string | undefined>;
}

function envPresent(env: CloudflareEnv, key: string): boolean {
    const value = envRecord(env)[key];
    return typeof value === 'string' && value.trim().length > 0;
}

function providerKeyEnvName(provider: string): string {
    return `CFAI_${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
}

function cloudflareDashboardUrl(accountId: string | null): string | null {
    if (!accountId) return null;
    return `https://dash.cloudflare.com/${encodeURIComponent(accountId)}/ai/ai-gateway`;
}

function gatewayProxyUrl(accountId: string | null, gateway: string | null): string | null {
    if (!accountId || !gateway) return null;
    return `${GATEWAY_PROXY_BASE}/${accountId}/${gateway}`;
}

/**
 * Redacted operator snapshot. Safe to serialise: no provider keys, no master secret,
 * no gateway token. Account id and gateway slug are deployment identity, not credentials.
 */
export function getAiConfigSnapshot(env: CloudflareEnv): AiConfigSnapshot {
    const config = getOttabaseConfig(env as unknown as Record<string, unknown>);
    const feature = config.features.ottaai;
    const packageEnabled = config.packages.ottaai === true;
    const vars = envRecord(env);

    const accountId = vars.CLOUDFLARE_ACCOUNT_ID?.trim() || null;
    const configGateway = typeof feature.gateway === 'string' && feature.gateway.trim() ? feature.gateway.trim() : null;
    const envGateway = vars.CFAI_GATEWAY_NAME?.trim() || null;
    const gateway = configGateway ?? envGateway;
    const gatewaySource: 'config' | 'env' | null = configGateway ? 'config' : envGateway ? 'env' : null;
    const platformProvider = feature.platformProvider ?? null;
    const platformModel = feature.platformModel ?? null;
    const providerKey = platformProviderKey(env, platformProvider)?.trim() || undefined;
    const billing: 'provider-key' | 'unified' | undefined = providerKey
        ? 'provider-key'
        : feature.platformBilling === 'unified'
          ? 'unified'
          : undefined;
    const azureBag = platformTransportConfig(env);
    const azureConfigured = Boolean(azureBag);
    const transportConfig = azureBag ?? {};

    let configurationError: string | null = null;
    let keyringPresent = false;
    let currentKeyId: string | null = null;
    let keyIds: string[] = [];
    try {
        const keyring = buildAiKeyring(env);
        if (keyring) {
            keyringPresent = true;
            currentKeyId = keyring.currentKeyId;
            keyIds = keyring.keyIds();
        }
    } catch (error) {
        configurationError = error instanceof Error ? error.message : String(error);
    }

    const transport = createGatewayTransport();
    const platform = {
        accountId: accountId ?? undefined,
        gateway: gateway ?? undefined,
        gatewayToken: vars.CFAI_GATEWAY_TOKEN?.trim() || undefined,
        apiToken: vars.CFAI_API_TOKEN?.trim() || undefined,
        provider: platformProvider ?? undefined,
        providerKey,
        billing,
        model: platformModel ?? undefined,
        transportConfig: azureConfigured ? transportConfig : undefined,
    };
    const unservable = new Set(transport.unservableProviders?.(platform) ?? []);
    const resolvedTasks = AI_TASK_POLICIES.map((task) =>
        resolveEffectiveTaskPolicy(task, {
            appMode: feature.byokEnabled ? feature.mode : 'platform',
            byokEnabled: feature.byokEnabled,
        }),
    );
    const effectiveTaskModel = (task: (typeof resolvedTasks)[number]): string | null => {
        const pinned =
            task.modelPolicy === 'task-pinned' && platformProvider ? task.pinnedModels?.[platformProvider] : undefined;
        return pinned ?? task.defaultModel ?? platformModel ?? null;
    };
    const transportRouteUsable = resolvedTasks.some((task) => {
        return transport.isComplete({
            provider: platformProvider ?? '',
            model: effectiveTaskModel(task),
            secret: null,
            alias: null,
            accountId: accountId ?? undefined,
            gateway: gateway ?? undefined,
            gatewayToken: vars.CFAI_GATEWAY_TOKEN?.trim() || undefined,
            apiToken: vars.CFAI_API_TOKEN?.trim() || undefined,
            billing,
            transportConfig,
            provenance: {
                source: 'platform',
                credentialId: null,
                taskKey: task.key,
                appId: config.appId,
                organizationId: null,
                userId: null,
            },
        });
    });
    const provisioningConfigured = packageEnabled && (!feature.byokEnabled || keyringPresent);
    // Match getAiProvisioning(): a valid platform transport is not callable while the
    // package is disabled or BYOK is enabled without encryption custody.
    const routeUsable = provisioningConfigured && transportRouteUsable;

    const missing: string[] = [];
    if (!packageEnabled) missing.push('Enable the ottaai package.');
    if (feature.byokEnabled && !keyringPresent)
        missing.push('Set AI_CREDENTIAL_SECRET or AI_CREDENTIAL_KEYRING while BYOK is enabled.');
    if (!accountId) missing.push('Set CLOUDFLARE_ACCOUNT_ID.');
    if (!gateway) missing.push('Set features.ottaai.gateway or CFAI_GATEWAY_NAME.');
    if (billing === 'unified') {
        if (!envPresent(env, 'CFAI_API_TOKEN'))
            missing.push('Set CFAI_API_TOKEN (Workers AI Read) for Unified Billing.');
    } else if (!envPresent(env, 'CFAI_GATEWAY_TOKEN')) {
        missing.push('Set CFAI_GATEWAY_TOKEN for authenticated Gateway access.');
    }
    if (feature.byokEnabled && !envPresent(env, 'CFAI_GATEWAY_TOKEN')) {
        missing.push('Set CFAI_GATEWAY_TOKEN: tenant BYOK calls use authenticated provider-native Gateway routes.');
    }
    const modellessTasks = resolvedTasks.filter((task) => !effectiveTaskModel(task)).map((task) => task.key);
    if (modellessTasks.length > 0) {
        missing.push(
            `Set features.ottaai.platformModel or declare a task default model (missing for: ${modellessTasks.join(', ')}).`,
        );
    }
    if (billing === 'unified') {
        const dynamicTasks = resolvedTasks
            .filter((task) => effectiveTaskModel(task)?.trim().startsWith('dynamic/'))
            .map((task) => task.key);
        if (dynamicTasks.length > 0) {
            missing.push(
                `Unified Billing cannot serve dynamic routes for tasks: ${dynamicTasks.join(', ')}. ` +
                    'Give those tasks an explicit REST model or use provider-native Gateway authentication.',
            );
        }
    }
    if (!platformModel?.startsWith('dynamic/') && !platformProvider)
        missing.push('Set features.ottaai.platformProvider, or use a dynamic/<route> model.');
    if (!providerKey && billing !== 'unified')
        missing.push('Set the provider key or features.ottaai.platformBilling="unified".');

    const kvBound = Boolean(env.OBCF_KV);
    const spendWarning = platformSpendWarning(env, routeUsable, feature.rateLimit);
    const registry = createProviderRegistry();
    const tenantSelectableIds = new Set(registry.tenantSelectable().map((entry) => entry.id));

    const secrets: AiConfigSecretPresence[] = [
        {
            key: 'AI_CREDENTIAL_SECRET',
            present: envPresent(env, 'AI_CREDENTIAL_SECRET'),
            role: 'required',
            note: 'Master secret for tenant keys at rest. Either this or AI_CREDENTIAL_KEYRING.',
        },
        {
            key: 'AI_CREDENTIAL_KEYRING',
            present: envPresent(env, 'AI_CREDENTIAL_KEYRING'),
            role: 'optional',
            note: 'JSON map of key ids → secrets. Use instead of AI_CREDENTIAL_SECRET for rotation.',
        },
        {
            key: 'AI_CREDENTIAL_KEY_ID',
            present: envPresent(env, 'AI_CREDENTIAL_KEY_ID'),
            role: 'optional',
            note: 'Write-key id when a keyring is set.',
        },
        {
            key: 'CLOUDFLARE_ACCOUNT_ID',
            present: Boolean(accountId),
            role: 'required',
            note: 'AI Gateway path segment. Also used by analytics.',
        },
        {
            key: 'CFAI_GATEWAY_NAME',
            present: envPresent(env, 'CFAI_GATEWAY_NAME'),
            role: 'required',
            note: 'Gateway slug environment override. A config-file value is reported separately.',
        },
        {
            key: 'CFAI_GATEWAY_TOKEN',
            present: envPresent(env, 'CFAI_GATEWAY_TOKEN'),
            role: 'required',
            note: 'Required for provider-native, authenticated Cloudflare AI Gateway calls.',
        },
        {
            key: 'CFAI_API_TOKEN',
            present: envPresent(env, 'CFAI_API_TOKEN'),
            role: 'platform',
            note: 'Workers AI Read token used only for Cloudflare Unified Billing REST calls.',
        },
        {
            key: 'CFAI_AZURE_RESOURCE_NAME',
            present: envPresent(env, 'CFAI_AZURE_RESOURCE_NAME'),
            role: 'azure',
            note: 'Azure destination. All three Azure values, or none.',
        },
        {
            key: 'CFAI_AZURE_DEPLOYMENT_NAME',
            present: envPresent(env, 'CFAI_AZURE_DEPLOYMENT_NAME'),
            role: 'azure',
            note: 'Azure destination. All three Azure values, or none.',
        },
        {
            key: 'CFAI_AZURE_API_VERSION',
            present: envPresent(env, 'CFAI_AZURE_API_VERSION'),
            role: 'azure',
            note: 'Azure destination. All three Azure values, or none.',
        },
    ];

    const providers = registry.list().map((entry) => {
        const keyEnv = providerKeyEnvName(entry.id);
        const adapter = GATEWAY_PROVIDERS[entry.id];
        const unservableHere = unservable.has(entry.id);
        return {
            id: entry.id,
            displayName: entry.displayName,
            tenantSelectable: tenantSelectableIds.has(entry.id) && !unservableHere,
            requiresKey: entry.requiresKey,
            wireVerified: Boolean(adapter),
            unservable: unservableHere,
            docsUrl: entry.docsUrl ?? null,
            gatewayDocs: adapter?.docs ?? null,
            keyEnv,
        };
    });

    for (const provider of providers) {
        if (!provider.requiresKey) continue;
        secrets.push({
            key: provider.keyEnv,
            present: envPresent(env, provider.keyEnv),
            role: 'platform',
            note:
                provider.id === platformProvider
                    ? 'Platform-floor key for the declared provider.'
                    : `Optional platform key if you set platformProvider to "${provider.id}".`,
        });
    }

    const keyringSource: 'secret' | 'keyring' | null = !keyringPresent
        ? null
        : envPresent(env, 'AI_CREDENTIAL_KEYRING')
          ? 'keyring'
          : 'secret';

    return {
        packageEnabled,
        configured: provisioningConfigured,
        byokConfigured: keyringPresent,
        configurationError,
        transport: {
            name: 'cloudflare-ai-gateway',
            docsUrl: AI_GATEWAY_DOCS_URL,
            getStartedUrl: AI_GATEWAY_GET_STARTED_URL,
        },
        gateway: {
            accountId,
            name: gateway,
            tokenPresent: envPresent(env, 'CFAI_GATEWAY_TOKEN'),
            apiTokenPresent: envPresent(env, 'CFAI_API_TOKEN'),
            source: gatewaySource,
            proxyUrl: gatewayProxyUrl(accountId, gateway),
            dashboardUrl: cloudflareDashboardUrl(accountId),
            docsUrl: AI_GATEWAY_DOCS_URL,
        },
        dials: {
            mode: feature.mode,
            strategy: feature.strategy,
            appScope: feature.appScope,
            byokEnabled: feature.byokEnabled,
            allowOrgCredentials: feature.allowOrgCredentials,
        },
        platform: {
            provider: platformProvider,
            model: platformModel,
            providerKeyPresent: Boolean(providerKey),
            providerKeyEnv: platformProvider ? providerKeyEnvName(platformProvider) : null,
            billing: billing ?? null,
            routeUsable,
            missing,
            azure: {
                configured: azureConfigured,
                resourceName: envPresent(env, 'CFAI_AZURE_RESOURCE_NAME'),
                deploymentName: envPresent(env, 'CFAI_AZURE_DEPLOYMENT_NAME'),
                apiVersion: envPresent(env, 'CFAI_AZURE_API_VERSION'),
            },
        },
        rateLimit: {
            perUser: feature.rateLimit.perUser,
            perOrganization: feature.rateLimit.perOrganization,
            perApp: feature.rateLimit.perApp,
        },
        spend: {
            warning: spendWarning,
            kvBound,
        },
        keyring: {
            present: keyringPresent,
            currentKeyId,
            keyIds,
            source: keyringSource,
        },
        secrets,
        tasks: resolvedTasks.map((resolved) => {
            return {
                key: resolved.key,
                label: resolved.label ?? resolved.key,
                mode: resolved.mode ?? null,
                gate: resolved.gate,
                modelPolicy: resolved.modelPolicy,
                defaultModel: resolved.defaultModel ?? null,
                requiredCapabilities: resolved.requiredCapabilities ?? [],
                pinnedModels: resolved.pinnedModels ?? null,
            };
        }),
        providers,
        bindings: {
            kv: kvBound,
            workersAi: Boolean((env as unknown as { OBCF_AI?: unknown }).OBCF_AI),
        },
    };
}

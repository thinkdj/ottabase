import { definePackage, type OttaPackage, type PackageExtras } from '@ottabase/kernel';
import type { ModelRLSConfig, SecurityContext } from '@ottabase/ottaorm';
import { ApiKey } from './ottaorm-models/ApiKey';
import { createApiKeysRouter, type ApiKeysRouterOptions } from './routes';
import { apiKeysTable } from './schema';

export const APIKEYS_PACKAGE_KEY = 'apikeys';
export const APIKEYS_BASE_PATH = '/api/keys';

/** A user sees their own keys and, inside an organization they belong to, that organization's. */
function apiKeyFilter(context: SecurityContext): Record<string, unknown> | null {
    if (!context.appId || !context.userId) return null;
    const organizationId = context.organizationId ?? null;
    if (organizationId === null) return { appId: context.appId, organizationId: '', userId: context.userId };
    if (context.platformAdmin !== true) {
        if (!Array.isArray(context.memberOrganizationIds) || !context.memberOrganizationIds.includes(organizationId)) {
            return null;
        }
    }
    return { appId: context.appId, organizationId };
}

export const apiKeysPolicies: ModelRLSConfig[] = [
    {
        model: 'api_keys',
        policy: { level: 'custom', filter: apiKeyFilter, readOnly: true },
        contextFields: ['organizationId', 'appId', 'userId'],
        auditEnabled: true,
    },
];

export interface ApiKeysPackageOptions<Env> extends ApiKeysRouterOptions<Env>, PackageExtras<Env> {
    /** Default `/api/keys`. */
    basePath?: string;
}

/** The API keys package as the app registers it: the table, its model and policy, and the self-service routes. */
export function createApiKeysPackage<Env = unknown>(options: ApiKeysPackageOptions<Env>): OttaPackage<Env> {
    const { keys, resolveCaller, allowedScopes, basePath = APIKEYS_BASE_PATH, ...extras } = options;
    return definePackage<Env>({
        key: APIKEYS_PACKAGE_KEY,
        name: 'API keys',
        version: '1.0.0',
        description: 'Keys your customers create to call your API: hashed, scoped, expiring, revocable, shown once.',
        tables: { apiKeysTable },
        models: [ApiKey],
        policies: apiKeysPolicies,
        routes: {
            basePath,
            build: () => createApiKeysRouter<Env>({ keys, resolveCaller, allowedScopes }),
        },
        ...extras,
    });
}

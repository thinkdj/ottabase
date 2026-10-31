import { createD1Driver } from '@ottabase/db/drizzle-d1';
import {
    clearConnection,
    configureOttaORM,
    hasConnection,
    initRLS,
    registerConnection,
    registerModels,
    registerPolicy,
} from '@ottabase/ottaorm';
import {
    Account,
    Media,
    Organization,
    OrganizationMember,
    Permission,
    Role,
    ScheduledTask,
    UserGroup,
    UserGroupMember,
    UserRole,
    VerificationToken,
} from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { files } from '../../ottabase/files';
import { mediaLibraryPolicy } from '../../ottabase/models/mediaLibraryPolicy';
import { packages } from '../../ottabase/registry';
import { readJson } from './utils';

let initializedD1Binding: CloudflareEnv['OBCF_D1'] | null = null;
let dbConnectionReady = false;

export function initAdminCron(env: CloudflareEnv): Response | null {
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    // filesPublicUrl: what `User#imageUrl()` builds avatar URLs on (the public files bucket, absolute).
    configureOttaORM({ maxAllRows: env.OTTAORM_MAX_ALL_ROWS, filesPublicUrl: files.publicBase(env) });
    registerConnection('default', createD1Driver(env.OBCF_D1));
    return null;
}

export async function checkMigrationAuth(
    request: { url: string; method: string; headers: { get(name: string): string | null }; json(): Promise<unknown> },
    env: CloudflareEnv,
): Promise<boolean> {
    // Deliberately narrower than isDevEnvironment(): this gates schema auto-migrations
    // (including destructive ones), so ONLY an explicit 'development' ENVIRONMENT bypasses
    // MIGRATION_SECRET. An UNSET ENVIRONMENT must fail closed — otherwise a production deploy
    // that forgot to set ENVIRONMENT would let any anonymous caller run migrations. (Local dev
    // sets ENVIRONMENT='development' in wrangler.jsonc, so the local flow is unaffected.)
    const isDev = env.ENVIRONMENT === 'development';
    if (isDev) return true;

    if (!env.MIGRATION_SECRET) return false;

    let providedSecret: string | null = null;
    const url = new URL(request.url);
    providedSecret = url.searchParams.get('secret');

    if (!providedSecret && request.method === 'POST') {
        const body = await readJson<{ secret?: string }>(request);
        providedSecret = body.secret ?? null;
    }

    if (!providedSecret) {
        const authHeader = request.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            providedSecret = authHeader.substring(7);
        }
    }

    return providedSecret === env.MIGRATION_SECRET;
}

/**
 * Core models first (the ORM needs them before anything else), then every model the
 * installed packages contribute (ottabase/packages.ts). Premium models are registered
 * regardless of license state: registration only teaches the ORM about a table, every paid
 * route runs its own gate, and generic CRUD refuses them by default (GENERIC_CRUD_ALLOWLIST).
 */
function registerAppModels(): void {
    const coreModels = [
        Account,
        Media,
        VerificationToken,
        ScheduledTask,
        Organization,
        OrganizationMember,
        Role,
        UserRole,
        Permission,
        UserGroup,
        UserGroupMember,
    ];

    registerPolicy(mediaLibraryPolicy);
    registerModels([...coreModels, ...packages.models()]);
    initRLS();

    // Package policies are registered AFTER initRLS(): the RLS registry is last-write-wins,
    // so a policy registered before it would be silently replaced by a built-in with the
    // same model name. This is where org-mode blog overrides, the AI credential policy and
    // the landing-site policies land, each declared by its own manifest.
    for (const policy of packages.policies()) registerPolicy(policy);
}

export function ensureDbConnection(env: CloudflareEnv): void {
    if (!env.OBCF_D1) return;

    // filesPublicUrl: what `User#imageUrl()` builds avatar URLs on (the public files bucket, absolute).
    configureOttaORM({ maxAllRows: env.OTTAORM_MAX_ALL_ROWS, filesPublicUrl: files.publicBase(env) });

    // Cloudflare bindings are stable object references within an isolate, so
    // reference equality is sufficient to detect whether this isolate has
    // already been initialized for the current D1 binding.
    if (dbConnectionReady && initializedD1Binding === env.OBCF_D1) {
        return;
    }

    const shouldResetConnection =
        hasConnection('default') || (dbConnectionReady && initializedD1Binding !== env.OBCF_D1);

    try {
        if (shouldResetConnection) {
            clearConnection('default');
        }

        registerConnection('default', createD1Driver(env.OBCF_D1));
        registerAppModels();

        initializedD1Binding = env.OBCF_D1;
        dbConnectionReady = true;
    } catch (error) {
        initializedD1Binding = null;
        dbConnectionReady = false;

        if (hasConnection('default')) {
            clearConnection('default');
        }

        throw error;
    }
}

export function initDbConnection(env: CloudflareEnv): void {
    ensureDbConnection(env);
}

export function resetDbConnectionForTests(): void {
    initializedD1Binding = null;
    dbConnectionReady = false;

    if (hasConnection('default')) {
        clearConnection('default');
    }
}

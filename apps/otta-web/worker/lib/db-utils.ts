import { BrandKit, LayoutRouteMapping, LayoutTemplate, MenuSlotAssignment } from '@ottabase/brand-engine/persistence';
import { Comment, CommentReaction } from '@ottabase/comments';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { AiProviderCredential, createCredentialPolicy } from '@ottabase/ottaai/ottaorm';
import {
    OttablogPlugin,
    OttablogTheme,
    Post,
    PostCategory,
    PostCategoryLink,
    PostSeries,
    PostTag,
    PostTagLink,
    PostVersion,
} from '@ottabase/ottablog';
import {
    clearConnection,
    hasConnection,
    initRLS,
    registerConnection,
    registerModels,
    registerPolicy,
    RLSPolicies,
} from '@ottabase/ottaorm';
import {
    Account,
    Authenticator,
    Media,
    Organization,
    OrganizationMember,
    Permission,
    Role,
    ScheduledTask,
    Session,
    UserGroup,
    UserGroupMember,
    UserRole,
    VerificationToken,
} from '@ottabase/ottaorm/models';
import { ReferralTracking } from '@ottabase/referrals';
import { Shortlink } from '@ottabase/shortlinks';
import { errorResponse } from '@ottabase/utils/http-errors';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { Todo } from '../../ottabase/models/Todo';
import { mediaLibraryPolicy } from '../../ottabase/models/mediaLibraryPolicy';
import type { CloudflareEnv } from '../cloudflare-env';
import { getPremiumPackageModels } from './premium';
import { readJson } from './utils';

let initializedD1Binding: CloudflareEnv['OBCF_D1'] | null = null;
let dbConnectionReady = false;

export function initAdminCron(env: CloudflareEnv): Response | null {
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));
    return null;
}

export async function checkMigrationAuth(request: Request, env: CloudflareEnv): Promise<boolean> {
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

function registerAppModels(env: CloudflareEnv): void {
    const config = getOttabaseConfig(env);
    const packages = config.packages;
    const coreModels = [
        Account,
        Authenticator,
        Media,
        Session,
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
    const ottablogModels = packages.ottablog
        ? [
              Post,
              PostTag,
              PostTagLink,
              PostCategoryLink,
              PostCategory,
              PostSeries,
              PostVersion,
              OttablogPlugin,
              OttablogTheme,
          ]
        : [];
    const packageModels = [
        ...(packages.comments ? [Comment, CommentReaction] : []),
        ...(packages.shortlinks ? [Shortlink] : []),
        ...(packages.referrals ? [ReferralTracking] : []),
        ...(packages.ottaai ? [AiProviderCredential] : []),
    ];
    // Menu, MenuItem: use /api/brand/menus (cache-invalidating CRUD), not OttaORM
    const brandModels = [BrandKit, LayoutTemplate, LayoutRouteMapping, MenuSlotAssignment];
    const appModels = [Todo];
    // Paid packages (ottabase/config.premium.ts). Registered regardless of license state:
    // registration only teaches the ORM about a table, and every paid route runs its own
    // gate — generic CRUD refuses these models by default (GENERIC_CRUD_ALLOWLIST).
    const premiumModels = getPremiumPackageModels() as typeof appModels;

    registerPolicy(mediaLibraryPolicy);
    registerModels([
        ...coreModels,
        ...ottablogModels,
        ...packageModels,
        ...brandModels,
        ...appModels,
        ...premiumModels,
    ]);
    initRLS();

    // AI provider credentials — registered AFTER initRLS() for the same reason as the
    // ottablog overrides below: the RLS registry is last-write-wins, so a policy registered
    // before initRLS() would be silently replaced by the built-ins if the name ever collided.
    //
    // The STRATEGY here MUST match the one passed to createAiProvisioningWithStorage
    // (worker/lib/ai.ts) — both read `config.features.ottaai.strategy`, which is what makes
    // the match structural rather than a comment in two files. Mismatch them and tenants
    // manage one set of rows while their calls use another, with NO error.
    if (packages.ottaai) {
        registerPolicy(createCredentialPolicy({ strategy: config.features.ottaai.strategy }));
    }

    // Org-mode blogs: taxonomy and studio state become tenant data, not app-global.
    // Registered AFTER initRLS so these overrides win (the RLS registry is last-write-wins).
    // Platform mode (default) keeps the built-in AppScoped policies untouched.
    // RLS applies on the generic-CRUD path only; the public blog endpoints read published
    // content directly through models and stay public in both modes.
    if (packages.ottablog && config.features.ottablog.mode === 'org') {
        for (const model of ['categories', 'post_tags', 'series', 'ottablog_themes', 'ottablog_plugins']) {
            registerPolicy({
                model,
                policy: RLSPolicies.TenantScoped(false),
                contextFields: ['organizationId', 'appId'],
                auditEnabled: true,
            });
        }
    }
}

export function ensureDbConnection(env: CloudflareEnv): void {
    if (!env.OBCF_D1) return;

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
        registerAppModels(env);

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

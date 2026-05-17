import { BrandKit, LayoutRouteMapping, LayoutTemplate, MenuSlotAssignment } from '@ottabase/brand-engine/persistence';
import { Comment } from '@ottabase/comments';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
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
    const isDev = env.ENVIRONMENT === 'development' || !env.ENVIRONMENT;
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
        ...(packages.comments ? [Comment] : []),
        ...(packages.shortlinks ? [Shortlink] : []),
        ...(packages.referrals ? [ReferralTracking] : []),
    ];
    // Menu, MenuItem: use /api/brand/menus (cache-invalidating CRUD), not OttaORM
    const brandModels = [BrandKit, LayoutTemplate, LayoutRouteMapping, MenuSlotAssignment];
    const appModels = [Todo];

    registerPolicy(mediaLibraryPolicy);
    registerModels([...coreModels, ...ottablogModels, ...packageModels, ...brandModels, ...appModels]);
    initRLS();
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

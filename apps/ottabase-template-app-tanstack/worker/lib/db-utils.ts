import { BrandKit, LayoutRouteMapping, LayoutTemplate } from '@ottabase/brand-engine/persistence';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import {
    OttablogPlugin,
    OttablogTheme,
    Post,
    PostCategory,
    PostSeries,
    PostTag,
    PostTagLink,
    PostVersion,
} from '@ottabase/ottablog';
import { clearConnection, hasConnection, initRLS, registerConnection, registerModels } from '@ottabase/ottaorm';
import {
    Account,
    Authenticator,
    Organization,
    OrganizationMember,
    Permission,
    Role,
    ScheduledTask,
    Session,
    UserRole,
    VerificationToken,
} from '@ottabase/ottaorm/models';
import { ReferralTracking } from '@ottabase/referrals';
import { Shortlink } from '@ottabase/shortlinks';
import { errorResponse } from '@ottabase/utils/http-errors';
import type { CloudflareEnv } from '../../cloudflare-env';
import { Todo } from '../../ottabase/models/Todo';
import { readJson } from './utils';
import { PACKAGES } from './worker-config';

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

export function initDbConnection(env: CloudflareEnv): void {
    if (!env.OBCF_D1) return;

    if (hasConnection('default')) {
        clearConnection('default');
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    // Core models (always registered)
    const models: any[] = [
        Account,
        Authenticator,
        Session,
        VerificationToken,
        ScheduledTask,
        Organization,
        OrganizationMember,
        Role,
        UserRole,
        Permission,
        // App models
        Todo,
    ];

    // Package models (only registered when enabled in ottabase.config.ts)
    if (PACKAGES.ottablog) {
        models.push(Post, PostTag, PostTagLink, PostCategory, PostSeries, PostVersion, OttablogPlugin, OttablogTheme);
    }
    if (PACKAGES.shortlinks) {
        models.push(Shortlink);
    }
    if (PACKAGES.referrals) {
        models.push(ReferralTracking);
    }
    if (PACKAGES.brandEngine) {
        models.push(BrandKit, LayoutTemplate, LayoutRouteMapping);
    }

    registerModels(models);

    initRLS();
}

import { definePackage, type OttaPackage, type PackageExtras } from '@ottabase/kernel';
import { RLSPolicies, type ModelRLSConfig } from '@ottabase/ottaorm';
import { EmailSuppression } from './ottaorm-models/EmailSuppression';
import { createPostmasterRouter, type PostmasterRouterOptions } from './routes';
import { emailSuppressionsTable } from './schema';

export const POSTMASTER_PACKAGE_KEY = 'postmaster';
export const POSTMASTER_BASE_PATH = '/api/email/hooks';

/** The suppression list is an operator table: app-scoped, platform admins only, writes audited. */
export const postmasterPolicies: ModelRLSConfig[] = [
    {
        model: 'email_suppressions',
        policy: { ...RLSPolicies.AppScoped(), requirePlatformAdmin: true },
        contextFields: ['appId'],
        auditEnabled: true,
    },
];

export interface PostmasterPackageOptions<Env> extends PostmasterRouterOptions<Env>, PackageExtras<Env> {
    /** Default `/api/email/hooks`. */
    basePath?: string;
}

/** The postmaster package as the app registers it: the suppression table, its model and policy, and the hook routes. */
export function createPostmasterPackage<Env = unknown>(options: PostmasterPackageOptions<Env>): OttaPackage<Env> {
    const {
        basePath = POSTMASTER_BASE_PATH,
        routes,
        cron,
        queue,
        events,
        nav,
        env,
        health,
        lifecycle,
        ...router
    } = options;
    return definePackage<Env>({
        key: POSTMASTER_PACKAGE_KEY,
        name: 'Postmaster',
        version: '1.0.0',
        description:
            'Inbound mail, the suppression list, one-click unsubscribe, and provider bounce and complaint webhooks.',
        tables: { emailSuppressionsTable },
        models: [EmailSuppression],
        policies: postmasterPolicies,
        routes: routes ?? { basePath, build: () => createPostmasterRouter<Env>(router) },
        env: env ?? {
            optional: ['EMAIL_RESEND_WEBHOOK_SECRET', 'EMAIL_SES_WEBHOOK_SECRET', 'EMAIL_UNSUBSCRIBE_SECRET'],
        },
        ...(cron ? { cron } : {}),
        ...(queue ? { queue } : {}),
        ...(events ? { events } : {}),
        ...(nav ? { nav } : {}),
        ...(health ? { health } : {}),
        ...(lifecycle ? { lifecycle } : {}),
    });
}

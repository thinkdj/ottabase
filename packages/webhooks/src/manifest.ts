// ============================================================
// @ottabase/webhooks — the manifest (a free package)
// ============================================================
// The whole integration contract in one object. A host app registers THIS and gets the
// tables, the models, the routes and the nav entry; nothing else in the app has to learn
// that outbound webhooks exist.
// ============================================================

import { definePackage, type OttaPackage } from '@ottabase/kernel';
import {
    DEFAULT_DELIVERY_RETENTION_DAYS,
    WEBHOOKS_BASE_PATH,
    WEBHOOKS_PACKAGE_KEY,
    WEBHOOKS_PRUNE_HANDLER,
} from './constants';
import { WebhookDelivery } from './ottaorm-models/WebhookDelivery';
import { WebhookEndpoint } from './ottaorm-models/WebhookEndpoint';
import { webhookPolicies } from './policy';
import { assertCount, createWebhooksRouter } from './routes';
import { webhookDeliveriesTable, webhookEndpointsTable } from './schema';
import type { WebhooksRouterConfig } from './types';

export interface WebhooksPackageOptions<Env> extends WebhooksRouterConfig<Env> {
    /** The app whose delivery log the nightly prune trims. Cron has no caller, so it comes from env. */
    appId: (env: Env) => string;
    /** Days of delivery log kept; older rows are deleted nightly. Default 30. */
    deliveryRetentionDays?: number;
}

/**
 * Build the webhooks package manifest.
 *
 * A FACTORY, not a constant, because the routes need the host's session resolver — this
 * package has no idea how the host authenticates, and taking a resolver is what keeps it
 * from inventing a second, diverging notion of "who is calling".
 */
export function createWebhooksPackage<Env>(options: WebhooksPackageOptions<Env>): OttaPackage<Env> {
    const { appId, deliveryRetentionDays = DEFAULT_DELIVERY_RETENTION_DAYS, ...routerConfig } = options;
    assertCount('deliveryRetentionDays', deliveryRetentionDays, 1);
    if (routerConfig.maxEndpoints !== undefined) assertCount('maxEndpoints', routerConfig.maxEndpoints);
    return definePackage<Env>({
        key: WEBHOOKS_PACKAGE_KEY,
        name: 'Outbound Webhooks',
        version: '1.0.0',
        description:
            'Let customers subscribe to your events. HMAC-signed deliveries, per-endpoint health, and a searchable delivery log.',
        docsUrl: 'https://github.com/thinkdj/ottabase/tree/main/packages/webhooks#readme',

        tables: { webhookEndpointsTable, webhookDeliveriesTable },
        models: [WebhookEndpoint, WebhookDelivery],
        policies: webhookPolicies,

        routes: {
            basePath: WEBHOOKS_BASE_PATH,
            build: () => createWebhooksRouter(routerConfig),
        },

        cron: {
            [WEBHOOKS_PRUNE_HANDLER]: {
                description: `Delete delivery log rows older than the retention window (payload olderThanDays, default ${deliveryRetentionDays}).`,
                handler: async ({ env, payload }) => {
                    const days =
                        payload &&
                        typeof payload === 'object' &&
                        typeof (payload as { olderThanDays?: unknown }).olderThanDays === 'number'
                            ? (payload as { olderThanDays: number }).olderThanDays
                            : deliveryRetentionDays;
                    await WebhookDelivery.pruneOlderThan(days, appId(env));
                },
                schedule: '17 4 * * *',
                payload: { olderThanDays: deliveryRetentionDays },
            },
        },

        nav: [
            {
                title: 'Webhooks',
                description: 'Outbound event delivery with signed payloads and a delivery log.',
                href: '/admin/growth/webhooks',
                icon: 'Webhook',
                scope: 'org',
            },
        ],

        lifecycle: {
            onInstall: ({ key, version }) => {
                console.info(`[webhooks] installed ${key} v${version}`);
            },
            onUpgrade: ({ previousVersion, version }) => {
                console.info(`[webhooks] upgraded ${previousVersion} → ${version}`);
            },
        },
    });
}

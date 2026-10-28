// ============================================================
// @ottabase/webhooks — the manifest (a free package)
// ============================================================
// The whole integration contract in one object. A host app registers THIS and gets the
// tables, the models, the routes and the nav entry; nothing else in the app has to learn
// that outbound webhooks exist.
// ============================================================

import { definePackage, type OttaPackage } from '@ottabase/kernel';
import { WEBHOOKS_BASE_PATH, WEBHOOKS_PACKAGE_KEY } from './constants';
import { WebhookDelivery } from './ottaorm-models/WebhookDelivery';
import { WebhookEndpoint } from './ottaorm-models/WebhookEndpoint';
import { webhookPolicies } from './policy';
import { createWebhooksRouter } from './routes';
import { webhookDeliveriesTable, webhookEndpointsTable } from './schema';
import type { WebhooksRouterConfig } from './types';

export type WebhooksPackageOptions<Env> = WebhooksRouterConfig<Env>;

/**
 * Build the webhooks package manifest.
 *
 * A FACTORY, not a constant, because the routes need the host's session resolver — this
 * package has no idea how the host authenticates, and taking a resolver is what keeps it
 * from inventing a second, diverging notion of "who is calling".
 */
export function createWebhooksPackage<Env>(options: WebhooksPackageOptions<Env>): OttaPackage<Env> {
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
            build: () => createWebhooksRouter(options),
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

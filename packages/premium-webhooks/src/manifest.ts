// ============================================================
// @ottabase/premium-webhooks — the manifest
// ============================================================
// The whole integration contract in one object. A host app registers THIS and gets the
// tables, the models, the gated routes and the nav entry; nothing else in the app has to
// learn that outbound webhooks exist.
// ============================================================

import { definePremiumPackage, type PremiumPackage } from '@ottabase/premium';
import {
    WEBHOOKS_BASE_PATH,
    WEBHOOKS_FEATURE_CUSTOM_HEADERS,
    WEBHOOKS_FEATURE_DELIVERY_LOG,
    WEBHOOKS_FEATURE_MANAGE,
    WEBHOOKS_FREE_ENDPOINT_LIMIT,
    WEBHOOKS_LIMIT_ENDPOINTS,
    WEBHOOKS_PACKAGE_KEY,
} from './constants';
import { DEMO_LICENSE_PUBLIC_KEY } from './demo-license';
import { WebhookDelivery } from './ottaorm-models/WebhookDelivery';
import { WebhookEndpoint } from './ottaorm-models/WebhookEndpoint';
import { createWebhooksRouter } from './routes';
import { webhookDeliveriesTable, webhookEndpointsTable } from './schema';
import type { WebhooksRouterConfig } from './types';

export interface WebhooksPackageOptions<Env> extends Omit<WebhooksRouterConfig<Env>, 'registry'> {
    /**
     * Vendor public key. Defaults to the DEMO key shipped with this package, which is
     * published in the repository — replace it (and the license) for anything you sell.
     */
    licensePublicKey?: string;
}

/**
 * Build the webhooks package manifest.
 *
 * A FACTORY, not a constant, because the routes need the host's session resolver — this
 * package has no idea how the host authenticates, and taking a resolver is what keeps it
 * from inventing a second, diverging notion of "who is calling". The premium registry
 * arrives later, handed to `build()` at mount time by the framework.
 */
export function createWebhooksPackage<Env>(options: WebhooksPackageOptions<Env>): PremiumPackage<Env> {
    return definePremiumPackage<Env>({
        key: WEBHOOKS_PACKAGE_KEY,
        name: 'Outbound Webhooks',
        version: '1.0.0',
        description:
            'Let customers subscribe to your events. HMAC-signed deliveries, per-endpoint health, and a searchable delivery log.',
        vendor: 'Ottabase',
        docsUrl: 'https://github.com/thinkdj/ottabase/tree/main/packages/premium-webhooks#readme',
        purchaseUrl: 'https://github.com/thinkdj/ottabase/tree/main/packages/premium-webhooks#licensing',

        licensePublicKey: options.licensePublicKey ?? DEMO_LICENSE_PUBLIC_KEY,
        graceDays: 14,

        features: [WEBHOOKS_FEATURE_MANAGE, WEBHOOKS_FEATURE_DELIVERY_LOG, WEBHOOKS_FEATURE_CUSTOM_HEADERS],
        // The free tier is deliberately USEFUL: one endpoint, signed deliveries, and the
        // endpoint's own health. A free tier nobody can ship with sells nothing.
        freeFeatures: [WEBHOOKS_FEATURE_MANAGE],
        freeLimits: { [WEBHOOKS_LIMIT_ENDPOINTS]: WEBHOOKS_FREE_ENDPOINT_LIMIT },

        tables: { webhookEndpointsTable, webhookDeliveriesTable },
        models: [WebhookEndpoint, WebhookDelivery],

        routes: {
            basePath: WEBHOOKS_BASE_PATH,
            // `entitlements`, not `license`: the free tier lives behind these routes, so the
            // namespace must stay reachable and the paid paths guard themselves. See routes.ts.
            gate: 'entitlements',
            build: (registry) => createWebhooksRouter({ ...options, registry }),
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
                console.info(`[premium-webhooks] installed ${key} v${version}`);
            },
            onUpgrade: ({ previousVersion, version }) => {
                console.info(`[premium-webhooks] upgraded ${previousVersion} → ${version}`);
            },
            onDeactivate: ({ reason }) => {
                // Endpoints are LEFT ALONE. A lapsed license must not silently delete a
                // customer's configuration — they get the free tier back, not a blank page.
                console.warn(`[premium-webhooks] license inactive (${reason}); paid features are closed`);
            },
        },
    });
}

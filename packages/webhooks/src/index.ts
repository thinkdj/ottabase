// ============================================================
// @ottabase/webhooks — headless entrypoint
// ============================================================
// Customers subscribe to your events: tables, models, routes and signed outbound
// delivery with a delivery log. Rendered React lives behind `@ottabase/webhooks/react`.
// ============================================================

export { WEBHOOKS_BASE_PATH, WEBHOOKS_DELIVERY_PAGE_SIZE, WEBHOOKS_PACKAGE_KEY } from './constants';

export { createWebhooksPackage, type WebhooksPackageOptions } from './manifest';
export { createWebhooksRouter, DEFAULT_WEBHOOK_EVENTS } from './routes';

export {
    DELIVERY_TIMEOUT_MS,
    deliverToEndpoint,
    dispatchWebhookEvent,
    summarizeDeliveryError,
    type DeliveryOutcome,
    type DispatchWebhookInput,
} from './dispatch';

export {
    DELIVERY_HEADER,
    EVENT_HEADER,
    SIGNATURE_HEADER,
    buildSignatureHeader,
    generateSigningSecret,
    signPayload,
    verifySignatureHeader,
} from './signing';

export { WebhookUrlError, assertDeliverableUrl } from './url-policy';

export { WebhookEndpoint, type WebhookEndpointView } from './ottaorm-models/WebhookEndpoint';
export { WebhookDelivery, type WebhookDeliveryView } from './ottaorm-models/WebhookDelivery';

export {
    webhookDeliveriesTable,
    webhookEndpointsTable,
    type NewWebhookDeliveryRecord,
    type NewWebhookEndpointRecord,
    type WebhookDeliveryRecord,
    type WebhookEndpointRecord,
} from './schema';

export type { WebhookCaller, WebhookEndpointInput, WebhookTenant, WebhooksRouterConfig } from './types';

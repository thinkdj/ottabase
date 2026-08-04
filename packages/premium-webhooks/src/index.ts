// ============================================================
// @ottabase/premium-webhooks — headless entrypoint
// ============================================================
// The worked example for `@ottabase/premium`: a real paid add-on with tables, models,
// gated routes, signed outbound delivery and a free tier. Rendered React lives behind
// `@ottabase/premium-webhooks/react`.
// ============================================================

export {
    WEBHOOKS_BASE_PATH,
    WEBHOOKS_DELIVERY_PAGE_SIZE,
    WEBHOOKS_FEATURE_CUSTOM_HEADERS,
    WEBHOOKS_FEATURE_DELIVERY_LOG,
    WEBHOOKS_FEATURE_MANAGE,
    WEBHOOKS_FREE_ENDPOINT_LIMIT,
    WEBHOOKS_LIMIT_ENDPOINTS,
    WEBHOOKS_PACKAGE_KEY,
} from './constants';

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

export { DEMO_LICENSE_PUBLIC_KEY, DEMO_PRO_LICENSE } from './demo-license';

export type { WebhookCaller, WebhookEndpointInput, WebhookTenant, WebhooksRouterConfig } from './types';

// ============================================================
// @ottabase/premium-webhooks/react — rendered entrypoint
// ============================================================
// The root entrypoint stays headless (schema, models, routes, dispatcher) so the Worker
// bundle never pulls a component library in through the back door.
// ============================================================

export {
    WEBHOOK_ENDPOINTS_ENTITY,
    useWebhookDeliveries,
    useWebhookEndpoints,
    webhookQueryKeys,
    type CreatedWebhookEndpoint,
} from './hooks';
export { WebhooksSettings, type WebhooksSettingsProps } from './WebhooksSettings';

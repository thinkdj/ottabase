// ============================================================
// @ottabase/alerts: headless entrypoint
// ============================================================
// The engine, the manifest, the routes, the models and the channel renderers. Rendered
// components live in `@ottabase/alerts/react`, so the Worker bundle never pulls a component
// library in. Packages that only raise alerts need one type from here: `AlertSink`.
// ============================================================

export * from './constants';
export {
    CHANNEL_TYPES,
    ChannelInputError,
    DELIVERY_HEADER,
    EVENT_HEADER,
    SIGNATURE_HEADER,
    alertText,
    batchText,
    batchTitle,
    buildRequest,
    isChannelType,
    judgeResponse,
    parseChannelTarget,
    publicAlert,
    renderMail,
    type Outbound,
    type RenderContext,
} from './channels';
export {
    absoluteUrl,
    channelTakes,
    createAlerts,
    digestDue,
    digestSlot,
    isSeverity,
    normalizeAlert,
    type Alerts,
    type FeedFilter,
    type PruneResult,
    type SweepResult,
    type TestResult,
} from './engine';
export { alertFromIncident, createAlertsPackage, errorShape } from './manifest';
export { AlertChannel as AlertChannelModel } from './ottaorm-models/AlertChannel';
export { AlertDelivery as AlertDeliveryModel } from './ottaorm-models/AlertDelivery';
export { AlertEvent as AlertEventModel } from './ottaorm-models/AlertEvent';
export { AlertKey as AlertKeyModel } from './ottaorm-models/AlertKey';
export { createAlertsRouter, readCapped, type AlertsRouterOptions } from './routes';
export {
    alertChannelsTable,
    alertDeliveriesTable,
    alertEventsTable,
    alertKeysTable,
    type AlertChannelRecord,
    type AlertDeliveryRecord,
    type AlertEventRecord,
    type AlertKeyRecord,
} from './schema';
export { AlertsSecretError, open as openSecret, seal as sealSecret } from './secret';
export type {
    Alert,
    AlertField,
    AlertInput,
    AlertMail,
    AlertSink,
    AlertStatus,
    AlertView,
    AlertsCaller,
    AlertsOptions,
    AlertsPackageOptions,
    AlertsSummary,
    Awaitable,
    ChannelConfig,
    ChannelInput,
    ChannelMode,
    ChannelSecrets,
    ChannelType,
    ChannelView,
    DeliveryStatus,
    DeliveryView,
    RaiseOptions,
    RaiseResult,
    SavedChannel,
    SendOutcome,
    Severity,
} from './types';

// ============================================================
// @ottabase/alerts/react: rendered entrypoint
// ============================================================
// The root entrypoint stays headless (engine, routes, manifest) so the Worker bundle never
// pulls a component library in through the back door.
// ============================================================

export { AlertsConsole, ago } from './AlertsConsole';
export {
    ALERTS_ENTITY,
    useAlertActions,
    useAlertChannels,
    useAlertFeed,
    useAlertsSummary,
    type ChannelTypeInfo,
    type FeedQuery,
    type TestOutcome,
} from './hooks';

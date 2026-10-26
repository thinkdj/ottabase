// ============================================================
// @ottabase/fleet — makes an app watchable
// ============================================================

export { authorizeFleet, createReporter, summarize } from './report';
export * from './constants';
export { createFleetPackage } from './manifest';
export { createFleetRouter, type FleetRouterOptions } from './routes';
export type {
    Awaitable,
    FleetLicenseState,
    FleetOptions,
    FleetReport,
    FleetReportPackage,
    FleetReportTask,
    FleetSources,
    FleetStatus,
} from './types';

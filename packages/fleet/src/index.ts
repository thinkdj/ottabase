// ============================================================
// @ottabase/fleet — makes an app watchable
// ============================================================

export { authorizeFleet, createReporter, summarize, type ReportScope } from './report';
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
    FleetReportUsers,
    FleetSources,
    FleetStatus,
} from './types';

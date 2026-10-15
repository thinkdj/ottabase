// ============================================================
// @ottabase/fleet — the beacon
// ============================================================

export { authorizeBeacon, createReporter, summarize } from './beacon';
export * from './constants';
export { createFleetPackage } from './manifest';
export { createBeaconRouter, type BeaconRouterOptions } from './routes';
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

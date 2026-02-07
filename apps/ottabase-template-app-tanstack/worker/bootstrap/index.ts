// ============================================================
// Ottabase Bootstrap - Public API
// ============================================================

export { resolvePlatformState, probeBindings, writeDBState, writeKVState, ensureMetaTable } from './state-resolver';
export { handleBootstrapRoute, interceptIfNotReady } from './routes';
export type { PlatformState, PlatformStateResult, BindingProbe, BootstrapStep } from './types';
export { BOOTSTRAP_PATH, META_TABLE, KV_PLATFORM_STATE_KEY } from './types';

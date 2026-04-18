// ============================================================
// Ottabase Bootstrap - Types & Constants
// ============================================================
//
// Platform state hierarchy:
//   ENV locks > DB wins > KV accelerates
//
// States:
//   UNINITIALIZED - Fresh install, no tables exist
//   BOOTSTRAPPING - Setup wizard in progress
//   READY         - Platform fully operational
//
// Resolution rules:
//   KV=READY, DB probe fails  → panic + maintenance mode
//   DB=READY, KV missing      → repopulate KV → continue
//   ENV=LOCKED                 → override everything → halt
//   DB always wins (source of truth)
// ============================================================

export type PlatformState = 'UNINITIALIZED' | 'BOOTSTRAPPING' | 'READY';

export interface PlatformStateResult {
    /** The resolved platform state */
    state: PlatformState;
    /** Where the state was resolved from */
    source: 'env' | 'db' | 'kv' | 'probe';
    /** Whether we're in a degraded/panic state */
    panic: boolean;
    /** Human-readable reason for the current state */
    reason: string;
    /** Binding availability */
    bindings: BindingProbe;
}

export interface BindingProbe {
    d1: boolean;
    kv: boolean;
    r2: boolean;
    queue: boolean;
    assets: boolean;
}

export interface BootstrapStep {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'running' | 'done' | 'error';
    error?: string;
}

/** KV key for cached platform state */
export const KV_PLATFORM_STATE_KEY = '_ottabase:platform_state';

/** Meta table name in D1 */
export const META_TABLE = '_ottabase_meta';

/** Meta key for platform state in _ottabase_meta */
export const META_PLATFORM_STATE_KEY = 'platform_state';

/** ENV var name that can lock the platform */
export const ENV_LOCK_VAR = 'OTTABASE_LOCKED';

/** Bootstrap path prefix */
export const BOOTSTRAP_PATH = '/__bootstrap__';

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
//   ENV=LOCKED                 → override everything → halt
//   Isolate memo / KV=READY    → fast path, D1 probe skipped
//   DB=READY, KV missing       → repopulate KV → continue
//   DB wins whenever it is probed (source of truth); bootstrap
//   routes drop the memo so re-inits resolve fresh.
// ============================================================

export type PlatformState = 'UNINITIALIZED' | 'BOOTSTRAPPING' | 'READY';

export interface PlatformStateResult {
    /** The resolved platform state */
    state: PlatformState;
    /** Where the state was resolved from */
    source: 'env' | 'db' | 'kv' | 'probe' | 'memo';
    /**
     * Whether we're in a degraded/panic state.
     * Currently always false: the KV=READY + dead-D1 panic probe was removed
     * with the READY fast path (D1 failures now surface in the actual queries).
     * The field and its maintenance-page consumers are retained for a future
     * explicit health probe.
     */
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

/** Meta key used to atomically claim the right to create the first platform owner account */
export const META_OWNER_CLAIMED_KEY = 'owner_claimed';

/** ENV var name that can lock the platform */
export const ENV_LOCK_VAR = 'OTTABASE_LOCKED';

/** Bootstrap path prefix */
export const BOOTSTRAP_PATH = '/__bootstrap__';

/**
 * Environments where bootstrap may run without a configured secret, and where
 * the wizard may report full diagnostics. Anything else — including an UNSET
 * `ENVIRONMENT` — is treated as production and denied. Keep every environment
 * check spelled against this list; comparing to the single string 'production'
 * lets `prod`, `staging`, `preview` and unset all fall through.
 */
export const DEV_ENVIRONMENTS = ['development', 'dev', 'test', 'local'] as const;

/** True when `ENVIRONMENT` names a non-production environment. */
export function isDevEnvironment(env: unknown): boolean {
    const name = String((env as { ENVIRONMENT?: unknown })?.ENVIRONMENT ?? '')
        .trim()
        .toLowerCase();
    return (DEV_ENVIRONMENTS as readonly string[]).includes(name);
}

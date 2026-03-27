// ============================================================
// Ottabase Bootstrap - Platform State Resolver
// ============================================================
//
// Resolution order:
//   1. ENV check   → OTTABASE_LOCKED=true → halt immediately
//   2. KV check    → fast-path if cached state exists
//   3. DB probe    → source of truth, create meta table if needed
//   4. Reconcile   → KV=READY but DB dead? panic. DB=READY but KV stale? repopulate.
// ============================================================

import type { CloudflareEnv } from '../../cloudflare-env';
import {
    ENV_LOCK_VAR,
    KV_PLATFORM_STATE_KEY,
    META_PLATFORM_STATE_KEY,
    META_TABLE,
    type BindingProbe,
    type PlatformState,
    type PlatformStateResult,
} from './types';

/**
 * Probe which Cloudflare bindings are available
 */
export function probeBindings(env: CloudflareEnv): BindingProbe {
    return {
        d1: !!env.OBCF_D1,
        kv: !!env.OBCF_KV,
        r2: !!env.OBCF_R2,
        queue: !!env.OBCF_QUEUE,
        assets: !!env.OBCF_ASSETS,
    };
}

/**
 * Read platform state from KV (fast cache)
 */
async function readKVState(env: CloudflareEnv): Promise<PlatformState | null> {
    if (!env.OBCF_KV) return null;
    try {
        const value = await env.OBCF_KV.get(KV_PLATFORM_STATE_KEY);
        if (value === 'UNINITIALIZED' || value === 'BOOTSTRAPPING' || value === 'READY') {
            return value;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Write platform state to KV cache
 */
export async function writeKVState(env: CloudflareEnv, state: PlatformState): Promise<void> {
    if (!env.OBCF_KV) return;
    try {
        await env.OBCF_KV.put(KV_PLATFORM_STATE_KEY, state);
    } catch {
        // KV write failure is non-fatal; DB is the source of truth
    }
}

/**
 * Remove every key in OBCF_KV (full namespace wipe).
 * Call at bootstrap init so stale platform_state, RBAC, queue, and rate-limit entries
 * from a previous run or local dev session cannot skew a fresh install.
 */
export async function clearKvNamespace(env: CloudflareEnv): Promise<{ deleted: number; skipped: boolean }> {
    if (!env.OBCF_KV) {
        return { deleted: 0, skipped: true };
    }

    let deleted = 0;
    let cursor: string | undefined;

    do {
        const page = await env.OBCF_KV.list({ limit: 1000, cursor });
        for (const k of page.keys) {
            await env.OBCF_KV.delete(k.name);
            deleted++;
        }
        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);

    return { deleted, skipped: false };
}

/**
 * Read platform state from D1 (_ottabase_meta table)
 */
async function readDBState(env: CloudflareEnv): Promise<{ state: PlatformState | null; tableExists: boolean }> {
    if (!env.OBCF_D1) return { state: null, tableExists: false };

    try {
        const result = await env.OBCF_D1.prepare(`SELECT value FROM ${META_TABLE} WHERE key = ?`)
            .bind(META_PLATFORM_STATE_KEY)
            .all();

        if (result.results && result.results.length > 0) {
            const value = (result.results[0] as any).value as string;
            if (value === 'UNINITIALIZED' || value === 'BOOTSTRAPPING' || value === 'READY') {
                return { state: value, tableExists: true };
            }
        }
        // Table exists but no platform_state row yet
        return { state: null, tableExists: true };
    } catch (e: any) {
        // Table doesn't exist → UNINITIALIZED
        if (typeof e?.message === 'string' && e.message.includes('no such table')) {
            return { state: null, tableExists: false };
        }
        throw e;
    }
}

/**
 * Write platform state to D1 (source of truth)
 */
export async function writeDBState(env: CloudflareEnv, state: PlatformState): Promise<void> {
    if (!env.OBCF_D1) return;

    // Ensure meta table exists
    await ensureMetaTable(env);

    await env.OBCF_D1.prepare(
        `INSERT INTO ${META_TABLE} (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
        .bind(META_PLATFORM_STATE_KEY, state, Date.now())
        .run();
}

/**
 * Create the _ottabase_meta table if it doesn't exist
 */
export async function ensureMetaTable(env: CloudflareEnv): Promise<void> {
    if (!env.OBCF_D1) return;

    await env.OBCF_D1.prepare(
        `CREATE TABLE IF NOT EXISTS ${META_TABLE} (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )`,
    ).run();
}

/**
 * Resolve the current platform state.
 *
 * Priority: ENV locks > DB wins > KV accelerates
 */
export async function resolvePlatformState(env: CloudflareEnv): Promise<PlatformStateResult> {
    const bindings = probeBindings(env);

    // -------------------------------------------------------
    // 0. SKIP BOOTSTRAP in test environments
    // -------------------------------------------------------
    const environment = (env as any).ENVIRONMENT;
    if (environment === 'test') {
        return {
            state: 'READY',
            source: 'env',
            panic: false,
            reason: 'Bootstrap skipped in test environment',
            bindings,
        };
    }

    // -------------------------------------------------------
    // 1. ENV LOCK — overrides everything
    // -------------------------------------------------------
    const envLocked = (env as any)[ENV_LOCK_VAR];
    if (envLocked === 'true' || envLocked === '1' || envLocked === true) {
        return {
            state: 'BOOTSTRAPPING',
            source: 'env',
            panic: false,
            reason: `Platform locked via ${ENV_LOCK_VAR} environment variable`,
            bindings,
        };
    }

    // -------------------------------------------------------
    // 2. No D1 binding → can't do anything, bindings not configured
    // -------------------------------------------------------
    if (!bindings.d1) {
        return {
            state: 'UNINITIALIZED',
            source: 'probe',
            panic: false,
            reason: 'D1 database binding (OBCF_D1) not configured',
            bindings,
        };
    }

    // -------------------------------------------------------
    // 3. Read KV cache (used for panic checks)
    // -------------------------------------------------------
    const kvState = await readKVState(env);

    // -------------------------------------------------------
    // 4. DB probe — source of truth
    // -------------------------------------------------------
    let dbResult: { state: PlatformState | null; tableExists: boolean };
    try {
        dbResult = await readDBState(env);
    } catch {
        // DB probe failed entirely
        if (kvState === 'READY') {
            // KV says READY but DB is unreachable → panic + maintenance
            return {
                state: 'READY',
                source: 'kv',
                panic: true,
                reason: 'KV reports READY but D1 database probe failed — maintenance mode',
                bindings,
            };
        }
        // DB down and KV doesn't say READY → treat as uninitialized
        return {
            state: 'UNINITIALIZED',
            source: 'probe',
            panic: false,
            reason: 'D1 database probe failed and no cached state in KV',
            bindings,
        };
    }

    // -------------------------------------------------------
    // 5. Reconcile DB vs KV
    // -------------------------------------------------------

    // No meta table at all → fresh install
    if (!dbResult.tableExists) {
        return {
            state: 'UNINITIALIZED',
            source: 'probe',
            panic: false,
            reason: 'No _ottabase_meta table found — fresh installation',
            bindings,
        };
    }

    // Meta table exists but no platform_state row → treat as UNINITIALIZED
    if (dbResult.state === null) {
        return {
            state: 'UNINITIALIZED',
            source: 'db',
            panic: false,
            reason: 'Meta table exists but no platform_state entry',
            bindings,
        };
    }

    // DB has a definitive state
    const dbState = dbResult.state;

    // DB=READY, KV missing or stale → repopulate KV, continue
    if (dbState === 'READY' && kvState !== 'READY') {
        await writeKVState(env, 'READY');
    }

    // DB=BOOTSTRAPPING, KV says READY → DB wins, reset KV
    if (dbState === 'BOOTSTRAPPING' && kvState === 'READY') {
        await writeKVState(env, 'BOOTSTRAPPING');
    }

    return {
        state: dbState,
        source: 'db',
        panic: false,
        reason: `Platform state resolved from database: ${dbState}`,
        bindings,
    };
}

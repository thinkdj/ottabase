import type { PackageRegistry } from './types';

export interface InstallRecord {
    /** Manifest version at the last completed install or upgrade. */
    version: string;
    installedAt: number;
    updatedAt: number;
}

/** Pluggable persistence for install records. KV in production, memory in tests. */
export interface InstallStore {
    get(key: string): Promise<InstallRecord | null>;
    set(key: string, record: InstallRecord): Promise<void>;
    delete(key: string): Promise<void>;
}

export interface KVNamespaceLike {
    get(key: string, type?: 'text'): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}

export const DEFAULT_INSTALL_PREFIX = 'ottabase:packages:';

function parseRecord(raw: string | null): InstallRecord | null {
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const record = parsed as Record<string, unknown>;
        if (
            typeof record.version !== 'string' ||
            !record.version ||
            typeof record.installedAt !== 'number' ||
            typeof record.updatedAt !== 'number'
        ) {
            return null;
        }
        return { version: record.version, installedAt: record.installedAt, updatedAt: record.updatedAt };
    } catch {
        return null;
    }
}

/** Every operation is best-effort: a KV hiccup must not fail an install run. */
export function createKvInstallStore(kv: KVNamespaceLike, prefix = DEFAULT_INSTALL_PREFIX): InstallStore {
    return {
        async get(key) {
            try {
                return parseRecord(await kv.get(`${prefix}${key}`));
            } catch {
                return null;
            }
        },
        async set(key, record) {
            try {
                await kv.put(`${prefix}${key}`, JSON.stringify(record));
            } catch {
                /* best-effort */
            }
        },
        async delete(key) {
            try {
                await kv.delete(`${prefix}${key}`);
            } catch {
                /* best-effort */
            }
        },
    };
}

export function createMemoryInstallStore(): InstallStore {
    const records = new Map<string, InstallRecord>();
    return {
        get: async (key) => records.get(key) ?? null,
        set: async (key, record) => void records.set(key, record),
        delete: async (key) => void records.delete(key),
    };
}

export type Transition = 'install' | 'upgrade' | 'none';

export interface LifecycleOutcome {
    key: string;
    transition: Transition;
    /** Set when the hook threw. The transition is still recorded; hooks are best-effort. */
    error?: string;
}

export interface ApplyLifecycleOptions<Env> {
    registry: PackageRegistry<Env>;
    env: Env;
    store: InstallStore;
    now?: () => number;
    log?: (line: string) => void;
}

/**
 * Run `onInstall` for packages seen for the first time and `onUpgrade` for packages whose
 * version changed, then record the version. Call it from the app's init route, after the
 * tables exist. Premium packages are skipped; their registry owns their lifecycle because
 * it is tied to the license.
 */
export async function applyPackageLifecycle<Env>(options: ApplyLifecycleOptions<Env>): Promise<LifecycleOutcome[]> {
    const now = options.now ?? Date.now;
    const log = options.log ?? ((line) => console.info(line));
    const outcomes: LifecycleOutcome[] = [];

    for (const pkg of options.registry.packages) {
        if (pkg.premium) continue;
        const record = await options.store.get(pkg.key);
        const transition: Transition = !record ? 'install' : record.version !== pkg.version ? 'upgrade' : 'none';
        if (transition === 'none') {
            outcomes.push({ key: pkg.key, transition });
            continue;
        }

        const context = {
            env: options.env,
            key: pkg.key,
            previousVersion: record?.version ?? null,
            version: pkg.version,
        };
        let error: string | undefined;
        try {
            if (transition === 'install') await pkg.lifecycle?.onInstall?.(context);
            else await pkg.lifecycle?.onUpgrade?.(context);
        } catch (thrown) {
            error = thrown instanceof Error ? thrown.message : String(thrown);
            log(`[kernel] ${pkg.key} ${transition} hook failed: ${error}`);
        }

        const at = now();
        await options.store.set(pkg.key, {
            version: pkg.version,
            installedAt: record?.installedAt ?? at,
            updatedAt: at,
        });
        outcomes.push(error ? { key: pkg.key, transition, error } : { key: pkg.key, transition });
    }
    return outcomes;
}

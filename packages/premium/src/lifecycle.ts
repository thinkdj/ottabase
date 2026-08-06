// ============================================================
// @ottabase/premium — lifecycle transitions
// ============================================================
// The five moments a paid add-on cares about: first install, version upgrade,
// license activation, license loss, and removal. Each maps to one optional hook.
//
// TWO RULES THAT MAKE THIS SAFE TO RUN ON THE REQUEST PATH:
//
//  1. HOOKS NEVER PROPAGATE. A vendor's `onInstall` that throws (bad KV binding, a
//     fetch to a service that is down) must not 500 the request that happened to be
//     first through the door. Failures are reported to the logger and swallowed.
//  2. HOOKS ARE IDEMPOTENT BY CONTRACT. Two isolates can resolve the same package
//     concurrently and both see "not installed"; the framework does not take a lock,
//     because a distributed lock on a best-effort bookkeeping write is more failure
//     surface than the duplicate it prevents.
// ============================================================

import { isServingState } from './entitlements';
import type {
    PremiumInstallRecord,
    PremiumLicenseResult,
    PremiumLifecycleContext,
    PremiumPackage,
    PremiumStateStore,
} from './types';

/** Where lifecycle diagnostics go. Defaults to `console`. */
export interface PremiumLogger {
    warn(message: string, detail?: unknown): void;
}

const defaultLogger: PremiumLogger = {
    warn(message, detail) {
        // Structured, bounded, and never the raw thrown value — the same rule the rest of
        // the framework follows for anything that reaches a log sink.
        console.warn(message, detail === undefined ? '' : { detail: String(detail) });
    },
};

/** Names of the transitions this module can apply, for tests and diagnostics. */
export type PremiumTransition = 'install' | 'upgrade' | 'activate' | 'deactivate' | 'uninstall';

async function runHook(
    logger: PremiumLogger,
    key: string,
    transition: PremiumTransition,
    hook: (() => Promise<void> | void) | undefined,
): Promise<void> {
    if (!hook) return;
    try {
        await hook();
    } catch (error) {
        logger.warn(`[premium] ${key}: ${transition} hook failed`, error instanceof Error ? error.message : error);
    }
}

export interface ApplyLifecycleInput<Env> {
    pkg: PremiumPackage<Env>;
    env: Env;
    license: PremiumLicenseResult;
    store: PremiumStateStore;
    logger?: PremiumLogger;
}

export interface ApplyLifecycleResult {
    record: PremiumInstallRecord;
    /** Transitions actually applied, in order. Empty on a steady-state resolve. */
    transitions: PremiumTransition[];
}

/**
 * Persist the disabled state without treating a kill switch as an installation.
 *
 * A disabled package must not run `onInstall`, but an already-serving package still
 * needs its deactivation hook. This is separate from `applyLifecycle` so a package
 * switched off before its first request remains entirely inert.
 */
export async function applyDisabledLifecycle<Env>(
    input: ApplyLifecycleInput<Env>,
): Promise<ApplyLifecycleResult | null> {
    const { pkg, env, store } = input;
    const logger = input.logger ?? defaultLogger;
    const existing = await store.get(pkg.key);
    if (!existing) return null;

    const transitions: PremiumTransition[] = [];
    if (isServingState(existing.lastState ?? 'unlicensed')) {
        transitions.push('deactivate');
        await runHook(logger, pkg.key, 'deactivate', () =>
            pkg.lifecycle?.onDeactivate?.({
                env,
                key: pkg.key,
                previousVersion: existing.version,
                version: pkg.version,
                claims: input.license.claims,
                reason: 'PACKAGE_DISABLED',
            }),
        );
    }

    const record = { ...existing, lastState: 'disabled' as const, updatedAt: Date.now() };
    await store.set(pkg.key, record);
    return { record, transitions };
}

/**
 * Reconcile the stored install record with the manifest and the current license,
 * running whatever hooks that reconciliation implies.
 *
 * Called from `resolve()`, so it runs at most once per cache window per isolate —
 * not once per request.
 */
export async function applyLifecycle<Env>(input: ApplyLifecycleInput<Env>): Promise<ApplyLifecycleResult> {
    const { pkg, env, license, store } = input;
    const logger = input.logger ?? defaultLogger;
    const now = Date.now();
    const transitions: PremiumTransition[] = [];

    const existing = await store.get(pkg.key);
    const ctx: PremiumLifecycleContext<Env> = {
        env,
        key: pkg.key,
        previousVersion: existing?.version ?? null,
        version: pkg.version,
        claims: license.claims,
    };

    let record: PremiumInstallRecord = existing ?? {
        version: pkg.version,
        installedAt: now,
        updatedAt: now,
        license: null,
    };

    if (!existing) {
        transitions.push('install');
        await runHook(logger, pkg.key, 'install', () => pkg.lifecycle?.onInstall?.(ctx));
    } else if (existing.version !== pkg.version) {
        transitions.push('upgrade');
        await runHook(logger, pkg.key, 'upgrade', () => pkg.lifecycle?.onUpgrade?.(ctx));
        record = { ...record, version: pkg.version, updatedAt: now };
    }

    const wasServing = existing?.lastState ? isServingState(existing.lastState) : false;
    const isServing = isServingState(license.state);

    if (isServing && !wasServing) {
        transitions.push('activate');
        await runHook(logger, pkg.key, 'activate', () => pkg.lifecycle?.onActivate?.(ctx));
    } else if (!isServing && wasServing) {
        transitions.push('deactivate');
        await runHook(logger, pkg.key, 'deactivate', () =>
            pkg.lifecycle?.onDeactivate?.({ ...ctx, reason: license.reason }),
        );
    }

    if (!existing || record.lastState !== license.state || record.version !== existing.version) {
        record = { ...record, lastState: license.state, updatedAt: now };
        await store.set(pkg.key, record);
    }

    return { record, transitions };
}

/**
 * Remove a package's install record and run `onUninstall`.
 *
 * Deliberately does NOT drop the package's tables. Dropping a customer's data as a side
 * effect of an admin click is not recoverable; the tables stay until an operator removes
 * the package from config and runs a migration that says so out loud.
 */
export async function applyUninstall<Env>(input: ApplyLifecycleInput<Env>): Promise<void> {
    const { pkg, env, license, store } = input;
    const logger = input.logger ?? defaultLogger;
    const existing = await store.get(pkg.key);

    await runHook(logger, pkg.key, 'uninstall', () =>
        pkg.lifecycle?.onUninstall?.({
            env,
            key: pkg.key,
            previousVersion: existing?.version ?? null,
            version: pkg.version,
            claims: license.claims,
        }),
    );

    await store.delete(pkg.key);
}

// ====================================================================
// otta-web — inference rate limiting
// --------------------------------------------------------------------
// A RATE LIMIT, NOT A BILLING QUOTA. It bounds burst and abuse; it does not
// bound total spend. Real spend accounting needs a strongly consistent counter
// and a commercial policy (free tier, reset period, retries, refunds, admin
// overrides, per-model pricing) — an approximate KV count is not a billing
// boundary and is deliberately not pretending to be one.
//
// WHY THIS EXISTS AT ALL: `/api/ai/complete` is authenticated, and that is the
// whole protection an operator gets by default. The moment `platformProvider` is
// configured, every signed-in user has an uncapped spigot on the operator's
// provider account. Per-request input caps limit the size of one call, not how
// many.
//
// WIRED AS THE PACKAGE'S `quota` HOOK, NOT AS ROUTE MIDDLEWARE. Three reasons,
// and the first is the one that decides it:
//
//   1. THE HOOK KNOWS `source`. A route runs BEFORE resolution, so it cannot yet
//      tell platform-paid inference (the operator's money, must fail closed)
//      from BYOK (the tenant's own money and their provider's own limits, must
//      NOT be bricked by a missing binding). That asymmetry is the entire point.
//   2. It covers `stream()` and every future call site, not just this one route.
//   3. It runs after resolution but BEFORE the outbound call, so a refusal never
//      reaches a provider.
//
// The cost of that choice, stated plainly: a throttled request still pays for
// resolution (a candidate fan-out and, on the BYOK path, one envelope decrypt)
// before being refused. That is a bounded, D1-local cost, and it buys the
// source-awareness a pre-resolution check structurally cannot have.
// ====================================================================

import type { QuotaCheck } from '@ottabase/ottaai/resolver';
import type { OttaaiRateLimitConfig } from '@ottabase/config';
// `CloudflareEnv` is AMBIENT — `cloudflare-env.d.ts` declares it globally with no export,
// so importing it fails with TS2306. See the note in `ai.ts`.

/** The KV surface this needs. Matches `KVNamespace`, and keeps the module testable. */
export interface RateLimitStore {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface AiRateLimiterOptions {
    store: RateLimitStore | null;
    /** Isolation prefix. Two apps sharing a KV namespace must not share buckets. */
    appId: string;
    limits: OttaaiRateLimitConfig;
    /** Injectable clock, so tests are deterministic. */
    now?: () => number;
    /** Injectable warning sink; defaults to `console.warn`. */
    onWarning?: (message: string) => void;
}

const WINDOW_SECONDS = 60;
const KEY_PREFIX = 'ottaai:rl:';

/**
 * Build the `quota` hook for `createAiProvisioningWithStorage`.
 *
 * Returns `false` to refuse, which the package turns into a `RATE_LIMITED` result and a
 * `quota.exceeded` event — so the refusal is classified, attributed and observable rather
 * than a bare 429 thrown from a route.
 */
export function createAiRateLimiter(options: AiRateLimiterOptions): QuotaCheck {
    const now = options.now ?? (() => Date.now());
    const warn = options.onWarning ?? ((message: string) => console.warn(message));

    return async ({ source, organizationId, userId }) => {
        // A PLATFORM CALL REQUIRES A POSITIVE APP CEILING.
        //
        // `perApp` is the ONLY aggregate limit — `perUser` and `perOrganization` bound one
        // actor each and say nothing about the total. Treating `perApp: 0` as "dimension
        // disabled" therefore quietly restores exactly the unlimited operator spend this
        // module exists to prevent, and a negative value used to arrive at the same place
        // through the env-override path. Same asymmetry as a missing store: the operator's
        // money fails closed, the tenant's own money does not.
        if (source === 'platform' && options.limits.perApp <= 0) {
            warn(
                '[ottaai] Refusing PLATFORM-paid inference: rateLimit.perApp is not a positive number, so there is ' +
                    'no ceiling on aggregate spend. Set a large perApp value rather than 0 if you intend a high cap.',
            );
            return false;
        }

        // EVERY DIMENSION IS CONSUMED, and all must pass. One is never enough: `perUser`
        // stops a single account looping, `perOrganization` stops a workspace fanning the
        // same abuse across seats, and `perApp` is the aggregate burst ceiling across every
        // account. `source: 'platform'` covers gateway-billed inference too, not just a
        // platform provider key — both spend the operator's money.
        const buckets: Array<{ dimension: string; id: string; limit: number }> = [
            { dimension: 'app', id: options.appId, limit: options.limits.perApp },
        ];
        if (userId) buckets.push({ dimension: 'user', id: userId, limit: options.limits.perUser });
        if (organizationId) {
            buckets.push({ dimension: 'org', id: organizationId, limit: options.limits.perOrganization });
        }

        const active = buckets.filter((bucket) => bucket.limit > 0);
        // Reachable only for BYOK with every dimension disabled — a platform call with
        // `perApp <= 0` was already refused above, and any positive `perApp` keeps that
        // bucket active.
        if (active.length === 0) return true;

        if (!options.store) {
            // THE ASYMMETRY, AND THE WHOLE REASON THIS LIVES IN THE QUOTA HOOK.
            //
            // Platform-paid inference fails CLOSED: a missing KV binding must not silently
            // convert into unlimited spend on the operator's provider account. A configured
            // platform key with no limiter is exactly the deployment mistake this guards.
            if (source === 'platform') {
                warn(
                    '[ottaai] Refusing PLATFORM-paid inference: no OBCF_KV binding, so the rate limiter is ' +
                        'unavailable and platform spend would be unbounded. Bind OBCF_KV, or unset the platform ' +
                        'provider key to run BYOK-only.',
                );
                return false;
            }
            // BYOK fails OPEN: the tenant is spending their own money against their own
            // provider's limits, so a missing binding here is an operator inconvenience, not
            // an operator cost. Bricking a tenant's paid feature over it would be worse.
            warn('[ottaai] Rate limiter unavailable (no OBCF_KV binding) — BYOK inference proceeding unthrottled.');
            return true;
        }

        // Fixed window. Approximate under concurrency by construction: KV is eventually
        // consistent and read-then-write is not atomic, so the effective ceiling is roughly
        // the configured limit plus the in-flight concurrency count. A hard global budget
        // would need a strongly consistent coordinator (a Durable Object); this is a
        // best-effort BURST control and is precisely why it is not sold as a quota.
        const window = Math.floor(now() / 1000 / WINDOW_SECONDS);
        const keyed = active.map((bucket) => ({
            ...bucket,
            key: `${KEY_PREFIX}${options.appId}:${bucket.dimension}:${bucket.id}:${window}`,
        }));

        /** Both storage failure paths refuse platform spend and let BYOK through. */
        const onStorageFailure = (stage: 'read' | 'write'): boolean => {
            // A STORAGE ERROR IS THE SAME CONDITION AS A MISSING BINDING. Treating a KV
            // outage as "allow" would make an outage the cheapest way to get unlimited
            // platform inference.
            if (source === 'platform') {
                warn(`[ottaai] Refusing PLATFORM-paid inference: rate-limiter storage ${stage} failed.`);
                return false;
            }
            return true;
        };

        // ── PREFLIGHT: read every dimension, check every dimension, write NOTHING yet ──
        //
        // THE ORDER-DEPENDENT VERSION OF THIS WAS A DENIAL-OF-SERVICE. Incrementing each
        // bucket as it passed meant a call rejected on a NARROW dimension had already
        // consumed a WIDER one: with perUser=20 and perApp=600, a single user's 21st call
        // incremented `app` and only then failed on `user` — so 580 further rejected calls,
        // costing that user nothing and spending no provider tokens, drained the app-wide
        // budget and denied AI to every other account for the rest of the minute.
        //
        // Reordering (user → org → app) would not have fixed it: a caller under their own
        // limit but over their ORG limit poisons `app` the same way. Only checking everything
        // before writing anything closes it.
        //
        // Reads run in PARALLEL — lower latency on the inference path, and it narrows the
        // read-to-write window that preflighting otherwise widens.
        let raw: Array<string | null>;
        try {
            raw = await Promise.all(keyed.map((bucket) => options.store!.get(bucket.key)));
        } catch {
            return onStorageFailure('read');
        }

        const counts = raw.map((value) => {
            const parsed = Number(value ?? '0');
            return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        });

        // Any dimension at its limit rejects the call WITHOUT consuming any budget at all.
        if (counts.some((count, index) => count >= keyed[index]!.limit)) return false;

        // ── COMMIT: all dimensions passed, so charge all of them ──
        try {
            await Promise.all(
                keyed.map((bucket, index) =>
                    options.store!.put(bucket.key, String(counts[index]! + 1), {
                        expirationTtl: WINDOW_SECONDS * 2,
                    }),
                ),
            );
        } catch {
            // A partial write leaves some dimensions charged and others not. That over-counts,
            // i.e. it errs toward refusing — the safe direction for a spend control.
            return onStorageFailure('write');
        }

        return true;
    };
}

/**
 * The operator-facing warning for "paid inference is enabled but unprotected".
 *
 * Returns null when the deployment is fine. Surfaced at boot AND in the boot summary, because
 * the failure mode is silent by nature: everything works, and the bill arrives later. It names
 * both conditions the limiter fails closed on, so the boot log matches what a caller would
 * actually experience rather than only covering the missing-binding case.
 *
 * `platformRouteUsable` COMES FROM THE PACKAGE'S BOOT SUMMARY, which asks the transport
 * whether a platform call can actually be made. Deriving it here from "is a provider key
 * set?" was wrong in the direction that matters: gateway-billed inference has no provider
 * key, so a key-based predicate stayed silent on precisely the deployment that could spend
 * the operator's money without a limiter. The runtime refusal was correct either way — this
 * is about the operator finding out at boot rather than from per-call warnings.
 */
export function platformSpendWarning(
    env: CloudflareEnv,
    platformRouteUsable: boolean,
    limits: OttaaiRateLimitConfig,
): string | null {
    if (!platformRouteUsable) return null;

    if (!env.OBCF_KV) {
        return (
            'A usable platform AI route is configured but OBCF_KV is not bound, so inference cannot be rate ' +
            'limited. Platform-paid calls will be REFUSED until you bind OBCF_KV (or remove the platform route).'
        );
    }

    if (limits.perApp <= 0) {
        return (
            'A usable platform AI route is configured but rateLimit.perApp is not positive, so there is no ceiling ' +
            'on aggregate spend. Platform-paid calls will be REFUSED. Set a large perApp value rather than 0 if ' +
            'you intend a high cap — perUser and perOrganization bound one actor each, not the total.'
        );
    }

    return null;
}

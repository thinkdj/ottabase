// ============================================================
// @ottabase/ottaai — Verify a key + the shipped rate limiter
// ============================================================
// MECHANISM: a real but minimal inference call — 1 max token, temperature 0,
// SKIP CACHE, ~15 s timeout (long enough for a cold provider, short enough that a
// form does not hang), tagged as verification traffic so it is excludable from
// cost analytics.
//
// VERIFICATION REUSES THE PRODUCTION MERGE PATH EXACTLY. A parallel test path is
// the natural implementation and it drifts within a release.
// ============================================================

import { decryptSecret } from '../crypto';
import { AI_ERROR_CODES, AI_ERROR_MESSAGES, AiProvisioningError, type AiErrorCode } from '../errors';
import { isDynamicModelRef, modelProviderMismatch } from '../model-ref';
import { mergeConfig } from '../pure';
import { normalizeSubmittedSecret, redactSecrets, SecretValue } from '../secret';
import type { AiContext, CredentialRecord } from '../types';
import type { AiProvisioning } from './index';

/** How long a verification call may take before it is abandoned. */
export const VERIFY_TIMEOUT_MS = 15_000;

export interface VerifyResult {
    /** `true` only when the provider actually accepted the credential. */
    ok: boolean;
    /** Always present. BRANCH ON THIS, never on `ok` alone. */
    code: AiErrorCode;
    message: string;
    provider: string;
    model: string | null;
    /** Upstream status when there was one — useful in operator surfaces. */
    status?: number;
}

export type VerifyInput =
    | {
          /** Mode 1: a typed, pre-save key. */
          kind: 'inline';
          provider: string;
          model?: string | null;
          secret: string;
      }
    | {
          /**
           * Mode 2: re-test a SAVED key.
           *
           * THIS MODE EXISTS BECAUSE OF A TRAP. On an edit form the key field is blank
           * (never prefilled), so testing the TYPED values would send no key at all, fall
           * through to the platform key, and report A CHEERFUL SUCCESS FOR A BROKEN
           * CREDENTIAL. The form switches to this mode on
           * `(editing && provider unchanged && key field empty)`.
           */
          kind: 'saved';
          credentialId: string;
      };

/**
 * A per-actor verification budget, counted INSIDE the package before any outbound call.
 *
 * THE PACKAGE SHIPS THE LIMITER because documentation-only security requirements are
 * inherited as gaps, and this is the case that most needs the rule. TWO ABUSES, NOT ONE:
 *
 *  1. COST — each verification is a real billable provider call; an unmetered Test button
 *     is a free inference proxy for anyone with an account.
 *  2. THE ORACLE, WHICH IS WORSE — mode 1 accepts an ARBITRARY provider and an ARBITRARY
 *     unsaved secret and returns a crisp INVALID_KEY / RATE_LIMITED / MODEL_NOT_FOUND
 *     classification: a general-purpose validator for third-party API keys obtained
 *     elsewhere, running from the operator's IP range and, in a gateway deployment,
 *     through the operator's gateway account. The operator becomes credential-stuffing
 *     infrastructure for someone else's key dump — and it is invisible, because no row is
 *     ever written.
 */
export interface VerifyLimiter {
    /** Return false to refuse. Must count mode 1 against the same budget as mode 2. */
    take(actorKey: string): boolean | Promise<boolean>;
}

/** Fail-closed default: a small per-actor budget over a rolling window, in memory. */
export function createDefaultVerifyLimiter(options?: { limit?: number; windowMs?: number }): VerifyLimiter {
    const limit = options?.limit ?? 10;
    const windowMs = options?.windowMs ?? 10 * 60 * 1000;
    const buckets = new Map<string, number[]>();
    return {
        take(actorKey) {
            const now = Date.now();
            const hits = (buckets.get(actorKey) ?? []).filter((t) => now - t < windowMs);
            if (hits.length >= limit) {
                buckets.set(actorKey, hits);
                return false;
            }
            hits.push(now);
            buckets.set(actorKey, hits);
            if (buckets.size > 2000) {
                for (const [key, times] of buckets) {
                    if (times.every((t) => now - t >= windowMs)) buckets.delete(key);
                }
            }
            return true;
        },
    };
}

export interface VerifyOptions {
    limiter?: VerifyLimiter;
    /** Overrides the actor key used for rate limiting. Defaults to `${orgId}:${userId}`. */
    actorKey?: string;
}

/**
 * Verify a provider credential.
 *
 * PACKAGE CONTRACT — this function GUARANTEES it:
 *  • never throws;
 *  • always returns a classified result;
 *  • always skips cache (a cached success will happily "validate" a key revoked five
 *    minutes ago);
 *  • always forces the credential's OWN provider — letting the platform default model
 *    leak in makes a valid key from one provider look invalid when tested against
 *    another provider's default;
 *  • never echoes the secret back, ON EVERY PATH INCLUDING ERROR AND TELEMETRY PATHS.
 */
export async function verifyCredential(
    instance: AiProvisioning<unknown>,
    context: AiContext,
    input: VerifyInput,
    options: VerifyOptions = {},
): Promise<VerifyResult> {
    const limiter = options.limiter ?? defaultLimiterFor(instance);
    const actorKey = options.actorKey ?? `${context.organizationId ?? '-'}:${context.userId ?? '-'}`;

    const allowed = await limiter.take(actorKey);
    if (!allowed) {
        return {
            ok: false,
            code: AI_ERROR_CODES.VERIFY_RATE_LIMITED,
            message: AI_ERROR_MESSAGES.VERIFY_RATE_LIMITED,
            provider: input.kind === 'inline' ? input.provider : '',
            model: null,
        };
    }

    let provider: string;
    let model: string | null;
    let secret: SecretValue | null = null;
    let alias: string | null = null;
    let record: CredentialRecord | null = null;

    try {
        if (input.kind === 'inline') {
            provider = input.provider;
            const trimmed = normalizeSubmittedSecret(input.secret);
            if (!trimmed) {
                return {
                    ok: false,
                    code: AI_ERROR_CODES.VALIDATION,
                    message: 'Enter an API key to test.',
                    provider,
                    model: null,
                };
            }
            secret = new SecretValue(trimmed);
            model = input.model ?? firstRegistryModel(instance, provider);
        } else {
            record = await instance.store.findByIdInScope(
                { organizationId: context.organizationId, userId: context.userId, appId: context.appId },
                input.credentialId,
            );
            if (!record) {
                // Same answer for "not found" and "not yours" — closes the existence oracle.
                return {
                    ok: false,
                    code: AI_ERROR_CODES.FORBIDDEN,
                    message: 'That provider connection could not be found.',
                    provider: '',
                    model: null,
                };
            }

            // A PRIVILEGED READ: testing a saved credential decrypts the org key and emits
            // it outbound on a member's command.
            const authorized = await instance.authorizeOp({
                context,
                operation: 'test',
                credential: { id: record.id, organizationId: record.organizationId, userId: record.userId },
            });
            if (!authorized) {
                return {
                    ok: false,
                    code: AI_ERROR_CODES.FORBIDDEN,
                    message: AI_ERROR_MESSAGES.FORBIDDEN,
                    provider: record.provider,
                    model: null,
                };
            }

            provider = record.provider;
            model = record.model ?? firstRegistryModel(instance, provider);

            if (record.secret.kind === 'inline') {
                secret = await decryptSecret({
                    envelope: record.secret.ciphertext,
                    keyring: instance.keyring,
                    registry: instance.decryptors,
                    aad: {
                        credentialId: record.id,
                        organizationId: record.organizationId,
                        userId: record.userId,
                        appId: record.appId,
                        provider: record.provider,
                    },
                });
            } else if (record.secret.kind === 'alias') {
                alias = record.secret.alias;
            }
        }
    } catch (error) {
        const code =
            error instanceof AiProvisioningError && error.code !== AI_ERROR_CODES.ERROR
                ? error.code
                : AI_ERROR_CODES.CREDENTIAL_UNREADABLE;
        return {
            ok: false,
            code,
            message: AI_ERROR_MESSAGES[code] ?? AI_ERROR_MESSAGES.CREDENTIAL_UNREADABLE,
            provider: record?.provider ?? '',
            model: null,
        };
    }

    // ADMISSION, BEFORE ANYTHING GOES OUT.
    //
    // The limiter is a BUDGET, not an admission control, and this endpoint takes a
    // caller-supplied provider and model verbatim in mode 1. Without this the write path's
    // rules — registered provider, tenant-selectable provider, no operator-only
    // `dynamic/<route>` ref — are enforced on `POST /credentials` and silently NOT enforced
    // on `POST /credentials/test`, which reaches the same transport with the same operator
    // gateway token. The write path is not the only door.
    const refused = admitVerifyTarget(instance, provider, model);
    if (refused) return refused;

    // Build a SYNTHETIC resolved credential and run it through the PRODUCTION merge.
    const synthetic: CredentialRecord = record ?? {
        id: 'verify',
        label: null,
        provider,
        model,
        secret: secret ? { kind: 'inline', ciphertext: '' } : { kind: 'none' },
        keyHint: '',
        enabled: true,
        isActive: true,
        organizationId: context.organizationId,
        userId: context.userId,
        appId: context.appId,
        createdAt: 0,
        updatedAt: 0,
        transportConfig: null,
        keyId: null,
        formatVersion: null,
        lastUsedAt: null,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorCode: null,
        consecutiveFailures: 0,
    };

    const merged = mergeConfig({
        platform: instance.platform,
        registry: instance.registry,
        credential: synthetic,
        tenantSecret: secret,
        model,
        taskKey: '__verify__',
        context,
    });
    // Force the credential's OWN provider and its own alias; never let a platform key ride along.
    merged.alias = alias;

    if (!instance.transport.isComplete(merged)) {
        return {
            ok: false,
            code: AI_ERROR_CODES.NOT_CONFIGURED,
            message: AI_ERROR_MESSAGES.NOT_CONFIGURED,
            provider,
            model,
        };
    }

    const sentinels = [secret?.expose(), alias, instance.platform.providerKey, instance.platform.gatewayToken];

    try {
        const client = instance.transport.createClient(merged);
        const response = await client.complete({
            messages: [{ role: 'user', content: 'ping' }],
            maxTokens: 1,
            temperature: 0,
            skipCache: true,
            timeout: VERIFY_TIMEOUT_MS,
            metadata: { verification: 'true', task: '__verify__' },
        });

        if (response.ok) {
            return { ok: true, code: AI_ERROR_CODES.ERROR, message: 'Key verified.', provider, model };
        }

        const status = response.error.statusCode;
        const code: AiErrorCode =
            status === 401 || status === 403
                ? AI_ERROR_CODES.INVALID_KEY
                : status === 404
                  ? AI_ERROR_CODES.MODEL_NOT_FOUND
                  : status === 429
                    ? AI_ERROR_CODES.RATE_LIMITED
                    : /abort|timeout/i.test(response.error.message)
                      ? AI_ERROR_CODES.TIMEOUT
                      : AI_ERROR_CODES.ERROR;

        return {
            ok: false,
            code,
            // The `ERROR` arm carries a SANITISED string only.
            message:
                code === AI_ERROR_CODES.ERROR
                    ? redactSecrets(response.error.message, sentinels)
                    : AI_ERROR_MESSAGES[code],
            provider,
            model,
            ...(status !== undefined ? { status } : {}),
        };
    } catch (error) {
        return {
            ok: false,
            code: AI_ERROR_CODES.ERROR,
            message: redactSecrets(error instanceof Error ? error.message : String(error), sentinels),
            provider,
            model,
        };
    }
}

/**
 * The fallback budget. MODULE-SCOPED, NOT PER-INSTANCE — and that distinction is the whole
 * point of this comment.
 *
 * The provisioning instance is built PER REQUEST in this framework (edge bindings only
 * exist per request), so a limiter attached to the instance would reset on every request
 * and enforce nothing at all: the Test button would still be a free credential-stuffing
 * oracle, just with a limiter object present to make it look guarded. Module scope at
 * least survives for the life of the isolate.
 *
 * IT IS STILL A FALLBACK, NOT THE ANSWER. An isolate is not a deployment: Cloudflare spins
 * up many, and an attacker rotating connections gets a fresh budget on each. A production
 * host MUST pass a DURABLE limiter (KV counter, or the `OBCF_RATE_LIMITER` binding) via
 * `handlers.verifyLimiter`. `createKvVerifyLimiter` below is the shipped adapter.
 */
const moduleVerifyLimiter = createDefaultVerifyLimiter();

function defaultLimiterFor(_instance: AiProvisioning<unknown>): VerifyLimiter {
    return moduleVerifyLimiter;
}

/** Storage shape a durable limiter needs — satisfied by a Cloudflare KV namespace. */
export interface VerifyLimiterStore {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * A DURABLE per-actor verification budget, backed by the host's KV.
 *
 * Survives isolate churn, which the in-memory fallback does not. Fails CLOSED on a storage
 * error: an unmetered verify endpoint is a credential-stuffing oracle running from the
 * operator's IP range, so "KV is down" must not mean "unlimited".
 *
 * KV is eventually consistent, so the count is approximate under concurrency — that is
 * acceptable here (the tolerance is roughly the in-flight concurrency count) and is exactly
 * why this is a budget rather than a hard quota.
 */
export function createKvVerifyLimiter(
    store: VerifyLimiterStore,
    options?: { limit?: number; windowSeconds?: number; prefix?: string },
): VerifyLimiter {
    const limit = options?.limit ?? 10;
    const windowSeconds = options?.windowSeconds ?? 600;
    const prefix = options?.prefix ?? 'ottaai:verify:';

    return {
        async take(actorKey) {
            const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
            const key = `${prefix}${actorKey}:${bucket}`;
            try {
                const current = Number((await store.get(key)) ?? '0');
                if (Number.isFinite(current) && current >= limit) return false;
                await store.put(key, String((Number.isFinite(current) ? current : 0) + 1), {
                    expirationTtl: windowSeconds * 2,
                });
                return true;
            } catch {
                return false;
            }
        },
    };
}

function firstRegistryModel(instance: AiProvisioning<unknown>, provider: string): string | null {
    return instance.registry.get(provider)?.models?.[0]?.id ?? null;
}

/**
 * The same admission rules the write path applies, applied to a test.
 *
 * Returns a classified refusal, or null when the target is admissible. It runs for BOTH
 * modes: mode 1 because the values come straight from the request body, and mode 2 because a
 * row can predate a rule, arrive through generic auto-CRUD, or be written directly to the
 * database — and "we already validated it on the way in" is exactly the assumption that
 * makes those rows invisible.
 *
 * WHY EACH ONE MATTERS HERE SPECIFICALLY:
 *
 *  • `dynamic/<route>` is OPERATOR NAMESPACE. A tenant who tests one gets a request pointed
 *    at the operator's gateway route, spending the operator's budget, with a tenant-supplied
 *    key that the route may not even use — the exact bypass the write path already refuses.
 *  • An unregistered or platform-only provider produces a call that cannot succeed, so a real
 *    outbound attempt only buys a confusing upstream error and a billable request.
 *  • A cross-provider model ref routes to one provider while authenticating for another.
 */
function admitVerifyTarget(
    instance: AiProvisioning<unknown>,
    provider: string,
    model: string | null,
): VerifyResult | null {
    const refuse = (message: string): VerifyResult => ({
        ok: false,
        code: AI_ERROR_CODES.VALIDATION,
        message,
        provider,
        model: null,
    });

    if (isDynamicModelRef(model)) {
        return refuse('A dynamic/<route> model reference is operator-only and cannot be tested.');
    }

    if (!instance.registry.isTenantSelectable(provider)) {
        return refuse(
            instance.registry.has(provider)
                ? `Provider "${provider}" cannot be used for a saved credential on this deployment.`
                : `Unknown provider "${provider}".`,
        );
    }

    const mismatch = modelProviderMismatch(provider, model, instance.registry);
    if (mismatch) return refuse(mismatch);

    return null;
}

/**
 * The headless form state machine, shipped so every consumer does not re-derive the same
 * four-way condition (and duplicate the provider-switch rule in the client).
 */
export function verifyFormState(input: {
    editing: boolean;
    providerChanged: boolean;
    providerRequiresKey: boolean;
    keyTyped: boolean;
}): { needsKey: boolean; canTest: boolean; canSave: boolean; testMode: 'inline' | 'saved' } {
    const needsKey = input.providerRequiresKey && (!input.editing || input.providerChanged);
    const testMode: 'inline' | 'saved' =
        input.editing && !input.providerChanged && !input.keyTyped ? 'saved' : 'inline';
    return {
        needsKey,
        canTest: testMode === 'saved' || input.keyTyped || !input.providerRequiresKey,
        canSave: !needsKey || input.keyTyped,
        testMode,
    };
}

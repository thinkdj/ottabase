// ============================================================
// @ottabase/ottaai — EventSink
// ============================================================
// Console warnings are unroutable, unsilenceable and unqueryable inside a package.
//
// EVENTS ARE PUBLIC API: stable names and payload shapes; renaming one is a
// breaking change.
//
// EVENT PAYLOADS ARE AN ALLOW-LIST, NOT A CONVENIENCE. Every one of these is
// emitted at a point where the credential record or the merged config is in
// scope, so the natural debugging instinct is exactly the leak. The types below
// are written so the forbidden shapes DO NOT COMPILE.
// ============================================================

import type { CredentialVerdict, ResolutionReason, ResolutionSource } from '../types';

interface TenancyFields {
    appId: string | null;
    organizationId: string | null;
    userId: string | null;
}

export interface CredentialResolvedEvent extends TenancyFields {
    credentialId: string | null;
    source: ResolutionSource;
    reason: ResolutionReason;
    tenantReason: ResolutionReason | null;
    provider: string | null;
    model: string | null;
    taskKey: string;
}

export interface CredentialSkippedEvent extends CredentialResolvedEvent {
    verdict: CredentialVerdict | 'MERGE_INCOMPLETE' | 'KEYLESS_MISMATCH';
}

export interface CredentialDecryptFailedEvent extends TenancyFields {
    credentialId: string;
    /**
     * The CODE only — never the envelope. Together with `keyId` + `formatVersion` this is
     * exactly what diagnosis needs: EVERY row failing decrypt means the wrong master
     * secret is deployed; ONE row failing bad-ciphertext means foreign or corrupt data.
     */
    errorCode: string;
    keyId: string | null;
    formatVersion: string | null;
    taskKey: string;
}

export interface CallCompletedEvent extends TenancyFields {
    correlationId: string;
    credentialId: string | null;
    source: ResolutionSource;
    provider: string;
    model: string | null;
    taskKey: string;
    /** Separates text completions from embedding calls in host-side accounting. */
    operation: 'chat' | 'embedding';
    inputTokens: number | null;
    outputTokens: number | null;
    cachedTokens: number | null;
    latencyMs: number;
    outcome: 'success' | 'error';
    errorCode?: string;
}

export interface CallDegradedEvent extends TenancyFields {
    correlationId: string;
    credentialId: string | null;
    taskKey: string;
    fromSource: 'byok';
    toSource: 'platform';
    /** The upstream status that triggered the single retry. Only 401/403 can. */
    triggerStatus: number;
}

export interface QuotaExceededEvent extends TenancyFields {
    taskKey: string;
    source: ResolutionSource;
}

export interface KeyRewrappedEvent {
    credentialId: string;
    fromKeyId: string | null;
    toKeyId: string;
    formatVersion: string;
}

export interface CredentialHealthChangedEvent extends TenancyFields {
    credentialId: string;
    /** Coarse bucket used for dedupe, so a tenant with a dead key and a chatty app gets ONE signal. */
    errorClass: string;
    consecutiveFailures: number;
    provider: string;
    keyHint: string;
}

/** The complete event map. Adding a member is additive; renaming one is breaking. */
export interface AiEventMap {
    'credential.resolved': CredentialResolvedEvent;
    'credential.skipped': CredentialSkippedEvent;
    'credential.decrypt_failed': CredentialDecryptFailedEvent;
    'credential.health_changed': CredentialHealthChangedEvent;
    'call.completed': CallCompletedEvent;
    'call.degraded': CallDegradedEvent;
    'quota.exceeded': QuotaExceededEvent;
    'key.rewrapped': KeyRewrappedEvent;
}

export type AiEventName = keyof AiEventMap;

/**
 * A host-supplied route to wherever events belong (analytics, logger, a queue).
 *
 * TREAT A SINK AS PUBLIC: it is someone else's aggregator. Never widen a payload
 * to carry a `CredentialRecord`, a secret union in any form, a merged transport
 * config, a headers map, a request/response body, or a raw upstream error object.
 */
export type EventSink = <K extends AiEventName>(event: K, payload: AiEventMap[K]) => void;

/** The default sink: silence. A package that console.warns is a package you cannot quiet. */
export const noopEventSink: EventSink = () => {};

/**
 * Dedupe wrapper for failing-key detection.
 *
 * DETECTION AND DEDUPLICATION BELONG TO THE PACKAGE — without package-side dedupe,
 * the first consumer to add notification ships a mail bomb.
 */
export function createDedupedHealthSink(sink: EventSink, bucketMs = 15 * 60 * 1000): EventSink {
    const seen = new Map<string, number>();
    return ((event, payload) => {
        if (event === 'credential.health_changed') {
            const p = payload as CredentialHealthChangedEvent;
            const bucket = Math.floor(Date.now() / bucketMs);
            const key = `${p.credentialId}:${p.errorClass}:${bucket}`;
            if (seen.has(key)) return;
            seen.set(key, bucket);
            // Bound the map so a long-lived isolate cannot grow it without limit.
            if (seen.size > 500) {
                for (const [k, b] of seen) if (b < bucket) seen.delete(k);
            }
        }
        sink(event, payload);
    }) as EventSink;
}

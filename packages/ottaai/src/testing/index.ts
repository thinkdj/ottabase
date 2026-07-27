// ====================================================================
// @ottabase/ottaai/testing
// --------------------------------------------------------------------
// NOTE: a `./testing` subpath has no precedent in this monorepo. Shipping it is
// deliberate — it is what makes the resolution tables a test matrix rather than an
// integration-test problem — but flag it as a NEW CONVENTION when reviewing.
// ====================================================================

import { createKeyring, type Keyring } from '../crypto';
import type { CredentialStore, StoreScope } from '../resolver/store';
import type {
    AiCallError,
    AiCallOptions,
    AiCallResult,
    AiStreamEvent,
    RawAiClient,
    TransportAdapter,
} from '../resolver/transport';
import type { AiStrategy, CredentialRecord, MergedTransportConfig } from '../types';

// ---------------------------------------------------------------------------
// Deterministic keyring
// ---------------------------------------------------------------------------

/** 32+ bytes of fixed material — enough entropy to pass the composition check. */
export const TEST_MASTER_SECRET = 'dGVzdC1tYXN0ZXItc2VjcmV0LWZvci1vdHRhYWktMzJieXRlcy1taW5pbXVt';

export function createTestKeyring(overrides?: Record<string, string>, currentKeyId = 'test'): Keyring {
    return createKeyring({
        keys: { test: TEST_MASTER_SECRET, ...overrides },
        currentKeyId,
    });
}

// ---------------------------------------------------------------------------
// Fixtures — PLAIN RECORDS, never ORM instances
// ---------------------------------------------------------------------------

let fixtureCounter = 0;

export function credentialFixture(overrides: Partial<CredentialRecord> = {}): CredentialRecord {
    fixtureCounter += 1;
    return {
        id: `cred-${String(fixtureCounter).padStart(4, '0')}`,
        label: null,
        provider: 'openai',
        model: null,
        secret: { kind: 'inline', ciphertext: 'v1.test.AAAA.BBBB.CCCC' },
        keyHint: '••••abcd',
        enabled: true,
        isActive: true,
        organizationId: null,
        userId: 'user-1',
        appId: 'app-1',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
        transportConfig: null,
        keyId: 'test',
        formatVersion: 'v1',
        lastUsedAt: null,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorCode: null,
        consecutiveFailures: 0,
        ...overrides,
    };
}

export function resetFixtureCounter(): void {
    fixtureCounter = 0;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

export interface MemoryStore extends CredentialStore {
    seed(records: CredentialRecord[]): void;
    all(): CredentialRecord[];
}

export function createMemoryStore(initial: CredentialRecord[] = []): MemoryStore {
    let rows = [...initial];

    return {
        seed(records) {
            rows = [...records];
        },
        all() {
            return [...rows];
        },

        async findCandidates(scope: StoreScope, strategy: AiStrategy) {
            // Mirrors the real store's TWO-QUERY fan-out, including the duplicate a
            // both-dimension row produces — the resolver's de-dupe must be exercised.
            const out: CredentialRecord[] = [];
            if (strategy !== 'org' && scope.userId) {
                out.push(...rows.filter((row) => row.userId === scope.userId));
            }
            if (strategy !== 'user' && scope.organizationId) {
                out.push(...rows.filter((row) => row.organizationId === scope.organizationId));
            }
            return out;
        },

        async findByIdInScope(scope, id) {
            const row = rows.find((candidate) => candidate.id === id);
            if (!row) return null;
            const userMatch = scope.userId !== null && row.userId === scope.userId;
            const orgMatch = scope.organizationId !== null && row.organizationId === scope.organizationId;
            if (!userMatch && !orgMatch) return null;
            // MUST MIRROR THE REAL STORE EXACTLY, including this: management is strict on the
            // app dimension on BOTH sides, so an unbound (`appId: null`) row is not a wildcard.
            // A double that is laxer than the thing it stands in for is how the app-isolation
            // fix would look green while the shipped store still leaked.
            if ((scope.appId ?? null) !== (row.appId ?? null)) return null;
            return row;
        },

        async markActive(id) {
            const target = rows.find((row) => row.id === id);
            if (!target) return false;
            for (const row of rows) {
                if (
                    row.organizationId === target.organizationId &&
                    row.userId === target.userId &&
                    row.appId === target.appId
                ) {
                    row.isActive = row.id === id;
                }
            }
            return true;
        },

        async recordOutcome(id, outcome) {
            const row = rows.find((candidate) => candidate.id === id);
            if (!row) return;
            row.lastUsedAt = outcome.at;
            if (outcome.ok) {
                row.lastSuccessAt = outcome.at;
                row.lastErrorCode = null;
                row.consecutiveFailures = 0;
            } else {
                row.lastErrorAt = outcome.at;
                row.lastErrorCode = outcome.errorCode ?? 'ERROR';
                row.consecutiveFailures += 1;
            }
        },

        async *iterateByKeyId(keyId, batchSize) {
            const matching = rows.filter((row) => row.keyId === keyId);
            for (let index = 0; index < matching.length; index += batchSize) {
                yield matching.slice(index, index + batchSize);
            }
        },

        async replaceSecret(id, next, expect) {
            const row = rows.find((candidate) => candidate.id === id);
            if (!row || row.keyId !== expect.keyId || row.secret.kind !== 'inline') return false;
            row.secret = { kind: 'inline', ciphertext: next.ciphertext };
            row.keyId = next.keyId;
            row.formatVersion = next.formatVersion;
            return true;
        },

        async deleteById(id) {
            const before = rows.length;
            rows = rows.filter((row) => row.id !== id);
            return rows.length < before;
        },

        async countByEnvelopeKeyId(keyId) {
            return rows.filter(
                (row) => row.secret.kind === 'inline' && row.secret.ciphertext.startsWith(`v1.${keyId}.`),
            ).length;
        },
    };
}

// ---------------------------------------------------------------------------
// Mock transport
// ---------------------------------------------------------------------------

export interface MockTransportScript {
    /** Force a specific upstream status for the next call(s). */
    status?: number;
    /** Force a network-level throw. */
    throws?: Error;
    /** Emit an auth failure INSIDE a 200 stream (the case status codes cannot express). */
    inStreamError?: { statusCode?: number; message: string };
    /** Fixed completion text. */
    text?: string;
    /** Token counts to report. `null` reproduces the "streaming omits usage" bug. */
    tokens?: AiCallResult['tokens'];
    /** Reject as if the request timed out. */
    timeout?: boolean;
}

export interface MockTransport extends TransportAdapter {
    /** Every merged config the adapter was asked to build a client for. */
    readonly configs: MergedTransportConfig[];
    /** Every call the mock served, with the options it received. */
    readonly calls: Array<{ kind: 'complete' | 'stream'; options: AiCallOptions }>;
    script(next: MockTransportScript): void;
    reset(): void;
}

/**
 * A transport that never touches the network.
 *
 * Its scriptable failure modes exist because the conformance suite must cover 401, 403,
 * 404, 429, timeout, a network throw, AND an auth failure arriving inside a 200 stream —
 * that last one is the case a status-code-only test suite silently misses.
 */
export function createMockTransport(initial: MockTransportScript = {}): MockTransport {
    let scripted: MockTransportScript = { ...initial };
    const configs: MergedTransportConfig[] = [];
    const calls: Array<{ kind: 'complete' | 'stream'; options: AiCallOptions }> = [];

    function failure(): AiCallError | null {
        if (scripted.throws) throw scripted.throws;
        if (scripted.timeout) {
            return { retryable: false, message: 'Request timed out after 15000ms' };
        }
        if (scripted.status && scripted.status >= 400) {
            return {
                statusCode: scripted.status,
                retryable: scripted.status >= 500 || scripted.status === 429,
                message: `Upstream returned ${scripted.status}`,
            };
        }
        return null;
    }

    return {
        name: 'mock',
        configs,
        calls,
        script(next) {
            scripted = { ...next };
        },
        reset() {
            scripted = {};
            configs.length = 0;
            calls.length = 0;
        },
        isComplete: (config) => Boolean(config.provider),
        createClient(config): RawAiClient {
            configs.push(config);
            return {
                async complete(options) {
                    calls.push({ kind: 'complete', options });
                    const error = failure();
                    if (error) return { ok: false, error };
                    return {
                        ok: true,
                        result: {
                            text: scripted.text ?? 'ok',
                            tokens: scripted.tokens === undefined ? { input: 1, output: 1 } : scripted.tokens,
                            model: config.model ?? '',
                            provider: config.provider,
                            raw: null,
                        },
                    };
                },
                async *stream(options): AsyncIterable<AiStreamEvent> {
                    calls.push({ kind: 'stream', options });
                    const error = failure();
                    if (error) {
                        yield { type: 'error', error };
                        return;
                    }
                    yield { type: 'delta', text: scripted.text ?? 'ok' };
                    if (scripted.inStreamError) {
                        yield {
                            type: 'error',
                            error: {
                                statusCode: scripted.inStreamError.statusCode,
                                retryable: false,
                                message: scripted.inStreamError.message,
                            },
                        };
                    }
                    if (scripted.tokens !== null) {
                        yield { type: 'usage', tokens: scripted.tokens ?? { input: 1, output: 1 } };
                    }
                    yield { type: 'done', model: config.model ?? undefined };
                },
            };
        },
    };
}

// ---------------------------------------------------------------------------
// Strict mode
// ---------------------------------------------------------------------------

export class StrictModeViolation extends Error {
    constructor(taskKey: string, reason: string) {
        super(
            `[ottaai strict mode] Task "${taskKey}" fell through to the platform (reason: ${reason}). ` +
                'In development the platform fallback is ALWAYS configured, so a broken BYOK-required path ' +
                'resolves successfully and every test passes — right up until production, where it presents as ' +
                'a billing inversion or a gate that never engages.',
        );
        this.name = 'StrictModeViolation';
    }
}

/**
 * Wrap an event sink so an UNEXPECTED platform fall-through fails the test.
 *
 * Pass the task keys that are legitimately allowed to run on the platform.
 */
export function strictModeSink(allowPlatformFor: string[] = []) {
    const allowed = new Set(allowPlatformFor);
    return ((event: string, payload: Record<string, unknown>) => {
        if (event !== 'credential.resolved') return;
        if (payload.source !== 'platform') return;
        const taskKey = String(payload.taskKey);
        if (allowed.has(taskKey)) return;
        throw new StrictModeViolation(taskKey, String(payload.tenantReason ?? payload.reason));
    }) as unknown as import('../resolver/events').EventSink;
}

/**
 * SECRET-HYGIENE ASSERTIONS — behavioural tests are not enough.
 *
 * Given a scripted sentinel, assert it appears in NO url, NO query string, NO log call,
 * NO retry payload, NO emitted event, and in NO thrown error's `message`, `stack` or
 * enumerable properties — INCLUDING on the 401, 429, timeout, network-throw and
 * in-stream-failure paths.
 */
export function assertNoSecretLeak(sentinel: string, ...values: unknown[]): void {
    for (const value of values) {
        const serialised = safeStringify(value);
        if (serialised.includes(sentinel)) {
            throw new Error(
                `Secret sentinel leaked into a value that crosses the package boundary: ${serialised.slice(0, 400)}`,
            );
        }
    }
}

function safeStringify(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (value instanceof Error) {
        return [value.message, value.stack ?? '', safeStringify({ ...value })].join(' ');
    }
    try {
        return JSON.stringify(value, (_key, entry) => (entry instanceof Error ? entry.message : entry)) ?? '';
    } catch {
        return String(value);
    }
}

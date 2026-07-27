// ============================================================
// @ottabase/ottaai — Master-secret rotation (the package owns it)
// ============================================================
// "Rotation invalidates every stored key; build a re-wrap path if you need one"
// is an acceptable deferral for one app and an ABDICATION for a package: every
// consumer builds a worse version, and several build it under incident pressure
// after a leak.
//
// FOUR STATES, DERIVED not stored (keyring shape + currentKeyId determines them,
// so there is no state row to get out of sync with reality):
//
//   single → dual  (new secret in the ring, old still primary, both readable)
//          → drain (new secret primary, background re-wrap running, old readable)
//          → retire(old removed — PERMITTED ONLY at the zero-rows ENVELOPE scan)
// ============================================================

import { decryptSecret, encryptSecret, parseEnvelopeOrNull, type DecryptorRegistry, type Keyring } from '../crypto';
import { AI_ERROR_CODES, AiProvisioningError } from '../errors';
import type { EventSink } from '../resolver/events';
import type { CredentialStore } from '../resolver/store';

export interface RewrapOptions {
    keyring: Keyring;
    decryptors: DecryptorRegistry;
    store: CredentialStore;
    /** The key id being drained. */
    fromKeyId: string;
    batchSize?: number;
    emit?: EventSink;
}

export interface RewrapProgress {
    scanned: number;
    rewrapped: number;
    skipped: number;
    failed: Array<{ credentialId: string; errorCode: string }>;
}

/**
 * Re-wrap every credential still on `fromKeyId` under the keyring's current primary.
 *
 * RESUMABLE AND IDEMPOTENT. Drive it from `@ottabase/queue` or `@ottabase/cron` — the
 * package ships the iteration, the app owns the schedule.
 *
 * THIS IS THE ONLY PROCESS THAT HOLDS EVERY TENANT'S PLAINTEXT AT ONCE. Therefore it:
 *  • logs COUNTS AND KEY IDS ONLY, never a row;
 *  • writes no intermediate state containing plaintext or ciphertext outside the table;
 *  • records `{credentialId, errorCode}` and nothing more on batch failure;
 *  • holds each plaintext for the span of ONE row.
 * There is no log level at which it emits a secret — the verbose mode operators reach for
 * under incident pressure is exactly when that matters.
 */
export async function rewrapCredentials(options: RewrapOptions): Promise<RewrapProgress> {
    const batchSize = options.batchSize ?? 50;
    const progress: RewrapProgress = { scanned: 0, rewrapped: 0, skipped: 0, failed: [] };

    if (options.fromKeyId === options.keyring.currentKeyId) {
        throw new AiProvisioningError(
            `fromKeyId "${options.fromKeyId}" is already the keyring's primary. Add the new secret and set it as ` +
                'currentKeyId before draining the old one.',
            AI_ERROR_CODES.CONFIGURATION,
        );
    }
    if (!options.keyring.has(options.fromKeyId)) {
        throw new AiProvisioningError(
            `fromKeyId "${options.fromKeyId}" is not in the keyring, so its rows cannot be read. Keep the retiring ` +
                'secret in the ring (state: drain) until the envelope scan reports zero rows.',
            AI_ERROR_CODES.NO_ENCRYPTION_KEY,
        );
    }

    for await (const batch of options.store.iterateByKeyId(options.fromKeyId, batchSize)) {
        for (const record of batch) {
            progress.scanned += 1;
            if (record.secret.kind !== 'inline') {
                progress.skipped += 1;
                continue;
            }
            // Trust the ENVELOPE, not the index column.
            const parsed = parseEnvelopeOrNull(record.secret.ciphertext);
            if (!parsed || parsed.keyId !== options.fromKeyId) {
                progress.skipped += 1;
                continue;
            }

            const aad = {
                credentialId: record.id,
                organizationId: record.organizationId,
                userId: record.userId,
                appId: record.appId,
                provider: record.provider,
            };

            try {
                // AAD binding means this RE-DERIVES the binding rather than treating the
                // blob as opaque — one plaintext, held for the span of one row.
                const plaintext = await decryptSecret({
                    envelope: record.secret.ciphertext,
                    keyring: options.keyring,
                    registry: options.decryptors,
                    aad,
                });
                const wrapped = await encryptSecret({
                    plaintext: plaintext.expose(),
                    keyring: options.keyring,
                    aad,
                });
                const replaced = await options.store.replaceSecret(
                    record.id,
                    { ciphertext: wrapped.envelope, keyId: wrapped.keyId, formatVersion: wrapped.formatVersion },
                    { keyId: record.keyId },
                );
                if (replaced) {
                    progress.rewrapped += 1;
                    options.emit?.('key.rewrapped', {
                        credentialId: record.id,
                        fromKeyId: options.fromKeyId,
                        toKeyId: wrapped.keyId,
                        formatVersion: wrapped.formatVersion,
                    });
                } else {
                    // A concurrent tenant edit moved the row — it is already on a newer key.
                    progress.skipped += 1;
                }
            } catch (error) {
                progress.failed.push({
                    credentialId: record.id,
                    errorCode: error instanceof AiProvisioningError ? error.code : AI_ERROR_CODES.DECRYPT_FAILED,
                });
            }
        }
    }

    return progress;
}

/**
 * Whether a retiring key id may safely be removed from the keyring.
 *
 * NEVER GATE AN IRREVERSIBLE OPERATION ON THE INDEX COLUMN. The completion criterion is a
 * scan asserting zero rows whose ENVELOPE begins with the retiring key id.
 *
 * Additionally — because there is no reveal path, an over-eager retirement is
 * unrecoverable — KEEP THE RETIRED SECRET IN COLD ESCROW for one full backup-retention
 * period.
 */
export async function canRetireKey(
    store: CredentialStore,
    keyId: string,
): Promise<{ safe: boolean; remaining: number }> {
    const remaining = await store.countByEnvelopeKeyId(keyId);
    return { safe: remaining === 0, remaining };
}

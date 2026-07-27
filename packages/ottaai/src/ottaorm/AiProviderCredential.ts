// ============================================================
// @ottabase/ottaai — AiProviderCredential model (write path lives HERE)
// ============================================================
// OTTAORM HAS NO LIFECYCLE HOOKS. There is no beforeCreate/afterSave/registerHook
// anywhere in it. The ONLY pre-persist point is overriding the model's static
// `create`/`update`, preserving the generic signature (the optional driver
// parameter MUST pass through) and calling `super.X.call(this, …)`.
//
// An implementer will hunt for hooks, not find them, and reach for a route
// handler — a bug waiting for the second write path, because generic auto-CRUD
// calls the model statics directly.
// ============================================================

import type { DbDriver } from '@ottabase/db/drizzle';
import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { eq, sql } from 'drizzle-orm';
import { encryptSecret, isEnvelope, type Keyring } from '../crypto';
import { AI_ERROR_CODES, AiProvisioningError } from '../errors';
import { buildCredentialFields } from '../fields';
import { isDynamicModelRef, modelProviderMismatch } from '../model-ref';
import { destinationKeysFor, type AiProviderRegistry } from '../registry';
import { deriveKeyHint, normalizeSubmittedSecret, type SecretRef } from '../secret';
import type { CredentialRecord } from '../types';
import { aiProviderCredentialsTable } from './AiProviderCredential.schema';

export { aiProviderCredentialsTable };
export type { AiProviderCredentialType, NewAiProviderCredentialType } from './AiProviderCredential.schema';

/**
 * Everything the write path needs that the ORM cannot inject.
 *
 * REGISTRATION IS NECESSARILY IMPERATIVE AND PER-REQUEST in this framework — edge
 * bindings only exist per request, which is why `registerConnection` works the same way.
 * `configureWrites` therefore holds isolate-scoped state, and it REFUSES a conflicting
 * reconfiguration rather than silently letting request A wrap with request B's keyring.
 * That failure mode is invisible in a single-app deployment and lethal in a shared worker,
 * so it fails LOUDLY instead.
 */
export interface CredentialWriteContext {
    keyring: Keyring;
    registry: AiProviderRegistry;
    /** Called with a non-fatal warning (e.g. a model/provider mismatch on save). */
    onWarning?: (message: string, details: Record<string, unknown>) => void;
    /**
     * Validates a submitted gateway/vault alias against a TENANT-SCOPED allowlist.
     *
     * AN ALIAS IS A CREDENTIAL, NOT A LABEL. It is a name resolved inside the operator's
     * gateway account; it is tenant-writable; it is not ciphertext so no AAD binds it —
     * and UNVALIDATED it is a cross-tenant key-use primitive requiring no crypto break and
     * no RLS bypass: tenant A writes tenant B's alias, the merge deletes the platform key,
     * and A's requests run under B's gateway-held key while metering blames A and B's
     * contract pays.
     *
     * With no validator configured, aliases are REJECTED.
     */
    validateAlias?: (input: {
        alias: string;
        organizationId: string | null;
        userId: string | null;
        appId: string | null;
    }) => boolean | Promise<boolean>;
}

let writeContext: CredentialWriteContext | null = null;

/**
 * Compare two keyrings by MATERIAL, not just by key ids.
 *
 * Comparing ids alone makes the guard useless in exactly the deployment it exists for: two
 * apps in one worker that both name their key `k1` but hold DIFFERENT secrets would pass
 * the check, and one request would then wrap a tenant's key under the other app's master
 * secret — surfacing later as a generic decrypt failure indistinguishable from a botched
 * rotation.
 */
function sameKeyring(a: Keyring, b: Keyring): boolean {
    if (a === b) return true;
    if (a.currentKeyId !== b.currentKeyId) return false;
    const aIds = a.keyIds().slice().sort();
    const bIds = b.keyIds().slice().sort();
    if (aIds.length !== bIds.length) return false;
    for (let i = 0; i < aIds.length; i++) {
        if (aIds[i] !== bIds[i]) return false;
        const left = a.materialFor(aIds[i]!);
        const right = b.materialFor(bIds[i]!);
        if (!left || !right || left.length !== right.length) return false;
        for (let byte = 0; byte < left.length; byte++) {
            if (left[byte] !== right[byte]) return false;
        }
    }
    return true;
}

/** Install the write context for this isolate. Called by `createAiProvisioningWithStorage`. */
export function configureCredentialWrites(next: CredentialWriteContext): void {
    if (writeContext && !sameKeyring(writeContext.keyring, next.keyring)) {
        throw new AiProvisioningError(
            'AiProviderCredential write context was reconfigured with a DIFFERENT keyring in the same isolate. ' +
                "That would let one request wrap a secret with another request's master key. If you genuinely run " +
                'two apps with separate key custody in one worker, give each its own model class rather than sharing ' +
                'this one.',
            AI_ERROR_CODES.CONFIGURATION,
        );
    }
    writeContext = next;
    // Field metadata is registry-derived (the provider <select> options come from it), so
    // it is installed here rather than declared statically — one object drives the form,
    // the server validation and the guards.
    AiProviderCredential.applyFieldMetadata(next.registry);
}

/** Test-only teardown. */
export function resetCredentialWrites(): void {
    writeContext = null;
}

function requireWriteContext(): CredentialWriteContext {
    if (!writeContext) {
        throw new AiProvisioningError(
            'AiProviderCredential write attempted before configureCredentialWrites(). Call ' +
                'createAiProvisioningWithStorage(...) during request setup — a write path with no keyring must ' +
                'never fall back to storing a provider key in cleartext.',
            AI_ERROR_CODES.NO_ENCRYPTION_KEY,
        );
    }
    return writeContext;
}

/** Field names the tenancy rules pin. */
const TENANCY_FIELDS = ['organizationId', 'userId', 'appId'] as const;

/** Fields the model computes and the client may never write. */
const SERVER_OWNED_FIELDS = [
    'keyHint',
    'secretKind',
    'secretCiphertext',
    'secretAlias',
    'keyId',
    'formatVersion',
    'lastUsedAt',
    'lastSuccessAt',
    'lastErrorAt',
    'lastErrorCode',
    'consecutiveFailures',
    'createdAt',
    'updatedAt',
] as const;

export class AiProviderCredential extends BaseModel {
    static entity = 'ai_provider_credentials';
    static table = aiProviderCredentialsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottaai';
    static packageType: PackageType = 'package';
    static displayName = 'AI provider credential';
    static displayNamePlural = 'AI provider credentials';
    static defaultSort = 'updatedAt';
    static defaultSortDirection: 'asc' | 'desc' = 'desc';

    static casts = {
        enabled: 'boolean' as const,
        isActive: 'boolean' as const,
        transportConfig: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
        lastUsedAt: 'date' as const,
        lastSuccessAt: 'date' as const,
        lastErrorAt: 'date' as const,
    };

    /**
     * `toJson()` masks these (camelCase AND their snake_case siblings). Defence in depth
     * only — the real gate is that operator surfaces read a projection that never selects
     * a secret-union column at all, and that the route factory carries a filter/sort
     * deny-list.
     */
    static hidden = ['secretCiphertext', 'secretAlias'];

    /**
     * PER-OPERATION allow-lists. BOTH keys are declared deliberately: when `writable` is
     * present but a key is missing, `getWritableFields` returns null and that operation
     * becomes COMPLETELY UNRESTRICTED.
     *
     * • Server-set tenancy fields MUST appear in the CREATE list even though they are
     *   non-editable, or they silently fail to persist and every credential is created
     *   unscoped.
     * • Tenancy is ABSENT from the update list — and the model's own `update` override
     *   rejects it too, because a policy declaring `contextFields` adds those fields to
     *   the writable set on BOTH create and update, overriding this list.
     * • `isActive` is ABSENT from BOTH. Activation has exactly one mutation
     *   (`activate`), which deactivates siblings. Removing the UI affordance is not the
     *   remedy; removing the write path is.
     */
    static writable = {
        create: [
            'label',
            'provider',
            'model',
            'secret',
            'alias',
            'enabled',
            'transportConfig',
            'organizationId',
            'userId',
            'appId',
        ],
        // `alias` and `clearSecret` are SYNTHETIC inputs the statics consume and delete
        // before persisting. They are listed so the generic auto-CRUD path — the very path
        // these statics exist to protect — can express "use a gateway key" and "clear the
        // key" at all, instead of having them rejected as non-writable before the model runs.
        update: ['label', 'provider', 'model', 'secret', 'alias', 'clearSecret', 'enabled', 'transportConfig'],
    };

    protected static fields: ModelFields = {};

    /** Install registry-derived field metadata. Called from `configureCredentialWrites`. */
    static applyFieldMetadata(registry: AiProviderRegistry): void {
        this.fields = buildCredentialFields(registry);
    }

    // -----------------------------------------------------------------------
    // Record projection
    // -----------------------------------------------------------------------

    /**
     * Project to the plain `CredentialRecord` the pure layers take.
     *
     * Uses `get()` rather than `toJson()` ON PURPOSE: `toJson()` masks `hidden` fields, so
     * a `toJson()`-based mapper would silently produce records with no ciphertext and every
     * resolution would report a keyless credential.
     */
    toRecord(): CredentialRecord {
        const kind = (this.get('secretKind') as SecretRef['kind']) ?? 'none';
        const secret: SecretRef =
            kind === 'inline'
                ? { kind: 'inline', ciphertext: String(this.get('secretCiphertext') ?? '') }
                : kind === 'alias'
                  ? { kind: 'alias', alias: String(this.get('secretAlias') ?? '') }
                  : { kind: 'none' };

        const asMs = (value: unknown): number | null => {
            if (value === null || value === undefined) return null;
            if (value instanceof Date) return value.getTime();
            const num = Number(value);
            return Number.isFinite(num) ? num : null;
        };

        return {
            id: String(this.get('id')),
            label: (this.get('label') as string | null) ?? null,
            provider: String(this.get('provider')),
            model: (this.get('model') as string | null) ?? null,
            secret,
            keyHint: String(this.get('keyHint') ?? ''),
            // ABSENT FLAGS ARE PERMISSIVE — only an explicit `false` disables or
            // deactivates, so migrated/seeded/imported rows are not silently dead.
            enabled: this.get('enabled') !== false,
            isActive: this.get('isActive') !== false,
            organizationId: (this.get('organizationId') as string | null) ?? null,
            userId: (this.get('userId') as string | null) ?? null,
            appId: (this.get('appId') as string | null) ?? null,
            createdAt: asMs(this.get('createdAt')) ?? 0,
            updatedAt: asMs(this.get('updatedAt')) ?? 0,
            transportConfig: (this.get('transportConfig') as Record<string, unknown> | null) ?? null,
            keyId: (this.get('keyId') as string | null) ?? null,
            formatVersion: (this.get('formatVersion') as string | null) ?? null,
            lastUsedAt: asMs(this.get('lastUsedAt')),
            lastSuccessAt: asMs(this.get('lastSuccessAt')),
            lastErrorAt: asMs(this.get('lastErrorAt')),
            lastErrorCode: (this.get('lastErrorCode') as string | null) ?? null,
            consecutiveFailures: Number(this.get('consecutiveFailures') ?? 0),
        };
    }

    // -----------------------------------------------------------------------
    // Write path
    // -----------------------------------------------------------------------

    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: DbDriver,
    ): Promise<InstanceType<T>> {
        const ctx = requireWriteContext();
        const Self = AiProviderCredential;

        for (const field of SERVER_OWNED_FIELDS) delete data[field];

        const provider = Self.normalizeString(data.provider);
        if (!provider) {
            throw new AiProvisioningError('A provider is required.', AI_ERROR_CODES.VALIDATION);
        }
        Self.assertTenantProvider(ctx, provider);
        data.provider = provider;
        data.model = Self.normalizeString(data.model);
        data.label = Self.normalizeString(data.label);

        // THERE IS NO SUCH THING AS A GLOBAL CREDENTIAL: a row with neither tenancy
        // dimension is eligible under the conflict rules but scores 0 under every strategy
        // — permanently unselectable. Reject it here so unreachable data never accumulates.
        if (!data.organizationId && !data.userId) {
            throw new AiProvisioningError(
                'A credential must be scoped to a user, an organization, or both.',
                AI_ERROR_CODES.VALIDATION,
            );
        }

        // Dynamic routes are OPERATOR NAMESPACE, never tenant input: a tenant who writes
        // `model: 'dynamic/<an-operator-route>'` with no secret gets a client pointed at the
        // operator's key and budget while the resolution reports `source: 'byok'` — a
        // silent, unmetered bypass of mode, quota and the cost model, reached through the
        // `model` column rather than through a named destination field.
        if (isDynamicModelRef(data.model)) {
            throw new AiProvisioningError(
                'A dynamic/<route> model reference is operator-only and cannot be set on a tenant credential.',
                AI_ERROR_CODES.VALIDATION,
            );
        }

        data.transportConfig = Self.sanitizeTransportConfig(ctx, provider, data.transportConfig);

        // The id MUST exist before the wrap — it is part of the AAD tuple.
        const id = typeof data.id === 'string' && data.id ? data.id : crypto.randomUUID();
        data.id = id;

        await Self.applySecret(ctx, data, {
            id,
            provider,
            organizationId: data.organizationId ?? null,
            userId: data.userId ?? null,
            appId: data.appId ?? null,
            isCreate: true,
        });

        Self.rejectModelMismatch(ctx, provider, data.model);

        const created = (await super.create.call(this, data, driver)) as InstanceType<T>;
        // A new credential is ACTIVE FOR ITS SCOPE. Enforced inside the write path, not as
        // a post-write side effect in a CRUD dispatcher — auto-CRUD calls the statics, so a
        // dispatcher-side implementation is missing for every other write path.
        await Self.deactivateSiblings(id, {
            organizationId: data.organizationId ?? null,
            userId: data.userId ?? null,
            appId: data.appId ?? null,
        });
        return created;
    }

    static async update<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        data: Record<string, any>,
        driver?: DbDriver,
    ): Promise<InstanceType<T>> {
        const ctx = requireWriteContext();
        const Self = AiProviderCredential;
        const rowId = String(id);

        for (const field of SERVER_OWNED_FIELDS) delete data[field];

        // TENANCY IS IMMUTABLE ON UPDATE, rejected HERE rather than left to the allow-list.
        // OttaORM's secure-CRUD layer adds every `contextFields` entry to the writable set
        // on BOTH create and update, so a policy declaring
        // `contextFields: ['organizationId','userId','appId']` would otherwise silently
        // re-enable tenancy writes. No policy config can re-enable them here.
        for (const field of TENANCY_FIELDS) {
            if (field in data) {
                delete data[field];
            }
        }
        // `isActive` likewise: rank-only, one dedicated mutation.
        delete data.isActive;

        const existing = await Self.find(rowId);
        if (!existing) {
            throw new AiProvisioningError('Credential not found.', AI_ERROR_CODES.VALIDATION);
        }
        const current = existing.toRecord();

        if ('provider' in data) {
            const nextProvider = Self.normalizeString(data.provider);
            if (!nextProvider) {
                throw new AiProvisioningError('A provider is required.', AI_ERROR_CODES.VALIDATION);
            }
            Self.assertTenantProvider(ctx, nextProvider);
            // A PATCH that changes `provider` but not the secret leaves the OLD provider's
            // key under the NEW provider. It costs an extra read of the existing row to
            // compare; accept that cost. (Triggered only when `provider` is in the payload,
            // so activation toggles and label edits are unaffected.)
            const secretProvided = typeof data.secret === 'string' && data.secret.trim().length > 0;
            if (nextProvider !== current.provider && !secretProvided && current.secret.kind !== 'none') {
                throw new AiProvisioningError(
                    `Changing the provider from "${current.provider}" to "${nextProvider}" requires re-entering the ` +
                        'API key — the stored key belongs to the old provider.',
                    AI_ERROR_CODES.VALIDATION,
                    { details: { field: 'secret' } },
                );
            }
            data.provider = nextProvider;
        }

        if ('model' in data) {
            data.model = Self.normalizeString(data.model);
            if (isDynamicModelRef(data.model)) {
                throw new AiProvisioningError(
                    'A dynamic/<route> model reference is operator-only and cannot be set on a tenant credential.',
                    AI_ERROR_CODES.VALIDATION,
                );
            }
        }
        if ('label' in data) data.label = Self.normalizeString(data.label);

        const provider = (data.provider as string | undefined) ?? current.provider;

        if ('transportConfig' in data) {
            data.transportConfig = Self.sanitizeTransportConfig(ctx, provider, data.transportConfig);
        }

        await Self.applySecret(ctx, data, {
            id: rowId,
            provider,
            organizationId: current.organizationId,
            userId: current.userId,
            appId: current.appId,
            isCreate: false,
            // Pass-through is legal ONLY for this row's OWN current ciphertext.
            currentCiphertext: current.secret.kind === 'inline' ? current.secret.ciphertext : null,
        });

        if ('model' in data) Self.rejectModelMismatch(ctx, provider, data.model);

        return (await super.update.call(this, rowId, data, driver)) as InstanceType<T>;
    }

    // -----------------------------------------------------------------------
    // Write-path helpers
    // -----------------------------------------------------------------------

    /** Trim-then-null EVERY optional string: an empty-string alias reads as "has an alias". */
    private static normalizeString(value: unknown): string | null {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    /**
     * THE TENANT CONTROLS WHICH PROVIDER KEY IS USED; THE OPERATOR CONTROLS WHERE THE
     * REQUEST GOES — and that is a property of the WHOLE merged config, not of two named
     * fields. "Opaque" is precisely the word that makes an implementer spread the bag into
     * an SDK config without inspection, at which point a tenant setting a base URL
     * exfiltrates whatever key the merge produced.
     */
    private static sanitizeTransportConfig(
        ctx: CredentialWriteContext,
        provider: string,
        value: unknown,
    ): Record<string, unknown> | null {
        if (value === null || value === undefined) return null;
        if (typeof value !== 'object' || Array.isArray(value)) {
            throw new AiProvisioningError('Provider options must be an object.', AI_ERROR_CODES.VALIDATION);
        }
        const forbidden = destinationKeysFor(ctx.registry, provider);
        const clean: Record<string, unknown> = {};
        const rejected: string[] = [];
        for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
            if (forbidden.has(key)) {
                rejected.push(key);
                continue;
            }
            clean[key] = entry;
        }
        if (rejected.length > 0) {
            throw new AiProvisioningError(
                `Provider options may not set ${rejected.join(', ')} — those decide where the request goes, ` +
                    'and are operator-only.',
                AI_ERROR_CODES.VALIDATION,
                { details: { rejected } },
            );
        }
        return Object.keys(clean).length > 0 ? clean : null;
    }

    /**
     * The four secret write rules, in order. Mutates `data` into column values.
     *
     * 1. BLANK/ABSENT ON UPDATE ⇒ DELETE THE FIELD FROM THE PAYLOAD. Never overwrite a
     *    stored key with an empty string. This is what makes "leave blank to keep the
     *    existing key" work — and it is why the verify endpoint needs two modes.
     * 2. ALREADY-CIPHERTEXT ⇒ PASS THROUGH BYTE-IDENTICAL. Without this, any internal
     *    re-save wraps ciphertext in ciphertext and the next decrypt returns the inner
     *    envelope string as the "API key" — which is then shipped to a provider. Legal
     *    ONLY on update of the same row id; on create it is rejected, because it skips
     *    hint derivation and produces a permanently undecryptable row.
     * 3. CLEARING IS AN EXPLICIT TRANSITION to `secretKind: 'none'`, which nulls the
     *    secret columns AND the `keyHint`, atomically. Rule 1 makes blank mean "keep", so
     *    this is the only way to clear — and a cleared credential with a stale hint reads
     *    as keyed to both the keyless-mismatch guard and the gate.
     * 4. OTHERWISE ⇒ TRIM THE PLAINTEXT ONCE, then derive the hint and encrypt FROM THAT
     *    SAME TRIMMED STRING.
     */
    private static async applySecret(
        ctx: CredentialWriteContext,
        data: Record<string, any>,
        row: {
            id: string;
            provider: string;
            organizationId: string | null;
            userId: string | null;
            appId: string | null;
            isCreate: boolean;
            /** This row's CURRENT stored envelope, when it has one. Update path only. */
            currentCiphertext?: string | null;
        },
    ): Promise<void> {
        const submittedAlias = Self_normalizeAlias(data.secretAliasInput ?? data.alias);
        delete data.alias;
        delete data.secretAliasInput;

        // Rule 3 — explicit clear.
        if (data.clearSecret === true) {
            delete data.clearSecret;
            delete data.secret;
            data.secretKind = 'none';
            data.secretCiphertext = null;
            data.secretAlias = null;
            data.keyHint = '';
            data.keyId = null;
            data.formatVersion = null;
            return;
        }
        delete data.clearSecret;

        if (submittedAlias) {
            if (!ctx.validateAlias) {
                throw new AiProvisioningError(
                    'Gateway key aliases are not enabled on this deployment. An unvalidated alias is a ' +
                        'cross-tenant key-use primitive; configure `validateAlias` to allow them.',
                    AI_ERROR_CODES.VALIDATION,
                );
            }
            const ok = await ctx.validateAlias({
                alias: submittedAlias,
                organizationId: row.organizationId,
                userId: row.userId,
                appId: row.appId,
            });
            if (!ok) {
                throw new AiProvisioningError(
                    'That gateway key name is not available to this workspace.',
                    AI_ERROR_CODES.VALIDATION,
                );
            }
            delete data.secret;
            data.secretKind = 'alias';
            data.secretCiphertext = null;
            data.secretAlias = submittedAlias;
            data.keyHint = deriveKeyHint(submittedAlias, 'none');
            data.keyId = null;
            data.formatVersion = null;
            return;
        }

        const raw = data.secret;
        delete data.secret;

        // Rule 1 — blank/absent on update means KEEP.
        if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim().length === 0)) {
            if (row.isCreate) {
                const requiresKey = ctx.registry.requiresKeyFor(row.provider);
                if (requiresKey) {
                    throw new AiProvisioningError(`${row.provider} requires an API key.`, AI_ERROR_CODES.VALIDATION, {
                        details: { field: 'secret' },
                    });
                }
                data.secretKind = 'none';
                data.secretCiphertext = null;
                data.secretAlias = null;
                data.keyHint = '';
            }
            return;
        }

        const trimmed = normalizeSubmittedSecret(raw);

        // Rule 2 — already-ciphertext passes through BYTE-IDENTICAL, and only for THIS
        // ROW'S OWN CURRENT ENVELOPE.
        //
        // The rule exists so an internal re-save cannot wrap ciphertext in ciphertext (the
        // next decrypt would then return the inner envelope string as the "API key" and ship
        // it to a provider). It is NOT a channel for a tenant to post arbitrary
        // envelope-shaped text: accepting any such string would let a caller overwrite their
        // stored key with an unusable blob whose hint still reads as keyed, AND — because
        // the provider-change guard tests only "was a secret supplied" — would slip a
        // provider swap past the guard that exists to stop the old provider's key sitting
        // under a new provider.
        if (isEnvelope(trimmed)) {
            if (row.isCreate || !row.currentCiphertext || trimmed !== row.currentCiphertext) {
                throw new AiProvisioningError(
                    'That value is already an encrypted envelope. Submit the plaintext API key instead.',
                    AI_ERROR_CODES.VALIDATION,
                    { details: { field: 'secret' } },
                );
            }
            data.secretKind = 'inline';
            data.secretCiphertext = trimmed;
            data.secretAlias = null;
            return;
        }

        // Rule 4 — one trim, then hint + ciphertext from THAT SAME STRING.
        const hintSource = ctx.registry.get(row.provider)?.hintSource ?? 'tail';
        const { envelope, keyId, formatVersion } = await encryptSecret({
            plaintext: trimmed,
            keyring: ctx.keyring,
            aad: {
                credentialId: row.id,
                organizationId: row.organizationId,
                userId: row.userId,
                appId: row.appId,
                provider: row.provider,
            },
        });

        data.secretKind = 'inline';
        data.secretCiphertext = envelope;
        data.secretAlias = null;
        data.keyHint = deriveKeyHint(trimmed, hintSource);
        data.keyId = keyId;
        data.formatVersion = formatVersion;
    }

    /**
     * A model whose provider head disagrees with the credential's provider is REJECTED.
     *
     * It was a warning, on the theory that the model ref was a deliberate escape hatch. It
     * is not one: the transport picks the URL from the model and the auth header from the
     * credential, so the pairing produces a request routed to one provider carrying another's
     * key. `onWarning` still exists for genuinely non-fatal write notes; this is not one.
     */
    private static rejectModelMismatch(ctx: CredentialWriteContext, provider: string, model: string | null): void {
        const message = modelProviderMismatch(provider, model, ctx.registry);
        if (!message) return;
        throw new AiProvisioningError(message, AI_ERROR_CODES.VALIDATION, { details: { field: 'model' } });
    }

    /**
     * A tenant credential must name a provider this deployment can actually call.
     *
     * VALIDATED HERE, NOT ONLY IN THE FORM. The route factory and generic auto-CRUD both
     * reach this static, and a direct API caller sees neither the `<select>` nor its options
     * — so without this, `POST /api/ai/credentials {"provider":"totally-made-up"}` writes a
     * row that lists, tests and edits perfectly well, and then resolves to
     * `PROVIDER_UNREGISTERED` for the rest of its life with nothing to point at.
     *
     * The same check rejects a provider that is registered but PLATFORM-ONLY (Workers AI has
     * no tenant key to bring) or that the shipped transport has no verified wire contract for
     * — see `AiProviderEntry.tenantSelectable`.
     */
    private static assertTenantProvider(ctx: CredentialWriteContext, provider: string): void {
        if (ctx.registry.isTenantSelectable(provider)) return;

        const known = ctx.registry.get(provider);
        throw new AiProvisioningError(
            known
                ? `Provider "${provider}" cannot be used for a saved credential on this deployment.`
                : `Unknown provider "${provider}". Choose one of: ` +
                      ctx.registry
                          .tenantSelectable()
                          .map((entry) => entry.id)
                          .join(', '),
            AI_ERROR_CODES.VALIDATION,
            { details: { field: 'provider' } },
        );
    }

    // -----------------------------------------------------------------------
    // Activation
    // -----------------------------------------------------------------------

    /**
     * "Several saved, one active" — the ONLY activation mutation. There is deliberately no
     * bare deactivate; pausing is `enabled: false`.
     *
     * TRAP: building the sibling filter from "whichever dimension is non-null" is WRONG.
     * For an org-scoped credential (org set, user null) that filter is `{ organizationId }`
     * alone, which matches every row in the org INCLUDING rows bound to individual members
     * — so one member adding an org key would silently deactivate every colleague's
     * personal credential. The filter is the FULL TENANCY TUPLE, treating null as a value
     * to match, and it includes `appId` (which matters identically under `wildcard`, where
     * omitting it would deactivate siblings across every app in the suite).
     *
     * WHERE IT BREAKS, stated rather than discovered: two concurrent activations race (last
     * writer wins; the scope may transiently hold zero or two active rows); a partial
     * failure mid-loop leaves the invariant violated with no transaction; nothing defines
     * "active" when the only active row is deleted or disabled. ALL THREE ARE TOLERABLE
     * PRECISELY BECAUSE `isActive` IS RANK-ONLY AND RESOLUTION IS TOTAL — promoting
     * `isActive` to a hard filter would couple the correctness of every AI call to the
     * atomicity of a multi-row update the framework cannot give you.
     */
    static async activate(id: string): Promise<boolean> {
        const record = await this.find(id);
        if (!record) return false;
        const row = (record as AiProviderCredential).toRecord();
        await super.update.call(this, id, { isActive: true });
        await this.deactivateSiblings(id, {
            organizationId: row.organizationId,
            userId: row.userId,
            appId: row.appId,
        });
        return true;
    }

    private static async deactivateSiblings(
        keepId: string,
        tuple: { organizationId: string | null; userId: string | null; appId: string | null },
    ): Promise<void> {
        try {
            const siblings = await this.where({
                organizationId: tuple.organizationId,
                userId: tuple.userId,
                appId: tuple.appId,
            });
            for (const sibling of siblings) {
                const id = String(sibling.get('id'));
                if (id === keepId) continue;
                if (sibling.get('isActive') === false) continue;
                await super.update.call(this, id, { isActive: false });
            }
        } catch {
            // Non-fatal: the primary write already succeeded, and `isActive` only RANKS.
        }
    }

    // -----------------------------------------------------------------------
    // Rotation
    // -----------------------------------------------------------------------

    /**
     * Replace a row's ciphertext with an equivalent wrap under a new master key.
     *
     * Deliberately bypasses the tenant write rules via `super.update` — this is a RE-WRAP
     * of an existing ciphertext, not a tenant edit: plaintext, hint and AAD tuple are all
     * unchanged. It re-reads the row inside the write and refuses when the key id has moved
     * under it, so a concurrent tenant edit is never clobbered.
     */
    static async rewrapSecret(
        id: string,
        next: { ciphertext: string; keyId: string; formatVersion: string },
        expect: { keyId: string | null },
    ): Promise<boolean> {
        const current = await this.find(id);
        if (!current) return false;
        const record = (current as AiProviderCredential).toRecord();
        if (record.keyId !== expect.keyId) return false;
        if (record.secret.kind !== 'inline') return false;

        await super.update.call(this, id, {
            secretCiphertext: next.ciphertext,
            keyId: next.keyId,
            formatVersion: next.formatVersion,
        });
        return true;
    }

    // -----------------------------------------------------------------------
    // Health
    // -----------------------------------------------------------------------

    /**
     * NEVER AUTO-DISABLE ON REPEATED FAILURE. It looks like a reasonable feature and is an
     * outage amplifier: a provider-wide outage fails every tenant's credential
     * simultaneously, and auto-disable converts a two-hour upstream incident into a
     * permanent state change across every tenant in every consuming app — recovery then
     * requires thousands of individual humans to obtain and paste new keys. The upstream
     * incident self-heals; the auto-disable does not. Increment the counter, surface the
     * state, let a human act.
     */
    static async recordOutcome(
        id: string,
        outcome: { ok: boolean; at: number; errorCode?: string | null },
    ): Promise<void> {
        // ONE STATEMENT, AND THE COUNTER IS COMPUTED BY THE DATABASE.
        //
        // The obvious version reads the row, adds one in JS, and writes it back. On the
        // INFERENCE PATH — which is concurrent by definition — two failures that overlap both
        // read N and both write N+1, so the counter under-counts exactly when it matters:
        // during the provider outage that is producing the concurrent failures. It also costs
        // a second D1 round trip per call. `consecutive_failures + 1` in SQL is atomic per
        // statement and needs no read.
        //
        // This bypasses BaseModel's update (and therefore RLS) deliberately: it is a
        // system-observed health write on the resolver's already-RLS-bypassing call plane,
        // acting on an id the resolver just selected. It writes NO tenant-controlled value.
        const db = this.getDriver().getDb();
        const table = aiProviderCredentialsTable;

        await db
            .update(table)
            .set({
                lastUsedAt: outcome.at,
                updatedAt: outcome.at,
                ...(outcome.ok
                    ? { lastSuccessAt: outcome.at, lastErrorCode: null, consecutiveFailures: 0 }
                    : {
                          lastErrorAt: outcome.at,
                          lastErrorCode: outcome.errorCode ?? 'ERROR',
                          consecutiveFailures: sql`${table.consecutiveFailures} + 1`,
                      }),
            })
            .where(eq(table.id, id));
    }
}

/** Module-scope helper so the class body stays readable. */
function Self_normalizeAlias(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

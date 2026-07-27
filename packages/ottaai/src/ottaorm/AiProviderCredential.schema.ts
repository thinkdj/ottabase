// ============================================================
// @ottabase/ottaai — ai_provider_credentials table
// ============================================================
// ONE TABLE, not credential-metadata-plus-external-vault. The alternative is real
// (a metadata row referencing a KMS/vault secret) — and the ALIAS secret kind
// below makes it available as DATA rather than as a fork. One table is chosen for
// edge latency (no extra network hop on the hot path) and zero infrastructure
// requirement.
//
// NAMES TO KEEP, because renaming costs a migration in every consuming app:
//   `ai_provider_credentials`, `keyHint`, `enabled`, `isActive`.
//
// UPGRADE CONTRACT: migrations are ADDITIVE-ONLY across minors, every new column
// is nullable or carries a default (the auto-init migrator cannot backfill, and a
// non-nullable column with no default fails initialisation outright), and the
// ciphertext column stays OPAQUE TEXT so envelope-format evolution never requires
// a schema migration at all.
// ============================================================

import { index } from 'drizzle-orm/sqlite-core';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const aiProviderCredentialsTable = sqliteTable(
    'ai_provider_credentials',
    {
        /**
         * APPLICATION-GENERATED, always. A DB-generated id would force encrypt-after-insert
         * — a window in which the row exists WITHOUT its ciphertext — because the id is part
         * of the AAD tuple and must be known before the wrap.
         */
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        /** Tenant-facing name. Tenants routinely save several ("Work", "Personal"). */
        label: text('label'),

        /** Registry key; also the head of a qualified model ref. IN THE AAD TUPLE. */
        provider: text('provider').notNull(),

        /** Bare id, qualified ref, or `dynamic/<route>` — one column holds all three. */
        model: text('model'),

        /**
         * NOT-NULL DISCRIMINATOR: 'inline' | 'alias' | 'none'.
         *
         * A union with a stored discriminator, NOT two nullable columns resolved by
         * truthiness. Truthiness resolution has already produced two live bugs elsewhere:
         * an alias-only credential silently keeps the platform's provider key alongside the
         * tenant's alias (two auth mechanisms on one request), and the UI infers "has a key"
         * from the hint, so an alias-only credential WORKS at call time but reads as keyless
         * and keeps the gate closed.
         */
        secretKind: text('secret_kind').notNull().default('none'),

        /** Opaque versioned envelope. Non-null iff `secretKind = 'inline'`. NEVER indexed. */
        secretCiphertext: text('secret_ciphertext'),

        /** Gateway/vault-held key NAME. Non-null iff `secretKind = 'alias'`. */
        secretAlias: text('secret_alias'),

        /**
         * The ONLY key-related value the UI ever sees. NEVER client-writable.
         * '' = no secret · '••••' (4 chars) = secret shorter than 4 · '••••xxxx' = last four.
         */
        keyHint: text('key_hint').notNull().default(''),

        /** Tenant pause switch. HARD FILTER at resolve time. */
        enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),

        /** Tenant preference among siblings. RANK ONLY — never excludes. */
        isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

        // ── Tenancy: BOTH dimensions from the FIRST migration ─────────────────────
        // B2C apps grow orgs; B2B apps grow per-user overrides. A package that ships
        // user-only cannot become B2B without a migration in every consuming app.
        organizationId: text('organization_id'),
        userId: text('user_id'),
        /** Third tenancy dimension. An ISOLATION BOUNDARY, strict by default. */
        appId: text('app_id'),

        /** Non-secret per-provider bag, validated on write against the registry entry. */
        transportConfig: text('transport_config', { mode: 'json' }).$type<Record<string, unknown> | null>(),

        // ── Keyring index — INDEX ONLY. The envelope stays authoritative. ──────────
        keyId: text('key_id'),
        formatVersion: text('format_version'),

        // ── Health: SYSTEM-OBSERVED. Ships in the INITIAL schema. ─────────────────
        // "AI stopped working for this customer" is the most common BYOK support contact
        // and the schema otherwise answers nothing; every consuming app hits the identical
        // call and adds the identical columns.
        // NOTE: `lastUsedAt` is a COARSE timestamp, not a per-call log — per-call records
        // belong in metering, or the row becomes a write hotspot on the inference path.
        lastUsedAt: integer('last_used_at'),
        lastSuccessAt: integer('last_success_at'),
        lastErrorAt: integer('last_error_at'),
        lastErrorCode: text('last_error_code'),
        consecutiveFailures: integer('consecutive_failures').notNull().default(0),

        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        /** Half the client-cache key, and the last determinism rung before the id. */
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (table) => [
        // The resolver's two-query fan-out.
        index('ai_provider_credentials_user_idx').on(table.userId, table.appId),
        index('ai_provider_credentials_org_idx').on(table.organizationId, table.appId),
        // Rotation batching reads the INDEX; the retirement decision reads the ENVELOPE.
        index('ai_provider_credentials_key_id_idx').on(table.keyId),
        // NOTE: there is deliberately NO unique index on (tenancy, provider, label).
        //
        // SQLite treats NULLs as DISTINCT in a unique index, and every row this system
        // writes has at least one NULL in that tuple — a user-scoped row has
        // organizationId NULL, an org-scoped row has userId NULL. Such an index would
        // therefore never fire for any real row: it would read like a guarantee, enforce
        // nothing, and mislead the next person who assumes labels are unique.
        //
        // Labels are display names ("Work", "Personal"); nothing in resolution, merge or
        // the gate depends on their uniqueness, and the tie-break is a TOTAL order down to
        // the id, so duplicates are harmless. If uniqueness is ever wanted, it needs
        // partial indexes per tenancy shape, not one index over nullable columns.
        // NOTE: `secret_ciphertext` carries NO unique constraint and NO index, and never can.
        // Salt and IV are fresh per write, so identical keys produce different ciphertext —
        // "is this key already in use?" is unbuildable without a separate keyed fingerprint
        // (an HMAC of the plaintext under the master secret). Decided up front, on purpose.
    ],
);

export type AiProviderCredentialType = typeof aiProviderCredentialsTable.$inferSelect;
export type NewAiProviderCredentialType = typeof aiProviderCredentialsTable.$inferInsert;

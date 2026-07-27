// ============================================================
// @ottabase/ottaai — Field metadata IS the admin UI
// ============================================================
// `ModelFields` drives SERVER VALIDATION and the GENERATED FORM AND TABLE
// simultaneously, so the write-only-secret UX falls out of metadata rather than
// custom components.
//
// Lives in the DEPENDENCY-FREE ROOT (type-only import from the ORM, erased at
// build) so any client rendering can read it without pulling the ORM into the
// browser bundle.
//
// SUBTLE INTERACTION, stated because concluding otherwise is a security
// regression: NON-EDITABLE FIELDS ARE DROPPED FROM THE GENERATED VALIDATION SHAPE
// BUT SURVIVE VIA PASSTHROUGH. So marking tenancy non-editable correctly hides it
// from forms WHILE STILL LETTING SERVER-SET VALUES PERSIST. Do not "fix" this by
// marking tenancy editable.
// ============================================================

import type { ModelFields } from '@ottabase/ottaorm';
import type { AiProviderRegistry } from './registry';

/**
 * Build the credential model's field metadata.
 *
 * The provider `<select>` options are GENERATED FROM THE REGISTRY, so the form cannot
 * drift from the guards that read the same object.
 */
export function buildCredentialFields(registry: AiProviderRegistry): ModelFields {
    return {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },

        label: {
            type: 'string',
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Name',
                description: 'A name you will recognise later — "Work", "Personal", "Marketing team key".',
                placeholder: 'My OpenAI key',
            },
            formConfig: { fieldType: 'input', order: 10 },
            tableConfig: { visible: true, order: 10 },
            validation: { rules: 'max:120' },
        },

        provider: {
            type: 'string',
            sortable: true,
            filterable: true,
            uiConfig: { label: 'Provider', description: 'Which AI provider this key belongs to.' },
            formConfig: {
                fieldType: 'select',
                order: 20,
                // Generated from the per-instance registry — one object, form and guards.
                // TENANT-SELECTABLE ONLY: a provider the platform uses but a tenant cannot
                // bring a key for (Workers AI), or one with no verified wire contract, must
                // not appear in a BYOK form. The write path rejects the same set, so the two
                // cannot drift.
                options: registry.tenantSelectable().map((entry) => ({ id: entry.id, name: entry.displayName })),
            },
            tableConfig: { visible: true, order: 20 },
            validation: { rules: 'required' },
        },

        model: {
            type: 'string',
            sortable: true,
            uiConfig: {
                label: 'Model',
                description:
                    'Leave blank to use the default. Accepts a bare model id (gpt-4o-mini) or a fully ' +
                    'qualified reference (anthropic/claude-sonnet-4-5).',
                placeholder: 'gpt-4o-mini',
            },
            formConfig: { fieldType: 'input', order: 30 },
            tableConfig: { visible: true, order: 30 },
            validation: { rules: 'max:200' },
        },

        /**
         * The WRITE-ONLY secret.
         *
         * `autoComplete: 'off'` is not cosmetic — without it browser password managers offer
         * to save the provider key and later AUTOFILL it, which both corrupts the "leave blank
         * to keep the existing key" semantics and stores the key somewhere new.
         *
         * (Rendered by `@ottabase/forms` as a password input; the package's own settings
         * component sets `autoComplete="off"` explicitly for the same reason.)
         */
        secret: {
            type: 'string',
            editable: true,
            searchable: false,
            sortable: false,
            filterable: false,
            uiConfig: {
                label: 'API key',
                description: 'Leave blank to keep the existing key. Keys are never shown again once saved.',
            },
            formConfig: { fieldType: 'password', order: 40, showPasswordHints: false },
            tableConfig: { visible: false },
            validation: { rules: 'max:8192' },
        },

        /** Read-only, table-visible. NEVER client-writable — a writable hint is a display lie the gate reads as truth. */
        keyHint: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Key' },
            formConfig: { visible: false },
            tableConfig: { visible: true, order: 40 },
        },

        enabled: {
            type: 'boolean',
            filterable: true,
            uiConfig: {
                label: 'Enabled',
                description: 'Pause this connection without deleting it. Your key is retained.',
            },
            formConfig: { fieldType: 'boolean', order: 50 },
            tableConfig: { visible: true, order: 50 },
        },

        /**
         * Rank-only tie-break. Deliberately NOT in the update allow-list (see the model) —
         * removing the UI affordance is not the remedy; removing the write path is.
         * Activation goes through the dedicated `activate` mutation.
         */
        isActive: {
            type: 'boolean',
            editable: false,
            uiConfig: { label: 'Active', description: 'Preferred among your other keys at the same scope.' },
            formConfig: { visible: false },
            tableConfig: { visible: true, order: 60 },
        },

        transportConfig: {
            type: 'json',
            editable: false,
            uiConfig: { label: 'Provider options' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },

        // ── Tenancy: server-set from the authenticated context, hidden from forms ──────
        organizationId: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Organization', description: 'Set automatically from the current workspace.' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        userId: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'User', description: 'Set automatically from the signed-in user.' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        appId: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'App', description: 'Set automatically from the deployment.' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },

        // ── Keyring index (operator diagnostics only) ─────────────────────────────────
        keyId: { type: 'string', editable: false, formConfig: { visible: false }, tableConfig: { visible: false } },
        formatVersion: {
            type: 'string',
            editable: false,
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },

        // ── Health: SYSTEM-WRITTEN ONLY ───────────────────────────────────────────────
        lastUsedAt: {
            type: 'datetime',
            editable: false,
            uiConfig: { label: 'Last used' },
            formConfig: { visible: false },
            tableConfig: { visible: true, order: 70, format: 'datetime' },
        },
        lastSuccessAt: {
            type: 'datetime',
            editable: false,
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        lastErrorAt: {
            type: 'datetime',
            editable: false,
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        lastErrorCode: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Last error' },
            formConfig: { visible: false },
            tableConfig: { visible: true, order: 80 },
        },
        consecutiveFailures: {
            type: 'integer',
            editable: false,
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },

        createdAt: {
            type: 'datetime',
            editable: false,
            sortable: true,
            formConfig: { visible: false },
            tableConfig: { visible: false, format: 'datetime' },
        },
        updatedAt: {
            type: 'datetime',
            editable: false,
            sortable: true,
            formConfig: { visible: false },
            tableConfig: { visible: false, format: 'datetime' },
        },
    };
}

/**
 * Fields that must NEVER appear in a `where`, `orderBy`, `search`, `field` or `uniqueField`
 * clause, on ANY path.
 *
 * Marking the ciphertext column hidden covers SERIALISATION. It does not cover `where` /
 * `orderBy`, which generic CRUD passes straight through to the model — so a filterable
 * secret column is an equality and ordering ORACLE reachable through an endpoint nobody
 * wrote by hand, and declaring `filterable: false` metadata does not close it (nothing
 * reads that flag).
 *
 * Covers EVERY FIELD OF THE SECRET UNION — ciphertext, alias AND the discriminator — plus
 * `keyHint`, which is a per-character oracle on the last four characters of the key.
 */
export const CREDENTIAL_QUERY_DENY_LIST: readonly string[] = Object.freeze([
    'secret',
    'secretKind',
    'secret_kind',
    'secretCiphertext',
    'secret_ciphertext',
    'secretAlias',
    'secret_alias',
    'keyHint',
    'key_hint',
    'hasSecret',
    'has_secret',
]);

// ============================================================
// @ottabase/ottaorm - Authenticator Model
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';

/**
 * Authenticator table schema for Auth.js WebAuthn/passkey support
 */
export const authenticatorsTable = sqliteTable('authenticators', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    credentialId: text('credential_id').notNull().unique(),
    userId: text('user_id').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    credentialPublicKey: text('credential_public_key').notNull(),
    counter: integer('counter').notNull(),
    credentialDeviceType: text('credential_device_type').notNull(),
    credentialBackedUp: integer('credential_backed_up').notNull(), // SQLite boolean (0 or 1)
    transports: text('transports'), // Comma-separated list
    // App identifier for multi-app database sharing (nullable, opt-in)
    appId: text('app_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date())
        .notNull(),
});

/**
 * Authenticator model type
 */
export type AuthenticatorType = typeof authenticatorsTable.$inferSelect;
export type NewAuthenticatorType = typeof authenticatorsTable.$inferInsert;

/**
 * Authenticator model for Auth.js WebAuthn/passkey support
 *
 * Stores WebAuthn credentials for passwordless authentication.
 *
 * @example
 * ```typescript
 * import { Authenticator } from "@ottabase/ottaorm/models";
 *
 * // Find authenticator by credential ID
 * const auth = await Authenticator.findByCredentialId("cred123");
 *
 * // Find all authenticators for a user
 * const auths = await Authenticator.findByUserId("user-id");
 *
 * // Update counter for replay protection
 * await auth.updateCounter(newCounter);
 * ```
 */
export class Authenticator extends BaseModel {
    static entity = 'authenticators';
    static table = authenticatorsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    static casts = {
        credentialBackedUp: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        credentialId: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Credential ID' },
            validation: {
                rules: 'required|unique:authenticators,credential_id',
            },
        },
        userId: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'User ID' },
            validation: {
                rules: 'required',
            },
        },
        providerAccountId: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Provider Account ID' },
            validation: {
                rules: 'required',
            },
        },
        credentialPublicKey: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Credential Public Key' },
            validation: {
                rules: 'required',
            },
        },
        counter: {
            type: 'number',
            editable: true,
            uiConfig: {
                label: 'Counter',
                description: 'For replay attack prevention',
            },
            validation: {
                rules: 'required',
            },
        },
        credentialDeviceType: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Device Type' },
            validation: {
                rules: 'required',
            },
        },
        credentialBackedUp: {
            type: 'boolean',
            editable: true,
            uiConfig: { label: 'Backed Up' },
            validation: {
                rules: 'required',
            },
        },
        transports: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Transports', description: 'Comma-separated list' },
        },
        createdAt: {
            type: 'datetime',
            editable: false,
            uiConfig: { label: 'Created At' },
        },
        updatedAt: {
            type: 'datetime',
            editable: false,
            uiConfig: { label: 'Updated At' },
        },
    };

    /**
     * Find authenticator by credential ID
     */
    static async findByCredentialId(credentialId: string): Promise<Authenticator | null> {
        return this.first({ credentialId });
    }

    /**
     * Find all authenticators for a user
     */
    static async findByUserId(userId: string): Promise<Authenticator[]> {
        return this.where({ userId });
    }

    /**
     * Update authenticator counter (for replay attack prevention)
     */
    async updateCounter(newCounter: number): Promise<void> {
        const instance = this as any;
        instance.attributes.counter = newCounter;
        instance.attributes.updatedAt = new Date();
        await this.save();
    }
}

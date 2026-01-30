// ============================================================
// @ottabase/ottaorm - User Model
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { BaseModel, IModelConstructorParams, ModelFields, type PackageType } from '../base/BaseModel';

/**
 * User table schema
 */
export const usersTable = sqliteTable('users', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text('name'),
    email: text('email').notNull().unique(),
    image: text('image'),
    // Referral fields
    referralUsername: text('referral_username').unique(),
    referredById: text('referred_by_id'),
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
 * User model type
 */
export type UserType = typeof usersTable.$inferSelect;
export type NewUserType = typeof usersTable.$inferInsert;

/**
 * User model - Simple fat model example
 *
 * @example
 * ```typescript
 * import { User } from "@ottabase/ottaorm/models";
 *
 * // Find user
 * const user = await User.first({ email: "user@example.com" });
 *
 * // Create user
 * const newUser = await User.create({
 *   name: "John Doe",
 *   email: "john@example.com"
 * });
 *
 * // Get user's accounts
 * const accounts = await user.accounts();
 * ```
 */
export class User extends BaseModel {
    static entity = 'users';
    static table = usersTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    // UI/Forms metadata
    static displayName = 'User';
    static displayNamePlural = 'Users';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'ID',
            },
        },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Name',
                description: 'User name',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
            },
        },
        email: {
            type: 'string',
            editable: true,
            searchable: true,
            unique: true,
            uiConfig: {
                label: 'Email',
                description: 'User email',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required|email|unique:users,email',
                messages: {
                    required: 'Email is required',
                    email: 'Must be a valid email',
                    unique: 'Email already exists',
                },
            },
        },
        image: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Profile Image',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: false,
            },
        },
        referralUsername: {
            type: 'string',
            editable: true,
            unique: true,
            uiConfig: {
                label: 'Referral Username',
                description: 'Your unique referral identifier (3-20 chars, letters/numbers/underscore)',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
            },
        },
        referredById: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Referred By',
                description: 'ID of the user who referred this user',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: false,
            },
        },
    };

    protected static validationRules = {
        name: {
            rules: 'required',
            fieldName: 'Name',
            messages: {
                required: 'Name is required',
            },
        },
        email: {
            rules: 'required|email|unique:users,email',
            fieldName: 'Email',
            messages: {
                required: 'Email is required',
                email: 'Must be a valid email',
                unique: 'Email already exists',
            },
        },
    };

    constructor(data: { [key: string]: any }) {
        const params: IModelConstructorParams = { entity: User.entity, data };
        super(params);
    }

    // ============================================================
    // RELATIONSHIPS
    // ============================================================

    /**
     * Get authentication accounts for this user (HasMany Account)
     */
    async accounts(options?: { select?: string[]; orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        // Dynamic import
        const { Account } = await import('./Account');

        return this.hasMany(Account, 'userId', options);
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /**
     * Find user by email
     */
    static async findByEmail(email: string) {
        return this.first({ email });
    }

    /**
     * Get user's display name
     */
    getDisplayName(): string {
        return this.get('name') || this.get('email');
    }

    /**
     * Get the user who referred this user (BelongsTo User)
     */
    async referrer() {
        const referredById = this.get('referredById');
        if (!referredById) return null;

        return User.find(referredById);
    }

    /**
     * Get users referred by this user (HasMany User)
     */
    async referrals(options?: {
        select?: string[];
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
        limit?: number;
    }) {
        return this.hasMany(User, 'referredById', options);
    }

    /**
     * Find user by referral username
     */
    static async findByReferralUsername(username: string) {
        return this.first({ referralUsername: username });
    }
}

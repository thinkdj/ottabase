// ============================================================
// ReferralTracking Model (Fat Model)
// ============================================================

import { BaseModel, ModelFields, type PackageType, User } from '@ottabase/ottaorm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Referral Tracking Table
 *
 * Tracks all referral link clicks and conversions.
 * Each click creates a record with status 'pending', which updates to 'completed' on signup.
 */
export const referralTrackingTable = sqliteTable(
    'referral_tracking',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        // Referrer information
        userId: text('user_id').notNull(), // The user who owns the referral code
        referralCode: text('referral_code').notNull(), // The code used (snapshot at click time)

        // Referred user (null until conversion)
        referredUserId: text('referred_user_id'),

        // Tracking status
        status: text('status', { enum: ['pending', 'completed', 'invalid'] })
            .notNull()
            .default('pending'),

        // Click metadata
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        referer: text('referer'), // HTTP "Referer" header (intentionally uses the historical header spelling for the column name)

        // UTM and additional metadata (JSON)
        meta: text('meta', { mode: 'json' }).$type<{
            utm?: {
                source?: string;
                medium?: string;
                campaign?: string;
                term?: string;
                content?: string;
            };
            headers?: Record<string, string>;
            [key: string]: any;
        }>(),

        // Timestamps
        createdAt: integer('created_at', { mode: 'timestamp' })
            .notNull()
            .$defaultFn(() => new Date()),
        conversionAt: integer('conversion_at', { mode: 'timestamp' }),

        // App identifier for multi-app database sharing (nullable, opt-in)
        appId: text('app_id'),
    },
    (table) => ({
        userIdIdx: index('referral_tracking_user_id_idx').on(table.userId),
        referredUserIdIdx: index('referral_tracking_referred_user_id_idx').on(table.referredUserId),
        referralCodeIdx: index('referral_tracking_referral_code_idx').on(table.referralCode),
        statusIdx: index('referral_tracking_status_idx').on(table.status),
        appIdIdx: index('referral_tracking_app_id_idx').on(table.appId),
    }),
);

export type ReferralTrackingRecord = typeof referralTrackingTable.$inferSelect;
export type ReferralTrackingInsert = typeof referralTrackingTable.$inferInsert;

/**
 * ReferralTracking model - Tracks referral clicks and conversions
 */
export class ReferralTracking extends BaseModel {
    static entity = 'referral_tracking';
    static table = referralTrackingTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/referrals';
    static packageType: PackageType = 'package';

    static displayName = 'Referral Tracking';
    static displayNamePlural = 'Referral Trackings';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        createdAt: 'date' as const,
        conversionAt: 'date' as const,
        meta: 'json' as const,
    };

    protected static defaults = {
        status: 'pending',
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
        userId: {
            type: 'string',
            editable: false,
            searchable: true,
            uiConfig: {
                label: 'Referrer User ID',
            },
            tableConfig: {
                visible: true,
                colWidth: 200,
            },
        },
        referralCode: {
            type: 'string',
            editable: false,
            searchable: true,
            uiConfig: {
                label: 'Referral Code',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        referredUserId: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Referred User ID',
            },
            tableConfig: {
                visible: true,
                colWidth: 200,
            },
        },
        status: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: {
                label: 'Status',
            },
            tableConfig: {
                visible: true,
                colWidth: 120,
            },
        },
        ipAddress: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'IP Address',
            },
            tableConfig: {
                visible: false,
            },
        },
        userAgent: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'User Agent',
            },
            tableConfig: {
                visible: false,
            },
        },
        referer: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Referer',
            },
            tableConfig: {
                visible: false,
            },
        },
        meta: {
            type: 'json',
            editable: false,
            uiConfig: {
                label: 'Metadata',
            },
            tableConfig: {
                visible: false,
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Created',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        conversionAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Converted',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
    };

    // ============================================================
    // QUERY HELPERS
    // ============================================================

    /**
     * Get all tracking records for a user (referrer)
     */
    static async forUser(
        userId: string,
        options?: {
            status?: 'pending' | 'completed' | 'invalid';
            limit?: number;
            offset?: number;
        },
    ) {
        const query: any = { userId };
        if (options?.status) {
            query.status = options.status;
        }

        return this.where(query, {
            orderBy: 'createdAt',
            orderDirection: 'desc',
            limit: options?.limit,
            offset: options?.offset,
        });
    }

    /**
     * Get stats for a user's referrals
     */
    static async getStats(userId: string) {
        const all = await this.where({ userId });

        const total = all.length;
        const completed = all.filter((r) => r.get('status') === 'completed').length;
        const pending = all.filter((r) => r.get('status') === 'pending').length;

        return {
            total,
            completed,
            pending,
        };
    }

    /**
     * Find pending tracking records by referral code
     */
    static async findPendingByCode(referralCode: string) {
        return this.where({
            referralCode,
            status: 'pending',
        });
    }

    /**
     * Get recent conversions
     */
    static async recentConversions(limit: number = 10) {
        const all = await this.where(
            { status: 'completed' },
            {
                orderBy: 'conversionAt',
                orderDirection: 'desc',
                limit,
            },
        );

        return all;
    }

    // ============================================================
    // INSTANCE METHODS
    // ============================================================

    /**
     * Mark this tracking record as completed
     */
    async markCompleted(referredUserId: string) {
        this.set('status', 'completed');
        this.set('referredUserId', referredUserId);
        this.set('conversionAt', new Date());
        return this.save();
    }

    /**
     * Mark this tracking record as invalid
     */
    async markInvalid() {
        this.set('status', 'invalid');
        return this.save();
    }

    /**
     * Get the referrer user
     */
    async referrer() {
        const userId = this.get('userId');
        if (!userId) return null;

        return User.find(userId);
    }

    /**
     * Get the referred user (if converted)
     */
    async referredUser() {
        const referredUserId = this.get('referredUserId');
        if (!referredUserId) return null;

        return User.find(referredUserId);
    }

    /**
     * Check if this tracking record has been converted
     */
    isConverted(): boolean {
        return this.get('status') === 'completed' && !!this.get('referredUserId');
    }

    /**
     * Get UTM parameters from metadata
     */
    getUtmParams() {
        const meta = this.get('meta') as any;
        return meta?.utm || {};
    }

    /**
     * Get browser info from user agent
     */
    getBrowserInfo(): { browser?: string; os?: string } {
        const userAgent = this.get('userAgent');
        if (!userAgent) return {};

        // Simple browser detection
        let browser = 'Unknown';
        if (userAgent.includes('Chrome')) browser = 'Chrome';
        else if (userAgent.includes('Firefox')) browser = 'Firefox';
        else if (userAgent.includes('Safari')) browser = 'Safari';
        else if (userAgent.includes('Edge')) browser = 'Edge';

        // Simple OS detection
        let os = 'Unknown';
        if (userAgent.includes('Windows')) os = 'Windows';
        else if (userAgent.includes('Mac')) os = 'macOS';
        else if (userAgent.includes('Linux')) os = 'Linux';
        else if (userAgent.includes('Android')) os = 'Android';
        else if (userAgent.includes('iOS')) os = 'iOS';

        return { browser, os };
    }
}

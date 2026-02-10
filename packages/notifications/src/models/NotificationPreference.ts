// ============================================================
// @ottabase/notifications - Notification Preference Model
// ============================================================

import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm/base';
import { notificationPreferencesTable } from './Notification.schema';

export {
    notificationPreferencesTable,
    type NewNotificationPreferenceType,
    type NotificationPreferenceType,
} from './Notification.schema';

/**
 * Notification preference model for user notification settings
 *
 * @example
 * ```typescript
 * import { NotificationPreference } from "@ottabase/notifications/models";
 *
 * // Get user preferences
 * const prefs = await NotificationPreference.first({ userId: "123" });
 *
 * // Update preferences
 * await prefs.update({
 *   enableEmail: false,
 *   enableWebSocket: true
 * });
 *
 * // Get enabled channels
 * const channels = prefs.getEnabledChannels();
 * ```
 */
export class NotificationPreference extends BaseModel {
    static entity = 'notification_preferences';
    static table = notificationPreferencesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/notifications';
    static packageType: PackageType = 'core';

    // UI/Forms metadata
    static displayName = 'Notification Preference';
    static displayNamePlural = 'Notification Preferences';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
        enableEmail: 'boolean' as const,
        enableWebSocket: 'boolean' as const,
        enableSystem: 'boolean' as const,
    };

    static writable = {
        create: ['userId', 'enableEmail', 'enableWebSocket', 'enableSystem', 'categoryPreferences'],
        update: ['enableEmail', 'enableWebSocket', 'enableSystem', 'categoryPreferences'],
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
            editable: true,
            searchable: true,
            unique: true,
            uiConfig: {
                label: 'User ID',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: true,
            },
        },
        enableEmail: {
            type: 'boolean',
            editable: true,
            uiConfig: {
                label: 'Enable Email',
                description: 'Receive email notifications',
            },
            formConfig: {
                visible: true,
                fieldType: 'boolean',
            },
            tableConfig: {
                visible: true,
            },
        },
        enableWebSocket: {
            type: 'boolean',
            editable: true,
            uiConfig: {
                label: 'Enable WebSocket',
                description: 'Receive real-time notifications',
            },
            formConfig: {
                visible: true,
                fieldType: 'boolean',
            },
            tableConfig: {
                visible: true,
            },
        },
        enableSystem: {
            type: 'boolean',
            editable: true,
            uiConfig: {
                label: 'Enable System',
                description: 'Receive system notifications',
            },
            formConfig: {
                visible: true,
                fieldType: 'boolean',
            },
            tableConfig: {
                visible: true,
            },
        },
        categoryPreferences: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Category Preferences',
                description: 'JSON object of category-specific preferences',
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Created',
            },
            tableConfig: {
                visible: true,
            },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Updated',
            },
            tableConfig: {
                visible: true,
            },
        },
    };

    /**
     * Get enabled notification channels
     */
    getEnabledChannels(): string[] {
        const channels: string[] = [];

        if (this.get('enableEmail')) channels.push('email');
        if (this.get('enableWebSocket')) channels.push('websocket');
        if (this.get('enableSystem')) channels.push('system');

        return channels;
    }

    /**
     * Check if a specific category is enabled
     */
    isCategoryEnabled(category: string): boolean {
        const prefs = this.get('categoryPreferences');
        if (!prefs) return true; // Default to enabled

        try {
            const parsed = JSON.parse(prefs);
            return parsed[category] !== false;
        } catch {
            return true;
        }
    }

    /**
     * Set category preference
     */
    async setCategoryPreference(category: string, enabled: boolean): Promise<void> {
        const prefs = this.get('categoryPreferences');
        let parsed: Record<string, boolean> = {};

        if (prefs) {
            try {
                parsed = JSON.parse(prefs);
            } catch {
                parsed = {};
            }
        }

        parsed[category] = enabled;

        this.set('categoryPreferences', JSON.stringify(parsed));
        await this.save();
    }

    /**
     * Get or create preferences for a user
     */
    static async getOrCreate(userId: string): Promise<NotificationPreference> {
        let prefs = await this.first({ userId });

        if (!prefs) {
            prefs = await this.create({
                userId,
                enableEmail: true,
                enableWebSocket: true,
                enableSystem: false,
            });
        }

        return prefs;
    }
}

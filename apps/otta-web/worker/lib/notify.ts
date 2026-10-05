import { NotificationModel, NotificationPreference } from '@ottabase/notifications';
import { redactErrorForLog } from '@ottabase/utils/http-errors';

/** The kinds of in-app notification the app sends. A person can turn each one off on their account page. */
export const NOTIFICATION_CATEGORIES = {
    comments: 'Replies to your comments',
    organizations: 'Changes to your organizations',
} as const;

export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES;

export interface NotifyInput {
    title: string;
    message: string;
    category: NotificationCategory;
    /** Where the notification takes the person when opened */
    actionUrl?: string;
    actionText?: string;
}

/**
 * Put a notification in someone's inbox, unless they turned that kind off.
 * Never throws: an inbox entry is not worth failing the action that caused it.
 */
export async function notifyUser(userId: string, input: NotifyInput): Promise<boolean> {
    try {
        const prefs = await NotificationPreference.first({ userId });
        if (prefs && !prefs.isCategoryEnabled(input.category)) return false;
        await NotificationModel.create({
            userId,
            title: input.title.slice(0, 200),
            message: input.message.slice(0, 1000),
            category: input.category,
            actionUrl: input.actionUrl ?? null,
            actionText: input.actionText ?? null,
            channels: JSON.stringify(['inbox']),
            priority: 'normal',
        });
        return true;
    } catch (error) {
        console.error(
            JSON.stringify({
                event: 'notification_failed',
                category: input.category,
                error: redactErrorForLog(error),
            }),
        );
        return false;
    }
}

/** The result of `work`, or null when it fails: for lookups that only decorate a notification */
export async function quietly<T>(work: () => Promise<T>): Promise<T | null> {
    try {
        return await work();
    } catch {
        return null;
    }
}

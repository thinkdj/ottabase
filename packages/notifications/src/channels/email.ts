// ============================================================
// @ottabase/notifications - Email Channel
// ============================================================

import type { Mailer } from '@ottabase/email';
import type { Notification, NotificationChannelHandler, SendResult } from '../types';

/**
 * Email channel configuration
 */
export interface EmailChannelConfig {
    /** Email mailer instance */
    mailer: Mailer;
    /** Default from address */
    from: string;
    /** Default reply-to address */
    replyTo?: string;
    /** Email template name (optional) */
    template?: string;
}

/**
 * Email notification channel handler
 *
 * @example
 * ```typescript
 * import { createResendMailer } from "@ottabase/email/providers/resend";
 * import { EmailChannel } from "@ottabase/notifications/channels";
 *
 * const mailer = createResendMailer({ apiKey: "..." });
 * const emailChannel = new EmailChannel({
 *   mailer,
 *   from: "noreply@example.com"
 * });
 *
 * await emailChannel.send(notification);
 * ```
 */
export class EmailChannel implements NotificationChannelHandler {
    name = 'email' as const;
    private config: EmailChannelConfig;

    constructor(config: EmailChannelConfig) {
        this.config = config;
    }

    async send(notification: Notification): Promise<SendResult> {
        try {
            if (!notification.recipient.email) {
                return {
                    success: false,
                    error: 'No email address provided for recipient',
                };
            }

            const { payload } = notification;
            const from = this.config.from;
            const replyTo = this.config.replyTo;

            // Helper to escape HTML
            const escapeHtml = (text: string) => {
                return text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            };

            // Build email content with escaped values
            let html = `
        <h2>${escapeHtml(payload.title)}</h2>
        <p>${escapeHtml(payload.message)}</p>
      `;

            if (payload.actionUrl && payload.actionText) {
                // Validate URL scheme
                const url = payload.actionUrl.trim();
                if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
                    html += `
          <p>
            <a href="${escapeHtml(url)}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
              ${escapeHtml(payload.actionText)}
            </a>
          </p>
        `;
                }
            }

            // Add metadata if present
            if (payload.metadata) {
                html += `<hr><small>Metadata: ${escapeHtml(JSON.stringify(payload.metadata))}</small>`;
            }

            const result = await this.config.mailer.send({
                to: notification.recipient.email,
                from,
                replyTo,
                subject: payload.title,
                html,
                text: payload.message,
            });

            if (result.success) {
                return {
                    success: true,
                    messageId: result.id,
                    metadata: { provider: 'email' },
                };
            } else {
                return {
                    success: false,
                    error: result.error || 'Failed to send email',
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    async isAvailable(): Promise<boolean> {
        return !!this.config.mailer;
    }
}

/**
 * Create an email notification channel
 */
export function createEmailChannel(config: EmailChannelConfig): EmailChannel {
    return new EmailChannel(config);
}

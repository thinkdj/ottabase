// ============================================================
// Shortlink Model (Fat Model)
// ============================================================

import { BaseModel, ModelFields, PackageType } from '@ottabase/ottaorm';
import { renderExpiredShortlinkPage } from '../pages/expired';
import { renderShortlinkInterstitialPage } from '../pages/interstitial';
import { ShortlinkTypes } from '../types';
import { shortlinksTable } from './Shortlink.schema';

export { shortlinksTable, type NewShortlinkRecord, type ShortlinkRecord } from './Shortlink.schema';

/**
 * Shortlink model - URL shortening service
 */
export class Shortlink extends BaseModel {
    static entity = 'shortlinks';
    static table = shortlinksTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/shortlinks';
    static packageType: PackageType = 'package';

    static casts = {
        expiryDate: 'date' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
        lastClickedAt: 'date' as const,
        clicks: 'number' as const,
        interstitialEnabled: 'boolean' as const,
        interstitialSeconds: 'number' as const,
    };

    protected static defaults = {
        type: ShortlinkTypes.REDIRECT,
        clicks: 0,
        interstitialEnabled: false,
        interstitialSeconds: 10,
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
        fullUrl: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Full URL',
                description: 'The destination URL',
                placeholder: 'https://example.com/very/long/url',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 'auto',
            },
            validation: {
                rules: 'required|url',
                messages: {
                    required: 'URL is required',
                    url: 'Must be a valid URL',
                },
            },
        },
        shortCode: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Short Code',
                description: 'Unique identifier for the short URL',
                placeholder: 'gh',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
            validation: {
                rules: 'required|alpha_dash|min:2|max:50',
                messages: {
                    required: 'Short code is required',
                    alpha_dash: 'Only letters, numbers, dashes and underscores allowed',
                    min: 'Minimum 2 characters',
                    max: 'Maximum 50 characters',
                },
            },
        },
        type: {
            type: 'string',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: {
                label: 'Type',
                description: 'Link type',
                defaultValue: ShortlinkTypes.REDIRECT,
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: Object.values(ShortlinkTypes).map((type) => ({
                    name: type.charAt(0).toUpperCase() + type.slice(1),
                    id: type,
                })),
            },
            tableConfig: {
                visible: true,
                colWidth: 120,
            },
        },
        appId: {
            type: 'string',
            editable: false,
            filterable: true,
            sortable: true,
            uiConfig: {
                label: 'App ID',
                description: 'Auto-set when scopeByAppId is enabled',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        expiryDate: {
            type: 'date',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Expiry Date',
                description: 'Optional expiration date',
            },
            formConfig: {
                visible: true,
                fieldType: 'datetime',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        interstitialEnabled: {
            type: 'boolean',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Interstitial',
                description: 'Show countdown before redirect',
            },
            formConfig: {
                visible: true,
                fieldType: 'boolean',
            },
            tableConfig: {
                visible: true,
                colWidth: 120,
            },
        },
        interstitialSeconds: {
            type: 'number',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Interstitial Seconds',
                description: 'Seconds to wait before redirect',
            },
            formConfig: {
                visible: true,
                fieldType: 'number',
                min: 1,
                max: 60,
                step: 1,
            },
            tableConfig: {
                visible: true,
                colWidth: 160,
            },
        },
        clicks: {
            type: 'number',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Clicks',
                description: 'Number of times this link has been clicked',
            },
            tableConfig: {
                visible: true,
                colWidth: 100,
            },
        },
        lastClickedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Last Clicked',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
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
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Updated',
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
     * Find a shortlink by short code
     */
    static async findByCode(code: string, options?: { appId?: string }) {
        const query: Record<string, unknown> = { shortCode: code };
        if (options?.appId) query.appId = options.appId;

        const results = await this.where(query);
        return results.length > 0 ? (results[0] as Shortlink) : null;
    }

    /**
     * Get all shortlinks for a specific app
     */
    static async forApp(
        appId: string,
        options?: {
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
        },
    ) {
        return this.where(
            { appId },
            {
                orderBy: options?.orderBy || 'createdAt',
                orderDirection: options?.orderDirection || 'desc',
            },
        );
    }

    // ============================================================
    // INSTANCE METHODS
    // ============================================================

    /**
     * Track a click (increment count + update lastClickedAt)
     */
    async trackClick() {
        const currentClicks = this.get('clicks') || 0;
        this.set('clicks', currentClicks + 1);
        this.set('lastClickedAt', Date.now());
        return this.save();
    }

    /**
     * Check if shortlink is expired
     */
    isExpired(): boolean {
        const expiryDate = this.get('expiryDate') as Date | null;
        if (!expiryDate) return false;
        return expiryDate.getTime() < Date.now();
    }

    /**
     * Build the redirect response that handles expiry and interstitial display.
     */
    static buildRedirectResponse(shortlink: Shortlink): Response {
        if (shortlink.isExpired()) {
            return renderExpiredShortlinkPage();
        }

        if (shortlink.get('interstitialEnabled')) {
            return renderShortlinkInterstitialPage({
                url: shortlink.get('fullUrl') as string,
                seconds: (shortlink.get('interstitialSeconds') as number) || 10,
            });
        }

        return Response.redirect(shortlink.get('fullUrl') as string, 302);
    }
}

export function buildRedirectResponse(shortlink: Shortlink): Response {
    return Shortlink.buildRedirectResponse(shortlink);
}

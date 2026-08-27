// ============================================================
// Shortlink Model (Fat Model)
// ============================================================

import { BaseModel, DomainValidationError, ModelFields, PackageType } from '@ottabase/ottaorm';
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
        interstitialEnabled: 'boolean' as const,
        interstitialSeconds: 'number' as const,
    };

    static writable = {
        create: [
            'fullUrl',
            'shortCode',
            'type',
            'expiryDate',
            'interstitialEnabled',
            'interstitialSeconds',
            // Allow server-set appId for app-scoped RLS
            'appId',
        ],
        update: ['fullUrl', 'shortCode', 'type', 'expiryDate', 'interstitialEnabled', 'interstitialSeconds'],
    };

    protected static defaults = {
        type: ShortlinkTypes.REDIRECT,
        interstitialEnabled: false,
        interstitialSeconds: 10,
    };

    private static normalizeDestination(value: unknown): string {
        const destination = typeof value === 'string' ? value.trim() : '';
        if (!destination || new TextEncoder().encode(destination).byteLength > 2048) {
            throw new DomainValidationError('Destination must be a URL no longer than 2048 bytes', {
                code: 'INVALID_DESTINATION_URL',
                fieldErrors: { fullUrl: ['Enter a valid HTTP or HTTPS URL'] },
            });
        }

        try {
            const parsed = new URL(destination);
            if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
            return parsed.toString();
        } catch {
            throw new DomainValidationError('Destination must be an absolute HTTP or HTTPS URL', {
                code: 'INVALID_DESTINATION_URL',
                fieldErrors: { fullUrl: ['Enter a valid HTTP or HTTPS URL'] },
            });
        }
    }

    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: any,
    ): Promise<InstanceType<T>> {
        return (await super.create.call(
            this,
            {
                ...data,
                fullUrl: Shortlink.normalizeDestination(data.fullUrl),
            },
            driver,
        )) as InstanceType<T>;
    }

    protected static async prepareUpdateMutation(data: Record<string, any>): Promise<Record<string, any>> {
        return Object.prototype.hasOwnProperty.call(data, 'fullUrl')
            ? { ...data, fullUrl: Shortlink.normalizeDestination(data.fullUrl) }
            : data;
    }

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

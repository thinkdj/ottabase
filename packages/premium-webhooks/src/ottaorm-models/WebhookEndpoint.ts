// ============================================================
// WebhookEndpoint model (Fat Model)
// ============================================================

import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { webhookEndpointsTable } from '../schema';

export class WebhookEndpoint extends BaseModel {
    static entity = 'premium_webhook_endpoints';
    static table = webhookEndpointsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/premium-webhooks';
    static packageType: PackageType = 'package';

    static displayName = 'Webhook Endpoint';
    static displayNamePlural = 'Webhook Endpoints';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        events: 'json' as const,
        enabled: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
        lastDeliveryAt: 'date' as const,
    };

    protected static defaults = {
        enabled: true,
        consecutiveFailures: 0,
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        url: { type: 'string', searchable: true, uiConfig: { label: 'Destination URL' } },
        description: { type: 'string', searchable: true, uiConfig: { label: 'Description' } },
        events: { type: 'json', uiConfig: { label: 'Events' } },
        // NEVER surfaced in generic UI: the signing secret is shown once, at creation.
        secret: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Signing secret' },
            formConfig: { fieldType: 'hidden', visible: false },
            tableConfig: { visible: false },
        },
        enabled: { type: 'boolean', uiConfig: { label: 'Enabled' } },
        lastStatus: { type: 'string', editable: false, uiConfig: { label: 'Last status' } },
        lastStatusCode: { type: 'number', editable: false, uiConfig: { label: 'Last HTTP code' } },
        lastDeliveryAt: { type: 'date', editable: false, uiConfig: { label: 'Last delivery' } },
        consecutiveFailures: { type: 'number', editable: false, uiConfig: { label: 'Consecutive failures' } },
        createdAt: { type: 'date', editable: false, uiConfig: { label: 'Created' } },
    };

    /** Does this endpoint want `event`? `'*'` subscribes to everything. */
    subscribesTo(event: string): boolean {
        const events = (this.get('events') as string[] | null) ?? [];
        return events.includes('*') || events.includes(event);
    }

    /**
     * Record the outcome of one delivery on the endpoint itself.
     *
     * Always written, licensed or not: this is the free tier's entire observability, and
     * the delivery LOG (retention) is the part that is sold.
     */
    async recordDelivery(outcome: { ok: boolean; statusCode?: number | null }): Promise<this> {
        this.set('lastStatus', outcome.ok ? 'success' : 'failed');
        this.set('lastStatusCode', outcome.statusCode ?? null);
        this.set('lastDeliveryAt', Date.now());
        this.set('consecutiveFailures', outcome.ok ? 0 : Number(this.get('consecutiveFailures') ?? 0) + 1);
        return this.save();
    }

    /** The client-safe view. The signing secret is never in it — see `WebhookEndpointView`. */
    toView(): WebhookEndpointView {
        return {
            id: String(this.get('id')),
            url: String(this.get('url')),
            description: (this.get('description') as string | null) ?? null,
            events: ((this.get('events') as string[] | null) ?? []).slice(),
            enabled: Boolean(this.get('enabled')),
            lastStatus: (this.get('lastStatus') as string | null) ?? null,
            lastStatusCode: (this.get('lastStatusCode') as number | null) ?? null,
            lastDeliveryAt: toEpochMs(this.get('lastDeliveryAt')),
            consecutiveFailures: Number(this.get('consecutiveFailures') ?? 0),
            createdAt: toEpochMs(this.get('createdAt')) ?? 0,
        };
    }
}

/** What the browser is allowed to see. Deliberately has no `secret` field at all. */
export interface WebhookEndpointView {
    id: string;
    url: string;
    description: string | null;
    events: string[];
    enabled: boolean;
    lastStatus: string | null;
    lastStatusCode: number | null;
    lastDeliveryAt: number | null;
    consecutiveFailures: number;
    createdAt: number;
}

/** Casts turn timestamps into Dates; the wire format stays epoch-ms in both directions. */
function toEpochMs(value: unknown): number | null {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    return null;
}

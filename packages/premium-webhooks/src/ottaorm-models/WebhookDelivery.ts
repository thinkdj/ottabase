// ============================================================
// WebhookDelivery model (Fat Model)
// ============================================================
// The delivery LOG is the paid half of this package: an unlicensed install still sees
// each endpoint's last outcome, but no history. Retention is what costs money, so
// retention is what is sold.
// ============================================================

import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { webhookDeliveriesTable } from '../schema';

export class WebhookDelivery extends BaseModel {
    static entity = 'premium_webhook_deliveries';
    static table = webhookDeliveriesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/premium-webhooks';
    static packageType: PackageType = 'package';

    static displayName = 'Webhook Delivery';
    static displayNamePlural = 'Webhook Deliveries';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        createdAt: 'date' as const,
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        endpointId: { type: 'string', editable: false, uiConfig: { label: 'Endpoint' } },
        event: { type: 'string', editable: false, searchable: true, uiConfig: { label: 'Event' } },
        status: { type: 'string', editable: false, uiConfig: { label: 'Status' } },
        statusCode: { type: 'number', editable: false, uiConfig: { label: 'HTTP code' } },
        error: { type: 'string', editable: false, uiConfig: { label: 'Error' } },
        durationMs: { type: 'number', editable: false, uiConfig: { label: 'Duration (ms)' } },
        createdAt: { type: 'date', editable: false, uiConfig: { label: 'At' } },
    };

    toView(): WebhookDeliveryView {
        const createdAt = this.get('createdAt');
        return {
            id: String(this.get('id')),
            endpointId: String(this.get('endpointId')),
            event: String(this.get('event')),
            status: String(this.get('status')),
            statusCode: (this.get('statusCode') as number | null) ?? null,
            error: (this.get('error') as string | null) ?? null,
            durationMs: (this.get('durationMs') as number | null) ?? null,
            createdAt: createdAt instanceof Date ? createdAt.getTime() : Number(createdAt ?? 0),
        };
    }
}

export interface WebhookDeliveryView {
    id: string;
    endpointId: string;
    event: string;
    status: string;
    statusCode: number | null;
    error: string | null;
    durationMs: number | null;
    createdAt: number;
}

// ============================================================
// WebhookDelivery model (Fat Model)
// ============================================================
// The delivery LOG: one row per dispatched attempt, beside the last outcome each
// endpoint keeps on itself.
// ============================================================

import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { webhookDeliveriesTable } from '../schema';

export class WebhookDelivery extends BaseModel {
    static entity = 'premium_webhook_deliveries';
    static table = webhookDeliveriesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/webhooks';
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

    /**
     * Delete one app's log rows older than `days`, across its tenants. Returns how many went.
     * Scoped by app so two apps sharing a database each keep their own retention.
     */
    static async pruneOlderThan(days: number, appId: string): Promise<number> {
        if (!Number.isFinite(days) || days <= 0) {
            throw new Error(`[webhooks] delivery retention must be a positive number of days, got ${String(days)}`);
        }
        const cutoff = Date.now() - days * 86_400_000;
        // ponytail: one DELETE per run; batch by `id IN (SELECT … LIMIT n)` if a run ever exceeds D1's statement time.
        const result = await this.getDriver().executeRaw(
            `DELETE FROM ${this.entity} WHERE created_at < ? AND app_id = ?`,
            [cutoff, appId],
        );
        return result?.meta?.changes ?? 0;
    }

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

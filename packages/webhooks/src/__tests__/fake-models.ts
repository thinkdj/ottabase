// ============================================================
// A tiny in-memory stand-in for the two OttaORM models.
//
// Deliberately NOT a stub Drizzle driver: what these suites are about is tenancy
// filtering and entitlement gating, and a fake at the model boundary keeps that
// visible instead of burying it under three layers of query-builder mimicry.
// ============================================================

interface Row extends Record<string, unknown> {
    id: string;
}

/** Shared table state, reset between tests. */
export const tables = {
    endpoints: [] as Row[],
    deliveries: [] as Row[],
};

export function resetTables(): void {
    tables.endpoints = [];
    tables.deliveries = [];
}

/** Every key in `filter` must match exactly — the same AND-ed equality the ORM applies. */
function matches(row: Row, filter: Record<string, unknown>): boolean {
    return Object.entries(filter).every(([key, value]) => row[key] === value);
}

class FakeRecord {
    constructor(
        protected row: Row,
        protected store: Row[],
    ) {}

    get(key: string): unknown {
        return this.row[key];
    }

    set(key: string, value: unknown): void {
        this.row[key] = value;
    }

    async save(): Promise<this> {
        const index = this.store.findIndex((entry) => entry.id === this.row.id);
        if (index >= 0) this.store[index] = { ...this.row };
        return this;
    }
}

export class FakeWebhookEndpoint extends FakeRecord {
    static async where(filter: Record<string, unknown>): Promise<FakeWebhookEndpoint[]> {
        return tables.endpoints
            .filter((row) => matches(row, filter))
            .map((row) => new FakeWebhookEndpoint(row, tables.endpoints));
    }

    static async create(data: Record<string, unknown>): Promise<FakeWebhookEndpoint> {
        const row: Row = { id: `ep_${tables.endpoints.length + 1}`, consecutiveFailures: 0, ...data } as Row;
        tables.endpoints.push(row);
        return new FakeWebhookEndpoint(row, tables.endpoints);
    }

    static async delete(id: string): Promise<boolean> {
        const index = tables.endpoints.findIndex((row) => row.id === id);
        if (index >= 0) tables.endpoints.splice(index, 1);
        return index >= 0;
    }

    subscribesTo(event: string): boolean {
        const events = (this.row.events as string[] | undefined) ?? [];
        return events.includes('*') || events.includes(event);
    }

    async recordDelivery(outcome: { ok: boolean; statusCode?: number | null }): Promise<this> {
        this.set('lastStatus', outcome.ok ? 'success' : 'failed');
        this.set('lastStatusCode', outcome.statusCode ?? null);
        this.set('lastDeliveryAt', Date.now());
        this.set('consecutiveFailures', outcome.ok ? 0 : Number(this.row.consecutiveFailures ?? 0) + 1);
        return this.save();
    }

    toView() {
        return {
            id: String(this.row.id),
            url: String(this.row.url),
            description: (this.row.description as string | null) ?? null,
            events: ((this.row.events as string[]) ?? []).slice(),
            enabled: Boolean(this.row.enabled),
            lastStatus: (this.row.lastStatus as string | null) ?? null,
            lastStatusCode: (this.row.lastStatusCode as number | null) ?? null,
            lastDeliveryAt: (this.row.lastDeliveryAt as number | null) ?? null,
            consecutiveFailures: Number(this.row.consecutiveFailures ?? 0),
            createdAt: Number(this.row.createdAt ?? 0),
        };
    }
}

export class FakeWebhookDelivery extends FakeRecord {
    static async create(data: Record<string, unknown>): Promise<FakeWebhookDelivery> {
        const row: Row = { id: `dl_${tables.deliveries.length + 1}`, ...data } as Row;
        tables.deliveries.push(row);
        return new FakeWebhookDelivery(row, tables.deliveries);
    }

    static async paginate(page: number, perPage: number, filter: Record<string, unknown>) {
        const rows = tables.deliveries.filter((row) => matches(row, filter));
        return {
            data: rows.map((row) => new FakeWebhookDelivery(row, tables.deliveries)),
            total: rows.length,
            page,
            perPage,
        };
    }

    toView() {
        return {
            id: String(this.row.id),
            endpointId: String(this.row.endpointId),
            event: String(this.row.event),
            status: String(this.row.status),
            statusCode: (this.row.statusCode as number | null) ?? null,
            error: (this.row.error as string | null) ?? null,
            durationMs: (this.row.durationMs as number | null) ?? null,
            createdAt: Number(this.row.createdAt ?? 0),
        };
    }
}

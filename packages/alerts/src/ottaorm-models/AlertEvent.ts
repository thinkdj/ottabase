import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { alertDeliveriesTable, alertEventsTable, type AlertEventRecord } from '../schema';
import type { Severity } from '../types';

type Db = BaseSQLiteDatabase<'async', unknown>;
export type NewEvent = typeof alertEventsTable.$inferInsert;

export interface EventFilter {
    source?: string;
    severity?: Severity;
    /** Older than this `raisedAt`: the next page. */
    before?: number;
    limit: number;
}

/** One alert that went on to its channels. */
export class AlertEvent extends BaseModel {
    static entity = 'alert_events';
    static table = alertEventsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/alerts';
    static packageType: PackageType = 'package';
    static displayName = 'Alert';
    static displayNamePlural = 'Alerts';
    static defaultSort = 'raisedAt';
    static defaultSortDirection = 'desc' as const;

    static writable = { create: [], update: [] };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        source: { type: 'string', editable: false, uiConfig: { label: 'Source' } },
        kind: { type: 'string', editable: false, uiConfig: { label: 'Kind' } },
        severity: { type: 'string', editable: false, uiConfig: { label: 'Severity' } },
        title: { type: 'string', editable: false, searchable: true, uiConfig: { label: 'Title' } },
        raisedAt: { type: 'date', editable: false, uiConfig: { label: 'Raised' } },
    };

    private static db(): Db {
        return this.getDriver().getDb() as Db;
    }

    static async insert(values: NewEvent): Promise<AlertEventRecord> {
        const rows = await this.db().insert(alertEventsTable).values(values).returning();
        return rows[0] as AlertEventRecord;
    }

    static async findFor(appId: string, id: string): Promise<AlertEventRecord | null> {
        const t = alertEventsTable;
        const rows = await this.db()
            .select()
            .from(t)
            .where(and(eq(t.appId, appId), eq(t.id, id)))
            .limit(1);
        return (rows[0] as AlertEventRecord | undefined) ?? null;
    }

    /** Newest first. */
    static async recent(appId: string, filter: EventFilter): Promise<AlertEventRecord[]> {
        const t = alertEventsTable;
        return (await this.db()
            .select()
            .from(t)
            .where(
                and(
                    eq(t.appId, appId),
                    filter.source ? eq(t.source, filter.source) : undefined,
                    filter.severity ? eq(t.severity, filter.severity) : undefined,
                    filter.before !== undefined ? lt(t.raisedAt, filter.before) : undefined,
                ),
            )
            .orderBy(desc(t.raisedAt))
            .limit(filter.limit)) as AlertEventRecord[];
    }

    /** Stored alerts since `since`, by severity. */
    static async countsSince(appId: string, since: number): Promise<Record<string, number>> {
        const t = alertEventsTable;
        const rows = await this.db()
            .select({ severity: t.severity, n: sql<number>`count(*)` })
            .from(t)
            .where(and(eq(t.appId, appId), gte(t.raisedAt, since)))
            .groupBy(t.severity);
        return Object.fromEntries(rows.map((row) => [row.severity, Number(row.n)]));
    }

    static async sourcesSince(appId: string, since: number): Promise<string[]> {
        const t = alertEventsTable;
        const rows = await this.db()
            .selectDistinct({ source: t.source })
            .from(t)
            .where(and(eq(t.appId, appId), gte(t.raisedAt, since)))
            .orderBy(t.source);
        return rows.map((row) => row.source);
    }

    /**
     * Alerts raised before `before` go, with their deliveries, in two set-based statements
     * whatever the backlog. A delivery still waiting for a digest goes with its alert: a
     * digest of month-old alerts helps nobody.
     */
    static async pruneBefore(appId: string, before: number): Promise<number> {
        const t = alertEventsTable;
        const db = this.db();
        const old = and(eq(t.appId, appId), lt(t.raisedAt, before));
        await db
            .delete(alertDeliveriesTable)
            .where(
                and(
                    eq(alertDeliveriesTable.appId, appId),
                    inArray(alertDeliveriesTable.eventId, db.select({ id: t.id }).from(t).where(old)),
                ),
            );
        const rows = await db.delete(t).where(old).returning({ id: t.id });
        return rows.length;
    }
}

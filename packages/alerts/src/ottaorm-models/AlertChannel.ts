import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { MAX_ERROR } from '../constants';
import { alertChannelsTable, type AlertChannelRecord } from '../schema';

type Db = BaseSQLiteDatabase<'async', unknown>;
export type NewChannel = typeof alertChannelsTable.$inferInsert;

/**
 * Where alerts go. The operator's rows, partitioned by app id. Writes go through the statics
 * below: the failure counter moves atomically, and `secret` is sealed before it gets here.
 */
export class AlertChannel extends BaseModel {
    static entity = 'alert_channels';
    static table = alertChannelsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/alerts';
    static packageType: PackageType = 'package';
    static displayName = 'Alert channel';
    static displayNamePlural = 'Alert channels';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'asc' as const;
    /** Sealed, but still nobody's business outside the engine. */
    static hidden = ['secret'];

    static writable = {
        create: [
            'appId',
            'name',
            'type',
            'config',
            'secret',
            'hint',
            'minSeverity',
            'sources',
            'mode',
            'digestHour',
            'maxPerHour',
            'enabled',
        ],
        update: [
            'name',
            'config',
            'secret',
            'hint',
            'minSeverity',
            'sources',
            'mode',
            'digestHour',
            'maxPerHour',
            'enabled',
        ],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        name: { type: 'string', searchable: true, uiConfig: { label: 'Name' } },
        type: { type: 'string', editable: false, uiConfig: { label: 'Type' } },
        minSeverity: { type: 'string', uiConfig: { label: 'Minimum severity' } },
        mode: { type: 'string', uiConfig: { label: 'Mode' } },
        enabled: { type: 'boolean', uiConfig: { label: 'Enabled' } },
        lastSentAt: { type: 'date', editable: false, uiConfig: { label: 'Last sent' } },
    };

    private static db(): Db {
        return this.getDriver().getDb() as Db;
    }

    static async listFor(appId: string): Promise<AlertChannelRecord[]> {
        const t = alertChannelsTable;
        return (await this.db()
            .select()
            .from(t)
            .where(eq(t.appId, appId))
            .orderBy(asc(t.createdAt))) as AlertChannelRecord[];
    }

    static async findFor(appId: string, id: string): Promise<AlertChannelRecord | null> {
        const t = alertChannelsTable;
        const rows = await this.db()
            .select()
            .from(t)
            .where(and(eq(t.appId, appId), eq(t.id, id)))
            .limit(1);
        return (rows[0] as AlertChannelRecord | undefined) ?? null;
    }

    static async countFor(appId: string): Promise<number> {
        const t = alertChannelsTable;
        const rows = await this.db()
            .select({ n: sql<number>`count(*)` })
            .from(t)
            .where(eq(t.appId, appId));
        return Number(rows[0]?.n ?? 0);
    }

    static async insert(values: NewChannel): Promise<AlertChannelRecord> {
        const rows = await this.db().insert(alertChannelsTable).values(values).returning();
        return rows[0] as AlertChannelRecord;
    }

    static async patch(appId: string, id: string, values: Partial<NewChannel>): Promise<AlertChannelRecord | null> {
        const t = alertChannelsTable;
        const rows = await this.db()
            .update(t)
            .set({ ...values, updatedAt: Date.now() })
            .where(and(eq(t.appId, appId), eq(t.id, id)))
            .returning();
        return (rows[0] as AlertChannelRecord | undefined) ?? null;
    }

    static async remove(appId: string, id: string): Promise<boolean> {
        const t = alertChannelsTable;
        const rows = await this.db()
            .delete(t)
            .where(and(eq(t.appId, appId), eq(t.id, id)))
            .returning({ id: t.id });
        return rows.length > 0;
    }

    /** A send went through: the failure streak ends. */
    static async recordSent(id: string, at: number): Promise<void> {
        const t = alertChannelsTable;
        await this.db()
            .update(t)
            .set({ lastSentAt: at, failures: 0, lastError: null, updatedAt: at })
            .where(eq(t.id, id));
    }

    /** A send failed: one more in the streak, and why. */
    static async recordFailure(id: string, at: number, error: string): Promise<void> {
        const t = alertChannelsTable;
        await this.db()
            .update(t)
            .set({
                failures: sql`${t.failures} + 1`,
                lastError: error.slice(0, MAX_ERROR),
                lastErrorAt: at,
                updatedAt: at,
            })
            .where(eq(t.id, id));
    }

    /** The day's digest went out (or there was nothing to send): do not send another today. */
    static async recordDigest(id: string, at: number): Promise<void> {
        const t = alertChannelsTable;
        await this.db().update(t).set({ lastDigestAt: at, updatedAt: at }).where(eq(t.id, id));
    }
}

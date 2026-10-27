import { BaseModel, type PackageType } from '@ottabase/ottaorm';
import { and, asc, eq, gt, gte, inArray, lte, or, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { MAX_ERROR, SENDING_STALE_MS } from '../constants';
import { alertDeliveriesTable, alertEventsTable, type AlertDeliveryRecord, type AlertEventRecord } from '../schema';
import type { DeliveryStatus } from '../types';

type Db = BaseSQLiteDatabase<'async', unknown>;
export type NewDelivery = typeof alertDeliveriesTable.$inferInsert;

/** Rows per INSERT: eleven columns each stays under D1's 100 bound values. */
const INSERT_CHUNK = 8;
/** Ids per IN (…), with room for the statement's other values. */
const ID_CHUNK = 90;

/** Statuses that still owe the channel something. */
const UNFINISHED: DeliveryStatus[] = ['pending', 'sending', 'failed', 'held', 'digest'];

/** One alert to one channel, and how that went. */
export class AlertDelivery extends BaseModel {
    static entity = 'alert_deliveries';
    static table = alertDeliveriesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/alerts';
    static packageType: PackageType = 'package';
    static displayName = 'Alert delivery';
    static displayNamePlural = 'Alert deliveries';

    static writable = { create: [], update: [] };

    private static db(): Db {
        return this.getDriver().getDb() as Db;
    }

    /** In chunks: a row binds every column, and D1 takes at most 100 bound values a statement. */
    static async insertMany(rows: NewDelivery[]): Promise<AlertDeliveryRecord[]> {
        const out: AlertDeliveryRecord[] = [];
        for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
            const chunk = rows.slice(i, i + INSERT_CHUNK);
            out.push(
                ...((await this.db().insert(alertDeliveriesTable).values(chunk).returning()) as AlertDeliveryRecord[]),
            );
        }
        return out;
    }

    static async findFor(appId: string, id: string): Promise<AlertDeliveryRecord | null> {
        const t = alertDeliveriesTable;
        const rows = await this.db()
            .select()
            .from(t)
            .where(and(eq(t.appId, appId), eq(t.id, id)))
            .limit(1);
        return (rows[0] as AlertDeliveryRecord | undefined) ?? null;
    }

    /**
     * Takes a delivery for sending, or answers null when it is not this caller's to send: it is
     * pending, a failure whose retry is due, or a send that died mid-way (claimed long ago,
     * never finished). One UPDATE, so the inline send and a sweep never both send it.
     */
    static async claim(id: string, at: number): Promise<AlertDeliveryRecord | null> {
        const t = alertDeliveriesTable;
        const rows = await this.db()
            .update(t)
            .set({ status: 'sending', attempts: sql`${t.attempts} + 1`, updatedAt: at })
            .where(
                and(
                    eq(t.id, id),
                    or(
                        eq(t.status, 'pending'),
                        and(eq(t.status, 'failed'), lte(t.nextAttemptAt, at)),
                        and(eq(t.status, 'sending'), lte(t.updatedAt, at - SENDING_STALE_MS)),
                    ),
                ),
            )
            .returning();
        return (rows[0] as AlertDeliveryRecord | undefined) ?? null;
    }

    static async markSent(id: string, at: number): Promise<void> {
        const t = alertDeliveriesTable;
        await this.db()
            .update(t)
            .set({ status: 'sent', sentAt: at, lastError: null, nextAttemptAt: null, updatedAt: at })
            .where(eq(t.id, id));
    }

    /** A failed attempt: retried at `retryAt`, or given up (`dead`) when that is null. */
    static async markFailed(id: string, at: number, error: string, retryAt: number | null): Promise<void> {
        const t = alertDeliveriesTable;
        await this.db()
            .update(t)
            .set({
                status: retryAt === null ? 'dead' : 'failed',
                lastError: error.slice(0, MAX_ERROR),
                nextAttemptAt: retryAt,
                updatedAt: at,
            })
            .where(eq(t.id, id));
    }

    /**
     * What a sweep should try now, oldest first: failures whose retry is due, sends that died
     * mid-way, and pending rows the raising request never got to (older than `pendingBefore`,
     * so a sweep does not race a send that is happening right now).
     */
    static async due(appId: string, at: number, pendingBefore: number, limit: number): Promise<string[]> {
        const t = alertDeliveriesTable;
        const rows = await this.db()
            .select({ id: t.id })
            .from(t)
            .where(
                and(
                    eq(t.appId, appId),
                    or(
                        and(eq(t.status, 'failed'), lte(t.nextAttemptAt, at)),
                        and(eq(t.status, 'sending'), lte(t.updatedAt, at - SENDING_STALE_MS)),
                        and(eq(t.status, 'pending'), lte(t.createdAt, pendingBefore)),
                    ),
                ),
            )
            .orderBy(asc(t.createdAt))
            .limit(limit);
        return rows.map((row) => row.id);
    }

    /** Messages a channel sent since `since`: what its hourly cap counts. */
    static async sentSince(channelId: string, since: number): Promise<number> {
        const t = alertDeliveriesTable;
        const rows = await this.db()
            .select({ n: sql<number>`count(*)` })
            .from(t)
            .where(and(eq(t.channelId, channelId), eq(t.status, 'sent'), gt(t.sentAt, since)));
        return Number(rows[0]?.n ?? 0);
    }

    /** Channels with deliveries waiting in `status` (`held` or `digest`). */
    static async channelsWaiting(appId: string, status: 'held' | 'digest'): Promise<string[]> {
        const t = alertDeliveriesTable;
        const rows = await this.db()
            .selectDistinct({ channelId: t.channelId })
            .from(t)
            .where(and(eq(t.appId, appId), eq(t.status, status)));
        return rows.map((row) => row.channelId);
    }

    /**
     * What a channel has waiting in `status` up to `upTo`: the rows themselves (their ids, so the
     * batch that goes out marks exactly these), the alerts to name in the message (the loudest and
     * newest first, at most `limit`), and the oldest raise.
     */
    static async waiting(
        channelId: string,
        status: 'held' | 'digest',
        upTo: number,
        limit: number,
    ): Promise<{ total: number; since: number | null; events: AlertEventRecord[]; ids: string[] }> {
        const d = alertDeliveriesTable;
        const e = alertEventsTable;
        const where = and(eq(d.channelId, channelId), eq(d.status, status), lte(d.createdAt, upTo));
        const db = this.db();
        const rows = await db.select({ id: d.id, createdAt: d.createdAt }).from(d).where(where);
        if (!rows.length) return { total: 0, since: null, events: [], ids: [] };
        const events = await db
            .select({ event: e })
            .from(d)
            .innerJoin(e, eq(e.id, d.eventId))
            .where(where)
            .orderBy(
                sql`CASE ${e.severity} WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END`,
                sql`${e.raisedAt} DESC`,
            )
            .limit(limit);
        return {
            total: rows.length,
            since: Math.min(...rows.map((row) => Number(row.createdAt))),
            events: events.map((row) => row.event as AlertEventRecord),
            ids: rows.map((row) => row.id),
        };
    }

    /** The rows one batch message covered went out. In chunks of ids, for the 100-value limit. */
    static async markBatched(ids: string[], at: number): Promise<number> {
        const t = alertDeliveriesTable;
        let marked = 0;
        for (let i = 0; i < ids.length; i += ID_CHUNK) {
            const rows = await this.db()
                .update(t)
                .set({ status: 'digested', sentAt: at, updatedAt: at })
                .where(inArray(t.id, ids.slice(i, i + ID_CHUNK)))
                .returning({ id: t.id });
            marked += rows.length;
        }
        return marked;
    }

    /** In chunks of ids, for the same 100-value limit; oldest first within each alert. */
    static async forEvents(eventIds: string[]): Promise<AlertDeliveryRecord[]> {
        const t = alertDeliveriesTable;
        const out: AlertDeliveryRecord[] = [];
        for (let i = 0; i < eventIds.length; i += ID_CHUNK) {
            out.push(
                ...((await this.db()
                    .select()
                    .from(t)
                    .where(inArray(t.eventId, eventIds.slice(i, i + ID_CHUNK)))
                    .orderBy(asc(t.createdAt))) as AlertDeliveryRecord[]),
            );
        }
        return out;
    }

    /** A failed or given-up delivery, back in line for a send now. */
    static async requeue(appId: string, id: string, at: number): Promise<AlertDeliveryRecord | null> {
        const t = alertDeliveriesTable;
        const rows = await this.db()
            .update(t)
            .set({ status: 'pending', nextAttemptAt: null, updatedAt: at })
            .where(and(eq(t.appId, appId), eq(t.id, id), inArray(t.status, ['failed', 'dead'])))
            .returning();
        return (rows[0] as AlertDeliveryRecord | undefined) ?? null;
    }

    /** A removed channel's unfinished deliveries give up, so no sweep looks for it again. */
    static async abandonChannel(appId: string, channelId: string, at: number): Promise<number> {
        const t = alertDeliveriesTable;
        const rows = await this.db()
            .update(t)
            .set({ status: 'dead', lastError: 'channel removed', nextAttemptAt: null, updatedAt: at })
            .where(and(eq(t.appId, appId), eq(t.channelId, channelId), inArray(t.status, UNFINISHED)))
            .returning({ id: t.id });
        return rows.length;
    }

    static async countWaiting(appId: string): Promise<number> {
        const t = alertDeliveriesTable;
        const rows = await this.db()
            .select({ n: sql<number>`count(*)` })
            .from(t)
            .where(and(eq(t.appId, appId), inArray(t.status, ['held', 'digest'])));
        return Number(rows[0]?.n ?? 0);
    }

    static async countDeadSince(appId: string, since: number): Promise<number> {
        const t = alertDeliveriesTable;
        const rows = await this.db()
            .select({ n: sql<number>`count(*)` })
            .from(t)
            .where(and(eq(t.appId, appId), eq(t.status, 'dead'), gte(t.updatedAt, since)));
        return Number(rows[0]?.n ?? 0);
    }
}

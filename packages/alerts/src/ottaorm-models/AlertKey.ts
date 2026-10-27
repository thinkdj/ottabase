import { BaseModel, type PackageType } from '@ottabase/ottaorm';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { alertKeysTable } from '../schema';
import type { AlertStatus } from '../types';

type Db = BaseSQLiteDatabase<'async', unknown>;

/** The cooldown's memory: one row per alert key, moved by one upsert. */
export class AlertKey extends BaseModel {
    static entity = 'alert_keys';
    static table = alertKeysTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/alerts';
    static packageType: PackageType = 'package';
    static displayName = 'Alert key';
    static displayNamePlural = 'Alert keys';

    static writable = { create: [], update: [] };

    private static db(): Db {
        return this.getDriver().getDb() as Db;
    }

    /**
     * Records one raise of `key` and answers whether it goes out. It does unless the key's last
     * SENT alert was in the same state less than `cooldownMs` ago; then it is counted as held.
     * A change of state (firing to resolved) always goes out. On a send, `carried` is how many
     * were held since the previous one, for the message to say so.
     *
     * One statement, so two isolates raising the same key cannot both decide to hold the count:
     * SQLite evaluates every SET expression against the row as it was.
     */
    static async touch(
        appId: string,
        key: string,
        status: AlertStatus,
        at: number,
        cooldownMs: number,
    ): Promise<{ send: boolean; carried: number }> {
        const t = alertKeysTable;
        const quiet = sql`(${t.status} = excluded.status AND ${t.lastSentAt} > excluded.last_seen_at - ${cooldownMs})`;
        const rows = await this.db()
            .insert(t)
            .values({ appId, key, status, lastSentAt: at, lastSeenAt: at, held: 0, carried: 0 })
            .onConflictDoUpdate({
                target: [t.appId, t.key],
                set: {
                    carried: sql`CASE WHEN ${quiet} THEN ${t.carried} ELSE ${t.held} END`,
                    held: sql`CASE WHEN ${quiet} THEN ${t.held} + 1 ELSE 0 END`,
                    lastSentAt: sql`CASE WHEN ${quiet} THEN ${t.lastSentAt} ELSE excluded.last_sent_at END`,
                    status: sql`excluded.status`,
                    lastSeenAt: sql`excluded.last_seen_at`,
                },
            })
            .returning({ held: t.held, carried: t.carried });
        const row = rows[0];
        // `held` is zero exactly when this raise went out (a fresh key, a new state, or the
        // cooldown over). Not the timestamp: two raises in the same millisecond share it.
        const send = !row || Number(row.held) === 0;
        return { send, carried: send ? Number(row?.carried ?? 0) : 0 };
    }

    /** Keys unseen since `before` go; a key raised again simply starts over. */
    static async pruneBefore(appId: string, before: number): Promise<number> {
        const t = alertKeysTable;
        const rows = await this.db()
            .delete(t)
            .where(and(eq(t.appId, appId), lt(t.lastSeenAt, before)))
            .returning({ id: t.id });
        return rows.length;
    }
}

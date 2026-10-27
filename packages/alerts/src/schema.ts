import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Where alerts go: a Slack incoming webhook, a Telegram chat, an email list. `secret` is the
 * sealed JSON of whatever grants posting rights (the webhook URL, the bot token, the routing
 * key); it never leaves the server. `hint` is what the console shows instead.
 */
export const alertChannelsTable = sqliteTable(
    'alert_channels',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        appId: text('app_id').notNull(),
        name: text('name').notNull(),
        /** `email`, `slack`, `discord`, `telegram`, `pagerduty` or `webhook`. */
        type: text('type').notNull(),
        /** JSON of the non-secret settings: email recipients, a Telegram chat id. */
        config: text('config').notNull().default('{}'),
        /** `v1.<iv>.<ciphertext>`: AES-GCM over the JSON of the type's secrets. */
        secret: text('secret'),
        /** A recognisable, harmless part of the target (`hooks.slack.com/…/x9Qa`). */
        hint: text('hint'),
        /** `info`, `warning` or `critical`: the quietest severity this channel takes. */
        minSeverity: text('min_severity').notNull().default('info'),
        /** JSON array of `source` or `source:kind` entries; null takes every source. */
        sources: text('sources'),
        /** `immediate`, or `digest` (once a day at `digestHour` UTC). */
        mode: text('mode').notNull().default('immediate'),
        digestHour: integer('digest_hour').notNull().default(8),
        maxPerHour: integer('max_per_hour').notNull().default(30),
        enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
        lastSentAt: integer('last_sent_at'),
        lastError: text('last_error'),
        lastErrorAt: integer('last_error_at'),
        /** Failed sends since the last success. */
        failures: integer('failures').notNull().default(0),
        lastDigestAt: integer('last_digest_at'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        appIdx: index('alert_channels_app_idx').on(table.appId, table.enabled),
    }),
);

/** One alert that was sent on (an alert held back by its cooldown is only counted on its key). */
export const alertEventsTable = sqliteTable(
    'alert_events',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        appId: text('app_id').notNull(),
        key: text('key').notNull(),
        /** The raising package's key (`blackbox`), `errors`, or `external`. */
        source: text('source').notNull(),
        kind: text('kind').notNull(),
        severity: text('severity').notNull(),
        /** `firing` or `resolved`. */
        status: text('status').notNull(),
        title: text('title').notNull(),
        body: text('body'),
        url: text('url'),
        /** JSON `AlertField[]`. */
        fields: text('fields'),
        /** Alerts of the same key and state held back by the cooldown since the last one sent. */
        heldBefore: integer('held_before').notNull().default(0),
        raisedAt: integer('raised_at').notNull(),
    },
    (table) => ({
        raisedIdx: index('alert_events_raised_idx').on(table.appId, table.raisedAt),
        sourceIdx: index('alert_events_source_idx').on(table.appId, table.source, table.raisedAt),
    }),
);

/**
 * One alert to one channel. `pending` → `sending` → `sent`; a failure is `failed` until its
 * retry is due, `dead` once it gives up. `held` waits for the channel's hourly cap, `digest`
 * for its daily digest; both end as `digested`.
 */
export const alertDeliveriesTable = sqliteTable(
    'alert_deliveries',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        appId: text('app_id').notNull(),
        eventId: text('event_id').notNull(),
        /** A channel row id, or `env:email`. */
        channelId: text('channel_id').notNull(),
        status: text('status').notNull(),
        attempts: integer('attempts').notNull().default(0),
        nextAttemptAt: integer('next_attempt_at'),
        lastError: text('last_error'),
        sentAt: integer('sent_at'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        eventIdx: index('alert_deliveries_event_idx').on(table.eventId),
        dueIdx: index('alert_deliveries_due_idx').on(table.appId, table.status, table.nextAttemptAt),
        channelIdx: index('alert_deliveries_channel_idx').on(table.channelId, table.status, table.sentAt),
    }),
);

/**
 * The de-duplication state of one alert key: when it last went out, in which state, and how
 * many repeats the cooldown has held since. One row per key, updated in one statement.
 */
export const alertKeysTable = sqliteTable(
    'alert_keys',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        appId: text('app_id').notNull(),
        key: text('key').notNull(),
        status: text('status').notNull(),
        lastSentAt: integer('last_sent_at').notNull(),
        lastSeenAt: integer('last_seen_at').notNull(),
        /** Repeats held since `lastSentAt`. */
        held: integer('held').notNull().default(0),
        /** Repeats that were held before the latest send: what that send reports. */
        carried: integer('carried').notNull().default(0),
    },
    (table) => ({
        keyIdx: uniqueIndex('alert_keys_key_idx').on(table.appId, table.key),
        seenIdx: index('alert_keys_seen_idx').on(table.appId, table.lastSeenAt),
    }),
);

export type AlertChannelRecord = typeof alertChannelsTable.$inferSelect;
export type AlertEventRecord = typeof alertEventsTable.$inferSelect;
export type AlertDeliveryRecord = typeof alertDeliveriesTable.$inferSelect;
export type AlertKeyRecord = typeof alertKeysTable.$inferSelect;

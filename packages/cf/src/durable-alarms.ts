/**
 * Durable Object alarms, many at once
 * A Durable Object has ONE alarm. Everything that wants timers (a retry in 30s, a reminder
 * tomorrow, a cleanup every hour) ends up multiplexing it by hand. This is that multiplexer:
 * named entries in storage, the real alarm always set to the earliest.
 *
 * ```typescript
 * class Ticket extends DurableObject {
 *     private alarms = new AlarmQueue<{ kind: string }>(this.ctx.storage);
 *     async nudge() { await this.alarms.schedule('sla', Date.now() + 3_600_000, { kind: 'sla' }); }
 *     async alarm() { for (const due of await this.alarms.due()) await this.handle(due); }
 * }
 * ```
 *
 * @see https://developers.cloudflare.com/durable-objects/api/alarms/
 */

export interface AlarmStorage {
    get<T = unknown>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<boolean>;
    getAlarm(): Promise<number | null>;
    setAlarm(scheduledTime: number | Date): Promise<void>;
    deleteAlarm(): Promise<void>;
}

export interface AlarmEntry<P = unknown> {
    id: string;
    /** Epoch ms. */
    at: number;
    payload?: P;
}

export class AlarmQueue<P = unknown> {
    constructor(
        private readonly storage: AlarmStorage,
        private readonly key: string = '__ottabase_alarms',
    ) {}

    // ponytail: all entries live under one key, so every change rewrites the list. Fine for
    // the tens of timers a tenant object holds; shard by id if an object ever holds thousands.
    private async read(): Promise<AlarmEntry<P>[]> {
        return (await this.storage.get<AlarmEntry<P>[]>(this.key)) ?? [];
    }

    private async write(entries: AlarmEntry<P>[]): Promise<void> {
        entries.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
        if (entries.length === 0) {
            await this.storage.delete(this.key);
            await this.storage.deleteAlarm();
            return;
        }
        await this.storage.put(this.key, entries);
        const current = await this.storage.getAlarm();
        if (current !== entries[0].at) await this.storage.setAlarm(entries[0].at);
    }

    /** Add or move a timer. Scheduling an id again replaces its time and payload. */
    async schedule(id: string, at: number | Date, payload?: P): Promise<void> {
        const when = typeof at === 'number' ? at : at.getTime();
        const entries = (await this.read()).filter((entry) => entry.id !== id);
        entries.push(payload === undefined ? { id, at: when } : { id, at: when, payload });
        await this.write(entries);
    }

    async cancel(id: string): Promise<boolean> {
        const entries = await this.read();
        const kept = entries.filter((entry) => entry.id !== id);
        if (kept.length === entries.length) return false;
        await this.write(kept);
        return true;
    }

    async get(id: string): Promise<AlarmEntry<P> | null> {
        return (await this.read()).find((entry) => entry.id === id) ?? null;
    }

    /** Every pending timer, soonest first. */
    list(): Promise<AlarmEntry<P>[]> {
        return this.read();
    }

    /**
     * Call from `alarm()`: removes and returns the entries whose time has come (soonest first)
     * and re-arms the alarm for whatever is left. Re-schedule inside the handler for repeats.
     */
    async due(now: number = Date.now()): Promise<AlarmEntry<P>[]> {
        const entries = await this.read();
        const ready = entries.filter((entry) => entry.at <= now);
        if (ready.length === 0) {
            // Woken early or spuriously: make sure the alarm is armed for the next one.
            if (entries.length > 0) await this.write(entries);
            return [];
        }
        await this.write(entries.filter((entry) => entry.at > now));
        return ready;
    }

    async clear(): Promise<void> {
        await this.write([]);
    }
}

import type { EmailAddress, Mailer, SendEmailInput, SendEmailResult } from '@ottabase/email';
import { EmailSuppression } from './ottaorm-models/EmailSuppression';
import type { SuppressionEntry, SuppressionReason } from './types';

export function normalizeEmail(value: EmailAddress): string {
    const raw = typeof value === 'string' ? value : value.email;
    const match = /<([^>]+)>/.exec(raw);
    return (match ? match[1] : raw).trim().toLowerCase();
}

/** Where suppressions live. The default is the `email_suppressions` model; tests use memory. */
export interface SuppressionStore {
    find(appId: string, addresses: string[], list: string): Promise<SuppressionEntry[]>;
    add(
        appId: string,
        entry: { address: string; list: string; reason: SuppressionReason; source: string | null },
    ): Promise<SuppressionEntry>;
    remove(appId: string, address: string, list: string): Promise<boolean>;
    list(appId: string, options?: { list?: string; limit?: number }): Promise<SuppressionEntry[]>;
}

export function createModelSuppressionStore(): SuppressionStore {
    return {
        async find(appId, addresses, list) {
            if (addresses.length === 0) return [];
            const lists = list === '*' ? ['*'] : ['*', list];
            const rows = (await EmailSuppression.where({
                appId,
                address: { $in: addresses },
                list: { $in: lists },
            })) as EmailSuppression[];
            return rows.map((row) => row.toEntry());
        },
        async add(appId, entry) {
            const existing = (await EmailSuppression.first({
                appId,
                address: entry.address,
                list: entry.list,
            })) as EmailSuppression | null;
            if (existing) return existing.toEntry();
            const row = (await EmailSuppression.create({ appId, ...entry })) as EmailSuppression;
            return row.toEntry();
        },
        async remove(appId, address, list) {
            const existing = (await EmailSuppression.first({ appId, address, list })) as EmailSuppression | null;
            if (!existing) return false;
            return EmailSuppression.delete(String(existing.get('id')));
        },
        async list(appId, options = {}) {
            const where: Record<string, unknown> = { appId };
            if (options.list) where.list = options.list;
            const rows = (await EmailSuppression.where(where, {
                orderBy: 'createdAt',
                orderDirection: 'desc',
                limit: Math.min(options.limit ?? 200, 1000),
            })) as EmailSuppression[];
            return rows.map((row) => row.toEntry());
        },
    };
}

export function createMemorySuppressionStore(): SuppressionStore & { entries: SuppressionEntry[] } {
    const entries: SuppressionEntry[] = [];
    return {
        entries,
        async find(appId, addresses, list) {
            const lists = list === '*' ? ['*'] : ['*', list];
            return entries.filter(
                (entry) =>
                    entry.address &&
                    addresses.includes(entry.address) &&
                    lists.includes(entry.list) &&
                    (entry as { appId?: string }).appId === appId,
            );
        },
        async add(appId, entry) {
            const existing = entries.find(
                (candidate) =>
                    candidate.address === entry.address &&
                    candidate.list === entry.list &&
                    (candidate as { appId?: string }).appId === appId,
            );
            if (existing) return existing;
            const created = {
                id: `s-${entries.length + 1}`,
                createdAt: Date.now(),
                ...entry,
                appId,
            } as SuppressionEntry & { appId: string };
            entries.push(created);
            return created;
        },
        async remove(appId, address, list) {
            const index = entries.findIndex(
                (entry) =>
                    entry.address === address && entry.list === list && (entry as { appId?: string }).appId === appId,
            );
            if (index < 0) return false;
            entries.splice(index, 1);
            return true;
        },
        async list(appId, options = {}) {
            return entries.filter(
                (entry) =>
                    (entry as { appId?: string }).appId === appId && (!options.list || entry.list === options.list),
            );
        },
    };
}

export interface Suppressions {
    /** The suppressed subset of `addresses` for a list (`*` suppressions always apply). */
    check(appId: string, addresses: EmailAddress[], list?: string): Promise<SuppressionEntry[]>;
    isSuppressed(appId: string, address: EmailAddress, list?: string): Promise<boolean>;
    suppress(
        appId: string,
        address: EmailAddress,
        reason: SuppressionReason,
        options?: { list?: string; source?: string | null },
    ): Promise<SuppressionEntry>;
    unsuppress(appId: string, address: EmailAddress, list?: string): Promise<boolean>;
    list(appId: string, options?: { list?: string; limit?: number }): Promise<SuppressionEntry[]>;
    /**
     * A mailer that drops suppressed recipients before sending. When every recipient is
     * suppressed nothing is sent and the result says so (`error: 'SUPPRESSED'`).
     */
    guard(mailer: Mailer, appId: string, list?: string): Mailer;
}

export function createSuppressions(store: SuppressionStore = createModelSuppressionStore()): Suppressions {
    const api: Suppressions = {
        async check(appId, addresses, list = '*') {
            return store.find(appId, [...new Set(addresses.map(normalizeEmail))], list);
        },
        async isSuppressed(appId, address, list = '*') {
            return (await api.check(appId, [address], list)).length > 0;
        },
        suppress(appId, address, reason, options = {}) {
            return store.add(appId, {
                address: normalizeEmail(address),
                list: options.list ?? '*',
                reason,
                source: options.source ?? null,
            });
        },
        unsuppress(appId, address, list = '*') {
            return store.remove(appId, normalizeEmail(address), list);
        },
        list: (appId, options) => store.list(appId, options),
        guard(mailer, appId, list = '*') {
            return {
                provider: mailer.provider,
                async send(input: SendEmailInput): Promise<SendEmailResult> {
                    const recipients = Array.isArray(input.to) ? input.to : [input.to];
                    const suppressed = new Set(
                        (await api.check(appId, recipients, list)).map((entry) => entry.address),
                    );
                    const allowed = recipients.filter((recipient) => !suppressed.has(normalizeEmail(recipient)));
                    if (allowed.length === 0) {
                        return { provider: mailer.provider, success: false, error: 'SUPPRESSED' };
                    }
                    return mailer.send({ ...input, to: allowed.length === 1 ? allowed[0] : allowed });
                },
            };
        },
    };
    return api;
}

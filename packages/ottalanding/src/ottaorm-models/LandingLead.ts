import { BaseModel, type ModelFields } from '@ottabase/ottaorm';
import { LEAD_MIN_FILL_MS, LEAD_RATE_LIMIT, LeadInputSchema, type LeadData, type LeadKind } from '../leads';
import { validated } from './LandingPage';
import { landingLeadsTable } from './landing.schema';

/**
 * What `submit` did. `ignored` (a likely bot, or a repeat signup) looks like success to the
 * visitor, so bots learn nothing; `rate-limited` should be answered with a 429.
 */
export type LeadOutcome = 'stored' | 'ignored' | 'rate-limited';

export class LandingLead extends BaseModel {
    static entity = 'landing_leads';
    static table = landingLeadsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottalanding';
    static packageType = 'package' as const;
    static displayName = 'Form entry';
    static displayNamePlural = 'Form entries';

    static casts = {
        readAt: 'date' as const,
        notifiedAt: 'date' as const,
        createdAt: 'date' as const,
    };

    static writable = {
        create: ['appId', 'kind', 'email', 'name', 'message', 'pagePath', 'ipHash'],
        update: ['readAt', 'notifiedAt'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false },
        appId: { type: 'string', editable: false },
        kind: { type: 'string', editable: false },
        email: { type: 'string', editable: false },
        name: { type: 'string', editable: false },
        message: { type: 'string', editable: false },
        pagePath: { type: 'string', editable: false },
        createdAt: { type: 'number', editable: false },
    };

    /**
     * Take an entry from the public site. Validation errors throw per field (422). Likely bots (the hidden `website` field filled in, or a form sent
     * faster than `LEAD_MIN_FILL_MS`) and repeat signups are accepted but not stored.
     */
    static async submit(appId: string, input: unknown, { ipHash }: { ipHash?: string } = {}): Promise<LeadOutcome> {
        const spam = input as { website?: unknown; elapsedMs?: unknown } | null;
        if (spam?.website || typeof spam?.elapsedMs !== 'number' || spam.elapsedMs < LEAD_MIN_FILL_MS) return 'ignored';
        const lead = validated(LeadInputSchema, input);

        if (ipHash) {
            const since = Date.now() - LEAD_RATE_LIMIT.windowMs;
            if ((await this.count({ appId, ipHash, createdAt: { $gte: since } })) >= LEAD_RATE_LIMIT.max) {
                return 'rate-limited';
            }
        }
        // Someone signing up twice is still on the list once.
        if (lead.kind === 'signup' && (await this.first({ appId, kind: 'signup', email: lead.email })))
            return 'ignored';

        await this.create({ ...lead, appId, ipHash: ipHash ?? null });
        return 'stored';
    }

    /** A page of the inbox, newest first, with totals for the badge and pager. */
    static async inbox(
        appId: string,
        { kind, limit = 50, offset = 0 }: { kind?: LeadKind; limit?: number; offset?: number } = {},
    ): Promise<{ leads: LeadData[]; total: number; unread: number }> {
        const where = { appId, ...(kind ? { kind } : {}) };
        const [rows, total, unread] = await Promise.all([
            this.where(where, { orderBy: 'createdAt', orderDirection: 'desc', limit, offset }) as Promise<
                LandingLead[]
            >,
            this.count(where),
            this.count({ ...where, readAt: null }),
        ]);
        return { leads: rows.map((r) => r.toLead()), total, unread };
    }

    static async setRead(appId: string, id: string, read: boolean): Promise<boolean> {
        const lead = await this.first({ appId, id });
        if (!lead) return false;
        await this.update(id, { readAt: read ? Date.now() : null });
        return true;
    }

    static async deleteFor(appId: string, id: string): Promise<boolean> {
        if (!(await this.first({ appId, id }))) return false;
        await this.delete(id);
        return true;
    }

    /** Entries nobody has been emailed about yet, oldest first. */
    static async pendingNotification(appId: string, limit = 50): Promise<LandingLead[]> {
        return this.where(
            { appId, notifiedAt: null },
            { orderBy: 'createdAt', orderDirection: 'asc', limit },
        ) as Promise<LandingLead[]>;
    }

    static async markNotified(appId: string, ids: string[]): Promise<void> {
        const now = Date.now();
        for (const id of ids) {
            if (await this.first({ appId, id })) await this.update(id, { notifiedAt: now });
        }
    }

    toLead(): LeadData {
        const createdAt = this.get('createdAt') as Date | undefined;
        return {
            id: this.get('id') as string,
            kind: this.get('kind') as LeadKind,
            email: this.get('email') as string,
            name: (this.get('name') as string) ?? '',
            message: (this.get('message') as string) ?? '',
            pagePath: (this.get('pagePath') as string) ?? '/',
            read: Boolean(this.get('readAt')),
            createdAt: createdAt instanceof Date ? createdAt.toISOString() : new Date().toISOString(),
        };
    }
}

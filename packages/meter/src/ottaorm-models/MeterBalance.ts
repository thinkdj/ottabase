import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { meterBalancesTable } from '../schema';

/**
 * The balance row, for the admin Database page and for the generic CRUD allowlist should a
 * host want it there. The money path never goes through the model: `@ottabase/meter`'s
 * `consume()` is one conditional UPDATE, because a read-then-write here would let two
 * requests both take the last credit.
 */
export class MeterBalance extends BaseModel {
    static entity = 'meter_balances';
    static table = meterBalancesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/meter';
    static packageType: PackageType = 'package';
    static displayName = 'Credit Balance';
    static displayNamePlural = 'Credit Balances';
    static defaultSort = 'updatedAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        credits: 'number' as const,
        used: 'number' as const,
        resetCredits: 'number' as const,
        periodStart: 'date' as const,
        periodEnd: 'date' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['appId', 'organizationId', 'userId', 'meter', 'credits', 'periodStart', 'periodEnd', 'resetCredits'],
        update: ['credits', 'periodEnd', 'resetCredits'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        meter: { type: 'string', searchable: true, uiConfig: { label: 'Meter' } },
        organizationId: { type: 'string', editable: false, uiConfig: { label: 'Organization' } },
        userId: { type: 'string', editable: false, uiConfig: { label: 'User' } },
        credits: { type: 'number', uiConfig: { label: 'Credits (empty = unlimited)' } },
        used: { type: 'number', editable: false, uiConfig: { label: 'Used' } },
        periodStart: { type: 'date', editable: false, uiConfig: { label: 'Period start' } },
        periodEnd: { type: 'date', uiConfig: { label: 'Period end' } },
        resetCredits: { type: 'number', uiConfig: { label: 'Credits after reset' } },
        updatedAt: { type: 'date', editable: false, uiConfig: { label: 'Updated' } },
    };
}

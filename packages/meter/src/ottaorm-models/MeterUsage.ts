import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { meterUsageTable } from '../schema';

/** The ledger row. Append-only through `consume()`/`refund()`; never edited. */
export class MeterUsage extends BaseModel {
    static entity = 'meter_usage';
    static table = meterUsageTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/meter';
    static packageType: PackageType = 'package';
    static displayName = 'Credit Usage';
    static displayNamePlural = 'Credit Usage';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        amount: 'number' as const,
        createdAt: 'date' as const,
    };

    static writable = {
        create: ['balanceId', 'appId', 'organizationId', 'userId', 'meter', 'amount', 'ref'],
        update: [] as string[],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        meter: { type: 'string', searchable: true, editable: false, uiConfig: { label: 'Meter' } },
        amount: { type: 'number', editable: false, uiConfig: { label: 'Amount' } },
        ref: { type: 'string', searchable: true, editable: false, uiConfig: { label: 'Reference' } },
        createdAt: { type: 'date', editable: false, uiConfig: { label: 'At' } },
    };
}

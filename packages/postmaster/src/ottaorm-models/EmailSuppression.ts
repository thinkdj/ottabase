import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { emailSuppressionsTable } from '../schema';
import type { SuppressionEntry, SuppressionReason } from '../types';

export class EmailSuppression extends BaseModel {
    static entity = 'email_suppressions';
    static table = emailSuppressionsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/postmaster';
    static packageType: PackageType = 'package';
    static displayName = 'Suppressed Address';
    static displayNamePlural = 'Suppressed Addresses';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        createdAt: 'date' as const,
    };

    static writable = {
        create: ['appId', 'address', 'list', 'reason', 'source'],
        update: ['reason', 'source'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        address: { type: 'string', searchable: true, uiConfig: { label: 'Address' } },
        list: { type: 'string', uiConfig: { label: 'List (* = all)' } },
        reason: { type: 'string', uiConfig: { label: 'Reason' } },
        source: { type: 'string', uiConfig: { label: 'Source' } },
        createdAt: { type: 'date', editable: false, uiConfig: { label: 'Since' } },
    };

    toEntry(): SuppressionEntry {
        const at = this.get('createdAt') as Date | number | null;
        return {
            id: String(this.get('id')),
            address: String(this.get('address')),
            reason: this.get('reason') as SuppressionReason,
            source: (this.get('source') as string | null) ?? null,
            list: String(this.get('list') ?? '*'),
            createdAt: at instanceof Date ? at.getTime() : Number(at ?? 0),
        };
    }
}

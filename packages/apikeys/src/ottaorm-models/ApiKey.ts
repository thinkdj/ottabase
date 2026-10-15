import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { apiKeysTable } from '../schema';
import type { ApiKeyView } from '../types';

export class ApiKey extends BaseModel {
    static entity = 'api_keys';
    static table = apiKeysTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/apikeys';
    static packageType: PackageType = 'package';
    static displayName = 'API Key';
    static displayNamePlural = 'API Keys';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        scopes: 'json' as const,
        lastUsedAt: 'date' as const,
        expiresAt: 'date' as const,
        revokedAt: 'date' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['appId', 'organizationId', 'userId', 'name', 'prefix', 'hash', 'scopes', 'createdBy', 'expiresAt'],
        update: ['name', 'scopes', 'expiresAt', 'revokedAt', 'lastUsedAt'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        name: { type: 'string', searchable: true, uiConfig: { label: 'Name' } },
        prefix: { type: 'string', editable: false, searchable: true, uiConfig: { label: 'Key' } },
        hash: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Hash' },
            formConfig: { fieldType: 'hidden', visible: false },
            tableConfig: { visible: false },
        },
        scopes: { type: 'json', uiConfig: { label: 'Scopes' } },
        organizationId: { type: 'string', editable: false, uiConfig: { label: 'Organization' } },
        userId: { type: 'string', editable: false, uiConfig: { label: 'User' } },
        lastUsedAt: { type: 'date', editable: false, uiConfig: { label: 'Last used' } },
        expiresAt: { type: 'date', uiConfig: { label: 'Expires' } },
        revokedAt: { type: 'date', editable: false, uiConfig: { label: 'Revoked' } },
        createdAt: { type: 'date', editable: false, uiConfig: { label: 'Created' } },
    };

    private static ms(value: unknown): number | null {
        if (value === null || value === undefined) return null;
        return value instanceof Date ? value.getTime() : Number(value);
    }

    toView(): ApiKeyView {
        const organizationId = String(this.get('organizationId') ?? '');
        const userId = String(this.get('userId') ?? '');
        return {
            id: String(this.get('id')),
            name: String(this.get('name')),
            prefix: String(this.get('prefix')),
            scopes: ((this.get('scopes') as string[] | null) ?? []).slice(),
            organizationId: organizationId || null,
            userId: userId || null,
            createdBy: (this.get('createdBy') as string | null) ?? null,
            lastUsedAt: ApiKey.ms(this.get('lastUsedAt')),
            expiresAt: ApiKey.ms(this.get('expiresAt')),
            revokedAt: ApiKey.ms(this.get('revokedAt')),
            createdAt: ApiKey.ms(this.get('createdAt')) ?? 0,
        };
    }
}

import { BaseModel, DomainValidationError, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { flagOverridesTable } from '../schema';
import type { Override, OverrideScope } from '../types';

const KEY_RE = /^(plan|feature:[a-z][a-z0-9._-]*|limit:[a-z][a-z0-9._-]*)$/i;

export function overrideScope(organizationId: string | null, userId: string | null): OverrideScope {
    if (userId) return 'user';
    if (organizationId) return 'organization';
    return 'app';
}

/** Encode a value for the `value` column, refusing anything the resolver would ignore. */
export function encodeOverrideValue(key: string, value: unknown): string {
    if (key === 'plan' && typeof value === 'string' && value.trim()) return JSON.stringify(value.trim());
    if (key.startsWith('feature:') && typeof value === 'boolean') return JSON.stringify(value);
    if (key.startsWith('limit:') && typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
    throw new DomainValidationError('Override value does not fit its key', {
        code: 'INVALID_OVERRIDE',
        fieldErrors: {
            value: [
                `"${key}" takes ${key === 'plan' ? 'a plan key' : key.startsWith('feature:') ? 'true or false' : 'a number'}`,
            ],
        },
    });
}

export class FlagOverride extends BaseModel {
    static entity = 'flag_overrides';
    static table = flagOverridesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/flags';
    static packageType: PackageType = 'package';
    static displayName = 'Flag Override';
    static displayNamePlural = 'Flag Overrides';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        expiresAt: 'date' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['appId', 'organizationId', 'userId', 'scope', 'key', 'value', 'reason', 'createdBy', 'expiresAt'],
        update: ['value', 'reason', 'expiresAt'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        scope: { type: 'string', editable: false, uiConfig: { label: 'Scope' } },
        organizationId: { type: 'string', editable: false, uiConfig: { label: 'Organization' } },
        userId: { type: 'string', editable: false, uiConfig: { label: 'User' } },
        key: { type: 'string', searchable: true, uiConfig: { label: 'Key' } },
        value: { type: 'string', uiConfig: { label: 'Value (JSON)' } },
        reason: { type: 'string', searchable: true, uiConfig: { label: 'Reason' } },
        expiresAt: { type: 'date', uiConfig: { label: 'Expires' } },
        createdAt: { type: 'date', editable: false, uiConfig: { label: 'Created' } },
    };

    static override async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, unknown>,
        driver?: unknown,
    ): Promise<InstanceType<T>> {
        const key = typeof data.key === 'string' ? data.key.trim() : '';
        if (!KEY_RE.test(key)) {
            throw new DomainValidationError('Override key must be "plan", "feature:<id>" or "limit:<id>"', {
                code: 'INVALID_OVERRIDE',
                fieldErrors: { key: ['Use plan, feature:<id> or limit:<id>'] },
            });
        }
        const organizationId = typeof data.organizationId === 'string' ? data.organizationId : null;
        const userId = typeof data.userId === 'string' ? data.userId : null;
        return super.create.call(
            this,
            {
                ...data,
                key,
                organizationId,
                userId,
                scope: overrideScope(organizationId, userId),
                value: encodeOverrideValue(key, data.value),
            },
            driver as never,
        ) as Promise<InstanceType<T>>;
    }

    /** The resolver's view of this row. */
    toOverride(): Override {
        let value: Override['value'] = String(this.get('value'));
        try {
            value = JSON.parse(String(this.get('value'))) as Override['value'];
        } catch {
            /* a hand-edited row; the resolver ignores values that do not fit the key */
        }
        const expires = this.get('expiresAt') as Date | number | null | undefined;
        return {
            id: String(this.get('id')),
            scope: this.get('scope') as OverrideScope,
            key: String(this.get('key')),
            value,
            reason: (this.get('reason') as string | null) ?? null,
            expiresAt: expires instanceof Date ? expires.getTime() : (expires ?? null),
        };
    }
}

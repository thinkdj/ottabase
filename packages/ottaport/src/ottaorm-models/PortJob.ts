// ============================================================
// @ottabase/ottaport - PortJob Model (Fat Model)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { portJobsTable } from '../schema';

export { portJobsTable, type NewPortJobRecord, type PortJobRecord } from '../schema';

/**
 * PortJob model — tracks import/export operations with metadata
 */
export class PortJob extends BaseModel {
    static entity = 'ottaport_jobs';
    static table = portJobsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottaport';
    static packageType: PackageType = 'package';

    // UI metadata
    static displayName = 'Import/Export Job';
    static displayNamePlural = 'Import/Export Jobs';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        createdAt: 'date' as const,
        metadata: 'json' as const,
    };

    static writable = {
        create: [
            'direction',
            'modelEntity',
            'status',
            'format',
            'filename',
            'r2Key',
            'uniqueField',
            'totalRows',
            'totalCreated',
            'totalUpdated',
            'totalFailed',
            'totalSkipped',
            'durationMs',
            'metadata',
            'userId',
            'userEmail',
            'organizationId',
        ],
        update: [
            'status',
            'totalRows',
            'totalCreated',
            'totalUpdated',
            'totalFailed',
            'totalSkipped',
            'durationMs',
            'metadata',
        ],
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        direction: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Direction', description: 'Import or Export' },
            tableConfig: { visible: true },
        },
        modelEntity: {
            type: 'string',
            editable: false,
            filterable: true,
            searchable: true,
            uiConfig: { label: 'Model', description: 'OttaORM model entity name' },
            tableConfig: { visible: true },
        },
        status: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Status' },
            tableConfig: { visible: true },
        },
        format: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Format' },
            tableConfig: { visible: true },
        },
        filename: {
            type: 'string',
            editable: false,
            searchable: true,
            uiConfig: { label: 'Filename' },
            tableConfig: { visible: true },
        },
        r2Key: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'R2 Key' },
            tableConfig: { visible: false },
        },
        uniqueField: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Unique Field' },
            tableConfig: { visible: false },
        },
        totalRows: {
            type: 'number',
            editable: false,
            uiConfig: { label: 'Total Rows' },
            tableConfig: { visible: true },
        },
        totalCreated: {
            type: 'number',
            editable: false,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: true },
        },
        totalUpdated: {
            type: 'number',
            editable: false,
            uiConfig: { label: 'Updated' },
            tableConfig: { visible: true },
        },
        totalFailed: {
            type: 'number',
            editable: false,
            uiConfig: { label: 'Failed' },
            tableConfig: { visible: true },
        },
        totalSkipped: {
            type: 'number',
            editable: false,
            uiConfig: { label: 'Skipped' },
            tableConfig: { visible: false },
        },
        durationMs: {
            type: 'number',
            editable: false,
            uiConfig: { label: 'Duration (ms)' },
            tableConfig: { visible: true },
        },
        metadata: {
            type: 'json',
            editable: false,
            uiConfig: { label: 'Metadata' },
            tableConfig: { visible: false },
        },
        userId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'User ID' },
            tableConfig: { visible: false },
        },
        userEmail: {
            type: 'string',
            editable: false,
            searchable: true,
            uiConfig: { label: 'User Email' },
            tableConfig: { visible: true },
        },
        organizationId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Organization ID' },
            tableConfig: { visible: false },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Created At' },
            tableConfig: { visible: true },
        },
    };

    /** Get metadata as a parsed object */
    getJobMeta(): Record<string, unknown> {
        const meta = this.get('metadata');
        if (typeof meta === 'string') {
            try {
                return JSON.parse(meta);
            } catch {
                return {};
            }
        }
        return meta || {};
    }
}

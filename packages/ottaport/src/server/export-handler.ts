// ============================================================
// @ottabase/ottaport - Export Handler (Server-side)
// ============================================================
// Queries OttaORM models with filters and formats output.
// ============================================================

import { getModel, hasModel } from '@ottabase/ottaorm';
import { formatCsv, formatJson, formatTsv } from '../parsers/csv-parser';
import type { ExportConfig, FileFormat } from '../types';

/**
 * Export data from an OttaORM model with filters, formatted as CSV/JSON/TSV.
 * Returns the formatted string content and suggested filename.
 */
export async function processExport(config: ExportConfig): Promise<{
    content: string;
    filename: string;
    contentType: string;
    totalRows: number;
}> {
    const { modelEntity, format, fields, where, dateRange, search, orderBy, orderDirection } = config;

    if (!hasModel(modelEntity)) {
        throw new Error(`Model '${modelEntity}' not registered in OttaORM`);
    }

    const Model = getModel(modelEntity)!;

    // Build where conditions
    const whereConditions: Record<string, unknown> = { ...where };

    // Fetch records with filters
    let records: InstanceType<typeof import('@ottabase/ottaorm').BaseModel>[];
    const queryOptions: {
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
    } = {};

    if (orderBy) queryOptions.orderBy = orderBy;
    if (orderDirection) queryOptions.orderDirection = orderDirection;

    if (search) {
        // Get searchable fields from model
        const modelFields = (Model as any).getFields?.() ?? {};
        const searchableFields = Object.entries(modelFields)
            .filter(([, desc]: [string, any]) => desc.searchable)
            .map(([key]: [string, any]) => key);

        if (searchableFields.length > 0) {
            records = await Model.search(search, searchableFields, whereConditions, queryOptions);
        } else {
            records = await Model.where(whereConditions, queryOptions);
        }
    } else {
        records = await Model.where(whereConditions, queryOptions);
    }

    // Apply date range filter in-memory (OttaORM stores dates as timestamps)
    if (dateRange?.field && (dateRange.from || dateRange.to)) {
        records = records.filter((r: any) => {
            const val = r.get(dateRange.field);
            if (!val) return false;
            const ts = val instanceof Date ? val.getTime() : Number(val);
            if (dateRange.from && ts < new Date(dateRange.from).getTime()) return false;
            if (dateRange.to && ts > new Date(dateRange.to).getTime()) return false;
            return true;
        });
    }

    // Convert model instances to plain objects
    const plainRecords = records.map((r: any) => {
        if (typeof r.toJSON === 'function') return r.toJSON();
        if (typeof r.getData === 'function') return r.getData();
        return r;
    });

    // Determine fields to export
    const exportFields =
        fields && fields.length > 0 ? fields : plainRecords.length > 0 ? Object.keys(plainRecords[0]) : [];

    // Format output
    const { content, contentType, extension } = formatOutput(plainRecords, exportFields, format);

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${modelEntity}-export-${timestamp}.${extension}`;

    return {
        content,
        filename,
        contentType,
        totalRows: plainRecords.length,
    };
}

/**
 * Format records into the requested format.
 */
function formatOutput(
    records: Record<string, unknown>[],
    fields: string[],
    format: FileFormat,
): { content: string; contentType: string; extension: string } {
    switch (format) {
        case 'json':
            return {
                content: formatJson(records, fields),
                contentType: 'application/json',
                extension: 'json',
            };
        case 'tsv':
            return {
                content: formatTsv(records, fields),
                contentType: 'text/tab-separated-values',
                extension: 'tsv',
            };
        case 'csv':
        default:
            return {
                content: formatCsv(records, fields),
                contentType: 'text/csv',
                extension: 'csv',
            };
    }
}

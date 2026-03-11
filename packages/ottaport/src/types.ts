// ============================================================
// @ottabase/ottaport - Types
// ============================================================

/** Default batch size for chunked imports */
export const DEFAULT_BATCH_SIZE = 50;

/** Supported file formats for import/export */
export type FileFormat = 'csv' | 'json' | 'tsv';

/** Status of an import/export job */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

/** Direction of the operation */
export type JobDirection = 'import' | 'export';

/** A single field mapping from source column to target model field */
export interface FieldMapping {
    /** Column name in the source file */
    sourceColumn: string;
    /** Field name in the target OttaORM model */
    targetField: string;
    /** Whether this field is the unique key for upserts */
    isUniqueKey?: boolean;
}

/** Configuration for an import job */
export interface ImportConfig {
    /** OttaORM model entity name (e.g., 'users', 'shortlinks') */
    modelEntity: string;
    /** Mapping of source columns to model fields */
    fieldMappings: FieldMapping[];
    /** Field to use for upsert matching (e.g., 'email') */
    uniqueField: string;
    /** Batch size for chunked imports (default: 50) */
    batchSize?: number;
    /** Whether to save the uploaded file to R2 for future reference */
    saveToR2?: boolean;
}

/** Result of a single batch operation */
export interface BatchResult {
    batchIndex: number;
    totalInBatch: number;
    created: number;
    updated: number;
    failed: number;
    errors: Array<{ row: number; field?: string; message: string }>;
}

/** Overall result of an import job */
export interface ImportResult {
    status: JobStatus;
    totalRows: number;
    totalCreated: number;
    totalUpdated: number;
    totalFailed: number;
    totalSkipped: number;
    batches: BatchResult[];
    errors: Array<{ row: number; field?: string; message: string }>;
    durationMs: number;
}

/** Configuration for an export job */
export interface ExportConfig {
    /** OttaORM model entity name */
    modelEntity: string;
    /** Output format */
    format: FileFormat;
    /** Fields to include in export (empty = all) */
    fields?: string[];
    /** Where filters */
    where?: Record<string, unknown>;
    /** Date range filter */
    dateRange?: {
        field: string;
        from?: string;
        to?: string;
    };
    /** Search query */
    search?: string;
    /** Order by field */
    orderBy?: string;
    /** Order direction */
    orderDirection?: 'asc' | 'desc';
}

/** Parsed row from a file (before mapping) */
export type ParsedRow = Record<string, string>;

/** Parsed file result */
export interface ParsedFile {
    headers: string[];
    rows: ParsedRow[];
    totalRows: number;
    format: FileFormat;
}

/** Import/export log entry metadata */
export interface PortJobMeta {
    totalRows?: number;
    totalCreated?: number;
    totalUpdated?: number;
    totalFailed?: number;
    totalSkipped?: number;
    filename?: string;
    r2Key?: string;
    format?: FileFormat;
    fields?: string[];
    uniqueField?: string;
    durationMs?: number;
    filters?: Record<string, unknown>;
}

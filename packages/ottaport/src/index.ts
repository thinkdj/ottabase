// ============================================================
// @ottabase/ottaport - Main Exports
// ============================================================
// Data import/export engine for OttaORM models.
// Provides CSV/JSON/TSV parsing, field mapping, bulk upserts,
// and export with filters.
// ============================================================

// Schema & Model
export { PortJob } from './ottaorm-models/PortJob';
export { portJobsTable } from './schema';
export type { NewPortJobRecord, PortJobRecord } from './schema';

// Parsers
export { formatCsv, formatJson, formatTsv, parseCsv, parseFileContent, parseJson } from './parsers/csv-parser';

// Server handlers
export { processExport, processImport } from './server';

// Types
export type {
    BatchResult,
    ExportConfig,
    FieldMapping,
    FileFormat,
    ImportConfig,
    ImportResult,
    JobDirection,
    JobStatus,
    ParsedFile,
    ParsedRow,
    PortJobMeta,
} from './types';

// ============================================================
// @ottabase/ottaport - CSV/TSV Parser
// ============================================================
// Edge-runtime compatible parser — no Node.js-only APIs.
// ============================================================

import type { FileFormat, ParsedFile, ParsedRow } from '../types';

/**
 * Parse a CSV or TSV string into structured data.
 * Handles quoted fields, escaped quotes, and newlines within quotes.
 */
export function parseCsv(content: string, format: FileFormat = 'csv'): ParsedFile {
    const delimiter = format === 'tsv' ? '\t' : ',';
    const rows = parseDelimited(content, delimiter);

    if (rows.length === 0) {
        return { headers: [], rows: [], totalRows: 0, format };
    }

    const headers = rows[0].map((h) => h.trim());
    const dataRows: ParsedRow[] = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // Skip empty rows
        if (row.length === 1 && row[0].trim() === '') continue;

        const record: ParsedRow = {};
        for (let j = 0; j < headers.length; j++) {
            record[headers[j]] = row[j]?.trim() ?? '';
        }
        dataRows.push(record);
    }

    return {
        headers,
        rows: dataRows,
        totalRows: dataRows.length,
        format,
    };
}

/**
 * Parse a JSON string (array of objects) into structured data.
 */
export function parseJson(content: string): ParsedFile {
    const data = JSON.parse(content);
    if (!Array.isArray(data)) {
        throw new Error('JSON content must be an array of objects');
    }
    if (data.length === 0) {
        return { headers: [], rows: [], totalRows: 0, format: 'json' };
    }

    // Collect all unique keys as headers
    const headerSet = new Set<string>();
    for (const obj of data) {
        if (typeof obj === 'object' && obj !== null) {
            Object.keys(obj).forEach((k) => headerSet.add(k));
        }
    }
    const headers = Array.from(headerSet);

    const rows: ParsedRow[] = data.map((obj) => {
        const record: ParsedRow = {};
        for (const h of headers) {
            const val = obj[h];
            record[h] = val === null || val === undefined ? '' : String(val);
        }
        return record;
    });

    return { headers, rows, totalRows: rows.length, format: 'json' };
}

/**
 * Auto-detect format and parse file content.
 */
export function parseFileContent(content: string, format: FileFormat): ParsedFile {
    switch (format) {
        case 'json':
            return parseJson(content);
        case 'tsv':
            return parseCsv(content, 'tsv');
        case 'csv':
        default:
            return parseCsv(content, 'csv');
    }
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * Parse delimited text handling quoted fields.
 * Returns array of rows, each row is array of field values.
 */
function parseDelimited(text: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
        const char = text[i];

        if (inQuotes) {
            if (char === '"') {
                // Check for escaped quote
                if (i + 1 < text.length && text[i + 1] === '"') {
                    currentField += '"';
                    i += 2;
                    continue;
                }
                // End of quoted field
                inQuotes = false;
                i++;
                continue;
            }
            currentField += char;
            i++;
            continue;
        }

        if (char === '"') {
            inQuotes = true;
            i++;
            continue;
        }

        if (char === delimiter) {
            currentRow.push(currentField);
            currentField = '';
            i++;
            continue;
        }

        if (char === '\r') {
            // Handle \r\n
            if (i + 1 < text.length && text[i + 1] === '\n') {
                i++;
            }
            currentRow.push(currentField);
            currentField = '';
            rows.push(currentRow);
            currentRow = [];
            i++;
            continue;
        }

        if (char === '\n') {
            currentRow.push(currentField);
            currentField = '';
            rows.push(currentRow);
            currentRow = [];
            i++;
            continue;
        }

        currentField += char;
        i++;
    }

    // Don't forget last field/row
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }

    return rows;
}

// ============================================================
// Export formatters
// ============================================================

/**
 * Format an array of records as CSV string.
 */
export function formatCsv(records: Record<string, unknown>[], fields: string[]): string {
    const lines: string[] = [];
    // Header row
    lines.push(fields.map(escapeCsvField).join(','));

    for (const record of records) {
        const row = fields.map((f) => {
            const val = record[f];
            return escapeCsvField(val === null || val === undefined ? '' : String(val));
        });
        lines.push(row.join(','));
    }

    return lines.join('\n');
}

/**
 * Format an array of records as TSV string.
 */
export function formatTsv(records: Record<string, unknown>[], fields: string[]): string {
    const lines: string[] = [];
    lines.push(fields.join('\t'));

    for (const record of records) {
        const row = fields.map((f) => {
            const val = record[f];
            const str = val === null || val === undefined ? '' : String(val);
            // TSV: replace tabs and newlines in values
            return str.replace(/[\t\n\r]/g, ' ');
        });
        lines.push(row.join('\t'));
    }

    return lines.join('\n');
}

/**
 * Format an array of records as JSON string.
 */
export function formatJson(records: Record<string, unknown>[], fields?: string[]): string {
    if (!fields || fields.length === 0) {
        return JSON.stringify(records, null, 2);
    }

    const filtered = records.map((r) => {
        const obj: Record<string, unknown> = {};
        for (const f of fields) {
            obj[f] = r[f];
        }
        return obj;
    });
    return JSON.stringify(filtered, null, 2);
}

/** Escape a CSV field value — wraps in quotes if it contains comma, quote, or newline */
function escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
        return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
}

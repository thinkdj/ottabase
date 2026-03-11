# @ottabase/ottaport

Data import/export engine for OttaORM models. Provides CSV/JSON/TSV parsing, field mapping, batched bulk upserts, and
filtered exports.

## Features

- **Import**: Upload CSV/JSON/TSV → map fields to OttaORM model → validate → batched upserts
- **Export**: Select model → apply filters (date range, search, field filters) → download as CSV/JSON/TSV
- **History**: Track all import/export jobs with metadata (row counts, status, user, filename)
- **File Storage**: Optionally save uploaded files to Cloudflare R2 for audit trail

## Installation

```bash
pnpm add @ottabase/ottaport
```

## Usage

### Parsing Files

```typescript
import { parseCsv, parseJson, parseFileContent } from '@ottabase/ottaport';

// Parse CSV
const csvResult = parseCsv('name,email\nAlice,alice@test.com');
// { headers: ['name', 'email'], rows: [{ name: 'Alice', email: 'alice@test.com' }], ... }

// Auto-detect format
const result = parseFileContent(fileContent, 'csv'); // or 'json', 'tsv'
```

### Importing Data (Server-side)

```typescript
import { processImport } from '@ottabase/ottaport/server';

const result = await processImport(parsedRows, {
    modelEntity: 'users',
    fieldMappings: [
        { sourceColumn: 'Full Name', targetField: 'name' },
        { sourceColumn: 'Email Address', targetField: 'email' },
    ],
    uniqueField: 'email', // Upsert based on this field
    batchSize: 50,
});

console.log(result);
// { status: 'completed', totalCreated: 45, totalUpdated: 5, totalFailed: 0, ... }
```

### Exporting Data (Server-side)

```typescript
import { processExport } from '@ottabase/ottaport/server';

const { content, filename, contentType } = await processExport({
    modelEntity: 'users',
    format: 'csv',
    fields: ['name', 'email', 'createdAt'],
    where: { status: 'active' },
    dateRange: { field: 'createdAt', from: '2024-01-01', to: '2024-12-31' },
    orderBy: 'createdAt',
    orderDirection: 'desc',
});
```

### Formatting Output

```typescript
import { formatCsv, formatJson, formatTsv } from '@ottabase/ottaport';

const csv = formatCsv(records, ['name', 'email']);
const json = formatJson(records, ['name', 'email']);
const tsv = formatTsv(records, ['name', 'email']);
```

### Job Tracking (PortJob Model)

```typescript
import { PortJob } from '@ottabase/ottaport';

// Create a job log entry
const job = await PortJob.create({
    direction: 'import',
    modelEntity: 'users',
    status: 'completed',
    format: 'csv',
    filename: 'users-upload.csv',
    totalRows: 100,
    totalCreated: 95,
    totalUpdated: 5,
    userId: 'user-123',
    userEmail: 'admin@example.com',
});

// Query job history
const jobs = await PortJob.where({ direction: 'import' }, { orderBy: 'createdAt', orderDirection: 'desc' });
```

## App Integration

### 1. Add to schema (`ottabase/db/schema.ts`)

```typescript
export { portJobsTable } from '@ottabase/ottaport';
```

### 2. Register model (`worker/lib/db-utils.ts`)

```typescript
import { PortJob } from '@ottabase/ottaport';
// Add to packageModels array
```

### 3. Run migrations

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

## Supported Formats

| Format | Import | Export | MIME Type                 |
| ------ | ------ | ------ | ------------------------- |
| CSV    | ✅     | ✅     | text/csv                  |
| JSON   | ✅     | ✅     | application/json          |
| TSV    | ✅     | ✅     | text/tab-separated-values |

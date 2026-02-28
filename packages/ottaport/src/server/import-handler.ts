// ============================================================
// @ottabase/ottaport - Import Handler (Server-side)
// ============================================================
// Processes file data, validates against model, and performs
// batched bulk upserts using the OttaORM model system.
// ============================================================

import { getModel, hasModel } from '@ottabase/ottaorm';
import type { BatchResult, FieldMapping, ImportConfig, ImportResult, ParsedRow } from '../types';

/**
 * Process imported rows against an OttaORM model with batched upserts.
 *
 * For each row:
 * 1. Map source columns → target model fields using fieldMappings
 * 2. Check if a record with the uniqueField value already exists
 * 3. If exists → update, otherwise → create
 * 4. Collect results per batch
 */
export async function processImport(rows: ParsedRow[], config: ImportConfig): Promise<ImportResult> {
    const startTime = Date.now();
    const { modelEntity, fieldMappings, uniqueField, batchSize = 50 } = config;

    if (!hasModel(modelEntity)) {
        return {
            status: 'failed',
            totalRows: rows.length,
            totalCreated: 0,
            totalUpdated: 0,
            totalFailed: rows.length,
            totalSkipped: 0,
            batches: [],
            errors: [{ row: 0, message: `Model '${modelEntity}' not registered in OttaORM` }],
            durationMs: Date.now() - startTime,
        };
    }

    const Model = getModel(modelEntity)!;
    const batches: BatchResult[] = [];
    const allErrors: ImportResult['errors'] = [];
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    // Process in batches
    for (let batchStart = 0; batchStart < rows.length; batchStart += batchSize) {
        const batchRows = rows.slice(batchStart, batchStart + batchSize);
        const batchIndex = Math.floor(batchStart / batchSize);
        const batchResult: BatchResult = {
            batchIndex,
            totalInBatch: batchRows.length,
            created: 0,
            updated: 0,
            failed: 0,
            errors: [],
        };

        for (let i = 0; i < batchRows.length; i++) {
            const rowIndex = batchStart + i + 1; // 1-based (header is row 0)
            const row = batchRows[i];

            try {
                // Map fields
                const mappedData: Record<string, unknown> = {};
                for (const mapping of fieldMappings) {
                    const value = row[mapping.sourceColumn];
                    if (value !== undefined && value !== '') {
                        mappedData[mapping.targetField] = value;
                    }
                }

                // Ensure unique field has a value
                const uniqueValue = mappedData[uniqueField];
                if (uniqueValue === undefined || uniqueValue === null || uniqueValue === '') {
                    batchResult.failed++;
                    batchResult.errors.push({
                        row: rowIndex,
                        field: uniqueField,
                        message: `Missing required unique field '${uniqueField}'`,
                    });
                    continue;
                }

                // Check if record exists by unique field
                const existing = await Model.first({ [uniqueField]: uniqueValue });

                if (existing) {
                    // Update existing record
                    const id = existing.get(Model.primaryKey);
                    await Model.update(id, mappedData);
                    batchResult.updated++;
                } else {
                    // Create new record
                    await Model.create(mappedData);
                    batchResult.created++;
                }
            } catch (err: unknown) {
                batchResult.failed++;
                const message = err instanceof Error ? err.message : String(err);
                batchResult.errors.push({ row: rowIndex, message });
            }
        }

        totalCreated += batchResult.created;
        totalUpdated += batchResult.updated;
        totalFailed += batchResult.failed;
        allErrors.push(...batchResult.errors);
        batches.push(batchResult);
    }

    const status = totalFailed === 0 ? 'completed' : totalFailed === rows.length ? 'failed' : 'partial';

    return {
        status,
        totalRows: rows.length,
        totalCreated,
        totalUpdated,
        totalFailed,
        totalSkipped,
        batches,
        errors: allErrors,
        durationMs: Date.now() - startTime,
    };
}

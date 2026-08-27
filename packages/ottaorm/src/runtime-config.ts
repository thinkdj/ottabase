/**
 * Runtime safety policy for collection reads.
 *
 * The hard ceiling is deliberately not configurable. A deployment may choose a
 * lower ceiling, but it can never turn `Model.all()` into an unbounded D1 read.
 */
export const OTTAORM_ALL_HARD_LIMIT = 10_000;

const DEFAULT_REQUESTED_MAX_ALL_ROWS = 20_000;

let effectiveMaxAllRows = Math.min(DEFAULT_REQUESTED_MAX_ALL_ROWS, OTTAORM_ALL_HARD_LIMIT);

export interface OttaORMRuntimeConfig {
    /** Value of OTTAORM_MAX_ALL_ROWS from the Worker environment. */
    maxAllRows?: unknown;
}

export class OttaORMAllRowsLimitError extends Error {
    readonly code = 'OTTAORM_ALL_ROWS_LIMIT';
    readonly requested: number;
    readonly maximum: number;

    constructor(requested: number, maximum: number) {
        super(`OttaORM all() would read ${requested} rows, above the configured maximum of ${maximum}`);
        this.name = 'OttaORMAllRowsLimitError';
        this.requested = requested;
        this.maximum = maximum;
    }
}

function parseRequestedMaxAllRows(value: unknown): number {
    // An unset or empty Wrangler variable means “use the safe default”. Any
    // supplied non-empty value must be an exact safe positive integer.
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        return DEFAULT_REQUESTED_MAX_ALL_ROWS;
    }

    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new TypeError('OTTAORM_MAX_ALL_ROWS must be a positive safe integer');
    }

    return parsed;
}

/**
 * Configure OttaORM before a Worker starts using its database connection.
 * Reconfiguration is intentional: test harnesses and isolates can bind a
 * different database/configuration over their lifetime.
 */
export function configureOttaORM(config: OttaORMRuntimeConfig = {}): number {
    const requested = parseRequestedMaxAllRows(config.maxAllRows);
    effectiveMaxAllRows = Math.min(requested, OTTAORM_ALL_HARD_LIMIT);
    return effectiveMaxAllRows;
}

export function getOttaORMMaxAllRows(): number {
    return effectiveMaxAllRows;
}

import type { IndexedSearchDocument } from './types';

export const OTTASEARCH_FTS_TABLE = 'search_documents_fts';

export function collectDocumentText(record: Record<string, unknown>, fields: string[]): string {
    const parts = fields
        .map((field) => record[field])
        .flatMap((value) => {
            if (value === null || value === undefined) return [];
            if (Array.isArray(value)) return value.map((item) => String(item));
            if (typeof value === 'object') return [JSON.stringify(value)];
            return [String(value)];
        })
        .map((part) => part.trim())
        .filter(Boolean);

    return parts.join(' ');
}

export function parseJsonStringArray(value: unknown): string[] {
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
        return [];
    }
}

export function mergeHybridResults(
    ftsResults: IndexedSearchDocument[],
    semanticResults: IndexedSearchDocument[],
): IndexedSearchDocument[] {
    const byId = new Map<string, IndexedSearchDocument>();

    for (const result of ftsResults) {
        byId.set(result.id, { ...result, score: (result.score ?? 0) + 1 });
    }

    for (const result of semanticResults) {
        const existing = byId.get(result.id);
        if (existing) {
            existing.score = (existing.score ?? 0) + (result.score ?? 0.6);
        } else {
            byId.set(result.id, { ...result, score: result.score ?? 0.6 });
        }
    }

    return [...byId.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export async function ensureFtsTable(db: D1DatabaseLike): Promise<void> {
    await db
        .prepare(
            `CREATE VIRTUAL TABLE IF NOT EXISTS ${OTTASEARCH_FTS_TABLE} USING fts5(id UNINDEXED, title, content, keywords)`,
        )
        .run();
}

export interface D1PreparedStatementLike {
    bind(...values: unknown[]): D1PreparedStatementLike;
    run(): Promise<unknown>;
    all<T = unknown>(): Promise<{ results: T[] }>;
    first<T = unknown>(): Promise<T | null>;
}

export interface D1DatabaseLike {
    prepare(query: string): D1PreparedStatementLike;
}

export function normalizeCrudListPayload<T>(payload: unknown): T[] {
    if (Array.isArray(payload)) {
        return payload as T[];
    }

    if (!payload || typeof payload !== 'object') {
        return [];
    }

    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) {
        return record.data as T[];
    }

    if (record.data && typeof record.data === 'object') {
        const nested = record.data as Record<string, unknown>;
        if (Array.isArray(nested.data)) {
            return nested.data as T[];
        }
    }

    return [];
}

export function extractCrudMutationRecord<T>(payload: unknown): T | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const record = payload as Record<string, unknown>;
    if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
        return record.data as T;
    }

    return payload as T;
}

export function extractCrudDetailRecord<T>(payload: unknown): T | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const record = payload as Record<string, unknown>;
    if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
        return record.data as T;
    }

    return payload as T;
}

export function normalizeList<T>(data: unknown): T[] {
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown }).data)) {
        return (data as { data: T[] }).data;
    }
    return [];
}

export function sectionBySlot<T extends { slot: string }>(sections: T[], slot: string): T | undefined {
    return sections.find((s) => s.slot === slot);
}

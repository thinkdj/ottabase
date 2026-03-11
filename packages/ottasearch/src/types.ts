export interface SearchableModelConfig {
    entityName: string;
    enabled: boolean;
    fields: string[];
    lastIndexedAt?: number | null;
}

export interface IndexedSearchDocument {
    id: string;
    entityName: string;
    recordId: string;
    title: string;
    content: string;
    keywords: string[];
    score?: number;
    href?: string;
}

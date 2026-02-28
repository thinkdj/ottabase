export {
    searchDocumentsTable,
    searchableModelsTable,
    type SearchDocumentRecord,
    type SearchableModelRecord,
} from './schema';
export {
    collectDocumentText,
    ensureFtsTable,
    mergeHybridResults,
    OTTASEARCH_FTS_TABLE,
    parseJsonStringArray,
    type D1DatabaseLike,
} from './search';
export type { IndexedSearchDocument, SearchableModelConfig } from './types';

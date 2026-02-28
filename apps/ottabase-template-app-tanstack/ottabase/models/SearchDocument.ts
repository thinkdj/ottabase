import { searchDocumentsTable } from '@ottabase/ottasearch';
import { BaseModel } from '@ottabase/ottaorm';

export class SearchDocument extends BaseModel {
    static entity = 'search_documents';
    static table = searchDocumentsTable;
    static primaryKey = 'id';
}

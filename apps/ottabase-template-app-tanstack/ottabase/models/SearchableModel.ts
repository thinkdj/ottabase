import { searchableModelsTable } from '@ottabase/ottasearch';
import { BaseModel } from '@ottabase/ottaorm';

export class SearchableModel extends BaseModel {
    static entity = 'searchable_models';
    static table = searchableModelsTable;
    static primaryKey = 'entityName';

    static casts = {
        enabled: 'boolean' as const,
    };
}

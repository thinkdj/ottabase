/**
 * PageAction Model
 */
import { BaseModel } from '@ottabase/ottaorm';
import { pageActionsTable } from './PageAction.schema';

export { pageActionsTable, type ActionVariant, type NewPageActionRow, type PageActionRow } from './PageAction.schema';

export class PageAction extends BaseModel {
    static entity = 'page_actions';
    static table = pageActionsTable;
    static primaryKey = 'id';

    static casts = {
        external: 'boolean' as const,
    };

    /**
     * Get all actions for a section
     */
    static async getForSection(sectionId: string): Promise<PageAction[]> {
        return (await this.where({ sectionId }, { orderBy: 'sortOrder', orderDirection: 'asc' })) as PageAction[];
    }
}

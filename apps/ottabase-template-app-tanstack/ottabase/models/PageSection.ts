/**
 * PageSection Model
 */
import { BaseModel } from '@ottabase/ottaorm';
import { pageSectionsTable } from './PageSection.schema';

export { pageSectionsTable, type NewPageSectionRow, type PageSectionRow, type SlotType } from './PageSection.schema';

export class PageSection extends BaseModel {
    static entity = 'page_sections';
    static table = pageSectionsTable;
    static primaryKey = 'id';

    static casts = {
        enabled: 'boolean' as const,
        metadata: 'json' as const,
    };

    /**
     * Get all sections for a page
     */
    static async getForPage(pageId: string): Promise<PageSection[]> {
        return (await this.where({ pageId }, { orderBy: 'sortOrder', orderDirection: 'asc' })) as PageSection[];
    }

    /**
     * Get enabled sections for a page
     */
    static async getEnabledForPage(pageId: string): Promise<PageSection[]> {
        return (await this.where(
            { pageId, enabled: true },
            { orderBy: 'sortOrder', orderDirection: 'asc' },
        )) as PageSection[];
    }
}

/**
 * PageFeature Model
 */
import { BaseModel } from '@ottabase/ottaorm';
import { pageFeaturesTable } from './PageFeature.schema';

export { pageFeaturesTable, type NewPageFeatureRow, type PageFeatureRow } from './PageFeature.schema';

export class PageFeature extends BaseModel {
    static entity = 'page_features';
    static table = pageFeaturesTable;
    static primaryKey = 'id';

    static casts = {
        external: 'boolean' as const,
    };

    /**
     * Get all features for a section
     */
    static async getForSection(sectionId: string): Promise<PageFeature[]> {
        return (await this.where({ sectionId }, { orderBy: 'sortOrder', orderDirection: 'asc' })) as PageFeature[];
    }
}

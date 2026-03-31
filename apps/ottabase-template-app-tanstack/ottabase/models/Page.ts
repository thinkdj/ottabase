/**
 * Page Model
 *
 * OttaORM model for managing pages (landing pages, about, pricing, etc.)
 */
import { BaseModel } from '@ottabase/ottaorm';
import { pagesTable } from './Page.schema';

export { pagesTable, type NewPageRow, type PageRow, type PageStatus, type PageType } from './Page.schema';

export class Page extends BaseModel {
    static entity = 'pages';
    static table = pagesTable;
    static primaryKey = 'id';

    static casts = {
        showInNav: 'boolean' as const,
        variantBySlotJson: 'json' as const,
        metadata: 'json' as const,
    };

    /**
     * Get the homepage (slug = 'homepage')
     */
    static async getHomepage(): Promise<Page | null> {
        const results = await this.where({ slug: 'homepage', status: 'published' });
        return results.length > 0 ? (results[0] as Page) : null;
    }

    /**
     * Get all published pages for navigation
     */
    static async getNavPages(): Promise<Page[]> {
        return (await this.where(
            { showInNav: true, status: 'published' },
            { orderBy: 'navOrder', orderDirection: 'asc' },
        )) as Page[];
    }

    /**
     * Get published page by slug
     */
    static async getBySlug(slug: string): Promise<Page | null> {
        const results = await this.where({ slug, status: 'published' });
        return results.length > 0 ? (results[0] as Page) : null;
    }

    /**
     * Check if this is the homepage
     */
    get isHomepage(): boolean {
        return this.get('slug') === 'homepage';
    }

    /**
     * Get nav label (falls back to title)
     */
    get displayNavLabel(): string {
        return this.get('navLabel') || this.get('title') || '';
    }
}

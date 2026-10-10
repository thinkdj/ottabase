import { BaseModel, DomainValidationError, type ModelFields } from '@ottabase/ottaorm';
import type { z } from 'zod';
import { fieldErrors } from '../fields';
import { parseSections } from '../sections';
import { PageInputSchema, type LandingPageData } from '../site';
import { landingPagesTable } from './landing.schema';

/** Validate with Zod, surfacing failures as the ORM's standard 422 with per-field messages. */
export function validated<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): T {
    const result = schema.safeParse(input);
    if (result.success) return result.data;
    throw new DomainValidationError('Please fix the highlighted fields.', { fieldErrors: fieldErrors(result.error) });
}

export class LandingPage extends BaseModel {
    static entity = 'landing_pages';
    static table = landingPagesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottalanding';
    static packageType = 'package' as const;
    static displayName = 'Landing page';
    static displayNamePlural = 'Landing pages';

    static casts = {
        published: 'boolean' as const,
        sections: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['appId', 'path', 'title', 'description', 'published', 'sections'],
        update: ['path', 'title', 'description', 'published', 'sections'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false },
        appId: { type: 'string', editable: false },
        path: { type: 'string', editable: true },
        title: { type: 'string', editable: true },
        description: { type: 'string', editable: true },
        published: { type: 'boolean', editable: true },
        createdAt: { type: 'number', editable: false },
        updatedAt: { type: 'number', editable: false },
    };

    /** Every page of an app, home first. */
    static async forApp(appId: string): Promise<LandingPage[]> {
        return this.where({ appId }, { orderBy: 'path', orderDirection: 'asc' }) as Promise<LandingPage[]>;
    }

    /** The public read: a published page at `path`, or null. */
    static async findPublished(appId: string, path: string): Promise<LandingPage | null> {
        return (await this.first({ appId, path, published: true })) as LandingPage | null;
    }

    static async findForApp(appId: string, id: string): Promise<LandingPage | null> {
        return (await this.first({ appId, id })) as LandingPage | null;
    }

    static async createFor(appId: string, input: unknown): Promise<LandingPage> {
        const data = validated(PageInputSchema, input);
        await this.assertPathFree(appId, data.path);
        return (await this.create({ ...data, appId })) as LandingPage;
    }

    static async updateFor(appId: string, id: string, input: unknown): Promise<LandingPage | null> {
        const page = await this.findForApp(appId, id);
        if (!page) return null;
        const data = validated(PageInputSchema, input);
        if (data.path !== page.get('path')) await this.assertPathFree(appId, data.path);
        await this.update(id, data);
        return this.findForApp(appId, id);
    }

    /** Deletes a page. The home page stays — without it the site has no front door. */
    static async deleteFor(appId: string, id: string): Promise<boolean> {
        const page = await this.findForApp(appId, id);
        if (!page) return false;
        if (page.get('path') === '/') {
            throw new DomainValidationError('The home page can’t be deleted. Unpublish it instead.', {
                code: 'HOME_PAGE_REQUIRED',
                status: 400,
            });
        }
        await this.delete(id);
        return true;
    }

    private static async assertPathFree(appId: string, path: string): Promise<void> {
        if (await this.first({ appId, path })) {
            throw new DomainValidationError('Another page already uses this path.', {
                code: 'PATH_TAKEN',
                fieldErrors: { path: ['Another page already uses this path.'] },
            });
        }
    }

    /** Plain, validated view for renderers and the admin API. */
    toPage(): LandingPageData {
        const updatedAt = this.get('updatedAt') as Date | undefined;
        return {
            id: this.get('id') as string,
            path: this.get('path') as string,
            title: this.get('title') as string,
            description: (this.get('description') as string) ?? '',
            published: Boolean(this.get('published')),
            sections: parseSections(this.get('sections')),
            updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : undefined,
        };
    }
}

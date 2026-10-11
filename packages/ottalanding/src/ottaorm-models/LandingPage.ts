import { BaseModel, DomainValidationError, type ModelFields } from '@ottabase/ottaorm';
import type { z } from 'zod';
import { fieldErrors, parseLenient } from '../fields';
import { parseSections } from '../sections';
import { SHARE_FIELDS } from '../share-card';
import { PageInputSchema, type LandingPageData } from '../site';
import { landingPagesTable } from './landing.schema';

/** Validate with Zod, surfacing failures as the ORM's standard 422 with per-field messages. */
export function validated<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): T {
    const result = schema.safeParse(input);
    if (result.success) return result.data;
    throw new DomainValidationError('Please fix the highlighted fields.', { fieldErrors: fieldErrors(result.error) });
}

function pathError(message: string, code: string): DomainValidationError {
    return new DomainValidationError(message, { code, fieldErrors: { path: [message] } });
}

/** A concurrent write can still hit the unique (app_id, path) index after the pre-check; report it the same way. */
async function uniquePath<T>(write: () => Promise<T>): Promise<T> {
    try {
        return await write();
    } catch (error) {
        for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
            if (/UNIQUE constraint failed/i.test(String((e as Error).message ?? e))) {
                throw pathError('Another page already uses this path.', 'PATH_TAKEN');
            }
        }
        throw error;
    }
}

/** 24 url-safe characters (144 random bits). */
const PREVIEW_TOKEN = /^[A-Za-z0-9_-]{24}$/;

function newPreviewToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
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
        share: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['appId', 'path', 'title', 'description', 'published', 'sections', 'share'],
        update: ['path', 'title', 'description', 'published', 'sections', 'share', 'previewToken'],
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

    /** Path and last change of every published page, for the sitemap. */
    static async publishedPaths(appId: string): Promise<{ path: string; updatedAt?: Date }[]> {
        const pages = (await this.where(
            { appId, published: true },
            { orderBy: 'path', orderDirection: 'asc' },
        )) as LandingPage[];
        return pages.map((p) => ({ path: p.get('path') as string, updatedAt: p.get('updatedAt') as Date | undefined }));
    }

    /**
     * A page by path for a preview link: the published page, or a draft whose preview token
     * matches. Returns null for a wrong or missing token, exactly like a page that doesn't exist.
     */
    static async findForPreview(appId: string, path: string, token: string): Promise<LandingPage | null> {
        if (!PREVIEW_TOKEN.test(token)) return null;
        return (await this.first({ appId, path, previewToken: token })) as LandingPage | null;
    }

    /** The page's preview token, made on first use; `reset` replaces it, so old links stop working. */
    static async previewTokenFor(appId: string, id: string, reset = false): Promise<string | null> {
        const page = await this.findForApp(appId, id);
        if (!page) return null;
        const current = page.get('previewToken') as string | null;
        if (current && !reset) return current;
        const token = newPreviewToken();
        await this.update(id, { previewToken: token });
        return token;
    }

    static async findForApp(appId: string, id: string): Promise<LandingPage | null> {
        return (await this.first({ appId, id })) as LandingPage | null;
    }

    static async createFor(appId: string, input: unknown): Promise<LandingPage> {
        const data = validated(PageInputSchema, input);
        await this.assertPathFree(appId, data.path);
        return (await uniquePath(() => this.create({ ...data, appId }))) as LandingPage;
    }

    static async updateFor(appId: string, id: string, input: unknown): Promise<LandingPage | null> {
        const page = await this.findForApp(appId, id);
        if (!page) return null;
        const data = validated(PageInputSchema, input);
        if (data.path !== page.get('path')) {
            // The home page is the site's front door: it can be unpublished, never moved.
            if (page.get('path') === '/') throw pathError('The home page always lives at /.', 'HOME_PAGE_REQUIRED');
            await this.assertPathFree(appId, data.path);
        }
        // A page without its own social image stores null, so it goes back to using the site's.
        await uniquePath(() => this.update(id, { ...data, share: data.share ?? null }));
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
        if (await this.first({ appId, path })) throw pathError('Another page already uses this path.', 'PATH_TAKEN');
    }

    /** Plain, validated view for renderers and the admin API. */
    toPage(): LandingPageData {
        const updatedAt = this.get('updatedAt') as Date | undefined;
        const share = this.get('share');
        return {
            id: this.get('id') as string,
            path: this.get('path') as string,
            title: this.get('title') as string,
            description: (this.get('description') as string) ?? '',
            published: Boolean(this.get('published')),
            ...(share && typeof share === 'object' ? { share: parseLenient(SHARE_FIELDS, share, {}) } : {}),
            sections: parseSections(this.get('sections')),
            updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : undefined,
        };
    }
}

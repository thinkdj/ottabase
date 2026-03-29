// ============================================================
// ChangelogEntry Model (App-specific fat model)
// ============================================================

import type { DbDriver } from '@ottabase/db/drizzle';
import { calculateReadingTime, generateSlug, type EditorJSData } from '@ottabase/ottablog';
import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { changelogEntriesTable, type ChangelogEditorContent } from './ChangelogEntry.schema';

export {
    changelogEntriesTable,
    type ChangelogEditorContent,
    type ChangelogEntryRow,
    type ChangelogHeroMedia,
    type NewChangelogEntryRow,
} from './ChangelogEntry.schema';

export type ChangelogEntryStatus = 'draft' | 'published' | 'archived';

/**
 * Product changelog entry with OttaEditor JSON body and optional hero image/video.
 */
export class ChangelogEntry extends BaseModel {
    static entity = 'changelog_entries';
    static table = changelogEntriesTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        content: 'json' as const,
        heroMedia: 'json' as const,
        highlight: 'boolean' as const,
        autoplayMedia: 'boolean' as const,
        showAuthor: 'boolean' as const,
        readingTimeMinutes: 'number' as const,
        wordCount: 'number' as const,
        publishedAt: 'date' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        status: 'draft' satisfies ChangelogEntryStatus,
    };

    static writable = {
        create: [
            'title',
            'slug',
            'summary',
            'content',
            'heroMedia',
            'highlight',
            'autoplayMedia',
            'showAuthor',
            'status',
            'authorId',
            'authorName',
            'authorAvatar',
            'readingTimeMinutes',
            'wordCount',
            'publishedAt',
            'appId',
            'organizationId',
            'userId',
        ],
        update: [
            'title',
            'slug',
            'summary',
            'content',
            'heroMedia',
            'highlight',
            'autoplayMedia',
            'showAuthor',
            'status',
            'authorId',
            'authorName',
            'authorAvatar',
            'readingTimeMinutes',
            'wordCount',
            'publishedAt',
            'appId',
            'organizationId',
            'userId',
        ],
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        title: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Title',
                placeholder: 'Release title',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
            validation: {
                rules: 'required|min:3|max:200',
                messages: { required: 'Title is required' },
            },
        },
        slug: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: { label: 'Slug', description: 'URL segment for this entry' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 200 },
        },
        summary: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Excerpt', description: 'Short teaser for the listing' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: true, colWidth: 'auto' },
        },
        content: {
            type: 'json',
            editable: true,
            uiConfig: { label: 'Body', description: 'OttaEditor / EditorJS output' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        heroMedia: {
            type: 'json',
            editable: true,
            uiConfig: { label: 'Hero media', description: 'Image or video for the listing' },
            tableConfig: { visible: false },
        },
        status: {
            type: 'string',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: { label: 'Status' },
            formConfig: { visible: true, fieldType: 'select' },
            tableConfig: { visible: true, colWidth: 120 },
        },
        authorId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Author ID' },
            tableConfig: { visible: false },
        },
        authorName: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Author name' },
            tableConfig: { visible: true, colWidth: 160 },
        },
        authorAvatar: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Author avatar URL' },
            tableConfig: { visible: false },
        },
        readingTimeMinutes: {
            type: 'number',
            editable: false,
            uiConfig: { label: 'Reading time (min)' },
            tableConfig: { visible: true, colWidth: 100 },
        },
        wordCount: {
            type: 'number',
            editable: false,
            uiConfig: { label: 'Word count' },
            tableConfig: { visible: false },
        },
        publishedAt: {
            type: 'date',
            editable: true,
            sortable: true,
            uiConfig: { label: 'Published' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        appId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: { label: 'App ID' },
            tableConfig: { visible: false },
        },
        organizationId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Organization' },
            tableConfig: { visible: false },
        },
        userId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Owner user' },
            tableConfig: { visible: false },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: false },
        },
        highlight: {
            type: 'boolean',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Highlight', description: 'Feature this entry' },
            formConfig: { visible: true, fieldType: 'checkbox' },
            tableConfig: { visible: true, colWidth: 100 },
        },
        autoplayMedia: {
            type: 'boolean',
            editable: true,
            uiConfig: { label: 'Autoplay media', description: 'Autoplay animated images and videos' },
            formConfig: { visible: true, fieldType: 'checkbox' },
            tableConfig: { visible: false },
        },
        showAuthor: {
            type: 'boolean',
            editable: true,
            uiConfig: { label: 'Show author', description: 'Display author information publicly' },
            formConfig: { visible: true, fieldType: 'checkbox' },
            tableConfig: { visible: false },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Updated' },
            tableConfig: { visible: false },
        },
    };

    protected static validationRules = {
        title: {
            rules: 'required',
            fieldName: 'Title',
            messages: { required: 'Title is required' },
        },
    };

    /** Recompute reading stats from EditorJS content */
    updateReadingStats() {
        const content = this.get('content') as ChangelogEditorContent | null;
        if (!content?.blocks?.length) {
            // No readable content — clear any previously stored stats
            this.set('readingTimeMinutes', null);
            this.set('wordCount', null);
            return;
        }
        const readingTime = calculateReadingTime(content as EditorJSData);
        this.set('readingTimeMinutes', readingTime.minutes);
        this.set('wordCount', readingTime.words);
    }

    generateSlugFromTitle() {
        const title = this.get('title') as string;
        if (title && !this.get('slug')) {
            this.set('slug', generateSlug(title));
        }
    }

    async publish() {
        const now = Date.now();
        this.set('status', 'published');
        this.set('publishedAt', this.get('publishedAt') || now);
        return this.save();
    }

    async unpublish() {
        this.set('status', 'draft');
        return this.save();
    }

    /** Published entries for public listing (newest first) */
    static async publishedForListing(options?: { appId?: string | null; limit?: number; offset?: number }) {
        const where: Record<string, unknown> = { status: 'published' };
        if (options?.appId !== undefined && options?.appId !== null) {
            where.appId = options.appId;
        }
        return this.where(where, {
            orderBy: 'publishedAt',
            orderDirection: 'desc',
            limit: options?.limit,
            offset: options?.offset,
        });
    }

    static async findPublishedBySlug(slug: string, appId?: string | null) {
        const where: Record<string, unknown> = { slug, status: 'published' };
        if (appId !== undefined && appId !== null) {
            where.appId = appId;
        }
        return this.first(where);
    }

    /** Ensure slug and reading stats before persisting */
    async save(driver?: DbDriver): Promise<this> {
        this.generateSlugFromTitle();
        this.updateReadingStats();
        return super.save(driver);
    }
}

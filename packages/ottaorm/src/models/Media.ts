// ============================================================
// @ottabase/ottaorm - Media Model
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';
import { mediaTable, type MediaType } from './Media.schema';

export { mediaTable, type MediaType, type MediaVariantInfo, type NewMediaType } from './Media.schema';

/**
 * Media model — Fat Model Pattern
 *
 * One row per stored file. Rows are written only by the files service (`createFiles` in
 * `@ottabase/ottaupload`, through `mediaFileStore` below): generic CRUD may read them and
 * nothing else, because a row created or deleted anywhere else would point at the wrong
 * object or orphan one. Views (with `url`, `thumbnailUrl`, `previewUrl`) come from the
 * service's `view()`, which knows the public domain.
 *
 * @example
 * ```typescript
 * import { Media } from "@ottabase/ottaorm";
 *
 * // The current user's media-library images
 * const images = await Media.where({ purpose: "media", mediaKind: "image", userId: currentUser.id });
 * ```
 */
export class Media extends BaseModel {
    static entity = 'media';
    static table = mediaTable;
    static primaryKey = 'id';
    static packageType: PackageType = 'core';
    /** Read-only in CrudHub: a row deleted here would orphan its R2 object; the files service owns writes. */
    static admin = {
        enabled: true,
        scope: 'org' as const,
        readOnly: true,
        relations: ['owner:id{name,image}'],
        description: 'Every uploaded file and its metadata.',
    };
    static displayName = 'Media';
    static displayNamePlural = 'Media';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        fileSize: 'number' as const,
        width: 'number' as const,
        height: 'number' as const,
        variants: 'json' as const,
        metadata: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    // Rows come from the files service; a person may change only the text that describes a file.
    static writable = {
        create: [] as string[],
        update: ['title', 'altText', 'caption'],
    };

    protected static defaults = {
        status: 'ready',
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
                description: 'Display title for this media item',
                placeholder: 'Homepage hero image',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
        },
        originalName: {
            type: 'string',
            editable: false,
            searchable: true,
            sortable: true,
            uiConfig: { label: 'Original Name' },
            tableConfig: { visible: true, colWidth: 'auto' },
        },
        purpose: {
            type: 'string',
            editable: false,
            filterable: true,
            sortable: true,
            uiConfig: { label: 'Purpose' },
            tableConfig: { visible: true, colWidth: 120 },
        },
        audience: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Audience', description: 'public, members or owner' },
            tableConfig: { visible: true, colWidth: 110 },
        },
        mediaKind: {
            type: 'string',
            editable: false,
            filterable: true,
            sortable: true,
            uiConfig: { label: 'Kind' },
            tableConfig: { visible: true, colWidth: 110 },
        },
        mimeType: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'MIME Type' },
            tableConfig: { visible: false },
        },
        fileSize: {
            type: 'number',
            editable: false,
            sortable: true,
            uiConfig: { label: 'File Size' },
            tableConfig: { visible: true, colWidth: 120 },
        },
        width: {
            type: 'number',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Width' },
            tableConfig: { visible: false },
        },
        height: {
            type: 'number',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Height' },
            tableConfig: { visible: false },
        },
        storageKey: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Storage Key' },
            tableConfig: { visible: false },
        },
        extension: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Extension' },
            tableConfig: { visible: false },
        },
        altText: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Alt Text', description: 'Accessibility description' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        caption: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Caption', description: 'Optional caption shown in renderers' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        status: {
            type: 'string',
            editable: false,
            filterable: true,
            sortable: true,
            uiConfig: { label: 'Status', description: 'ready, or quarantined (never served)' },
            tableConfig: { visible: true, colWidth: 120 },
        },
        variants: {
            type: 'json',
            editable: false,
            uiConfig: { label: 'Variants' },
            formConfig: { visible: false, fieldType: 'json' },
            tableConfig: { visible: false },
        },
        metadata: {
            type: 'json',
            editable: false,
            uiConfig: { label: 'Metadata' },
            formConfig: { visible: false, fieldType: 'json' },
            tableConfig: { visible: false },
        },
        userId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'User ID' },
            tableConfig: { visible: false },
        },
        organizationId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Organization ID' },
            tableConfig: { visible: false },
        },
        appId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'App ID' },
            tableConfig: { visible: false },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Updated' },
            tableConfig: { visible: false },
        },
    };

    async owner(select?: string[]) {
        const { User } = await import('./User');
        return this.belongsTo(User as any, 'userId', {
            select: select || ['id', 'name', 'email', 'image'],
        });
    }

    isImage(): boolean {
        return this.get('mediaKind') === 'image';
    }

    isVideo(): boolean {
        return this.get('mediaKind') === 'video';
    }

    isPreviewable(): boolean {
        return ['image', 'video', 'audio', 'document'].includes((this.get('mediaKind') as string) || '');
    }
}

/** A row as the files service reads it: the shape `FileRecord` in `@ottabase/ottaupload` describes. */
export type MediaRecord = Omit<MediaType, 'audience' | 'status'> & {
    audience: 'public' | 'members' | 'owner';
    status: 'ready' | 'quarantined';
};

const toRecord = (media: Media | null): MediaRecord | null => (media ? (media.toJson() as MediaRecord) : null);

/**
 * The files service's store (`FileStore` in `@ottabase/ottaupload`), backed by this model.
 * `createFiles({ store: mediaFileStore, ... })` is the only writer of media rows.
 */
export const mediaFileStore = {
    async insert(record: MediaRecord): Promise<void> {
        await Media.create(record as unknown as Record<string, unknown>);
    },
    async get(id: string): Promise<MediaRecord | null> {
        return toRecord(await Media.find(id));
    },
    async update(
        id: string,
        fields: Partial<Pick<MediaRecord, 'title' | 'altText' | 'caption' | 'status'>>,
    ): Promise<MediaRecord | null> {
        if (!(await Media.find(id))) return null;
        return toRecord(await Media.update(id, fields));
    },
    async delete(id: string): Promise<void> {
        await Media.delete(id);
    },
    /** One SUM: the organization's files, or the user's own when there is no organization. */
    async usedBytes(owner: { appId: string; userId: string | null; organizationId: string | null }): Promise<number> {
        const where = owner.organizationId
            ? { appId: owner.appId, organizationId: owner.organizationId }
            : { appId: owner.appId, organizationId: null, userId: owner.userId };
        return (await Media.sums(['fileSize'], where)).fileSize ?? 0;
    },
    async uploadedBy(appId: string, userId: string, limit: number): Promise<MediaRecord[]> {
        const rows = await Media.where({ appId, userId }, { limit, orderBy: 'createdAt', orderDirection: 'asc' });
        return rows.map((row) => row.toJson() as MediaRecord);
    },
};

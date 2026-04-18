// ============================================================
// @ottabase/ottaorm - Media Model
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';
import { mediaTable } from './Media.schema';

export { mediaTable, type MediaType, type NewMediaType } from './Media.schema';

/**
 * Media model — Fat Model Pattern
 *
 * Core model for tracking all uploaded files (images, videos, audio, documents).
 *
 * @example
 * ```typescript
 * import { Media } from "@ottabase/ottaorm";
 *
 * // List images for current user
 * const images = await Media.where({ mediaKind: "image", userId: currentUser.id });
 *
 * // Create record after upload
 * const media = await Media.create({
 *   provider: "r2",
 *   storageKey: "abc123/photo.jpg",
 *   url: "https://cdn.example.com/abc123/photo.jpg",
 *   originalName: "photo.jpg",
 *   mimeType: "image/jpeg",
 *   fileSize: 204800,
 * });
 * ```
 */
export class Media extends BaseModel {
    static entity = 'media';
    static table = mediaTable;
    static primaryKey = 'id';
    static packageType: PackageType = 'core';
    static displayName = 'Media';
    static displayNamePlural = 'Media';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        fileSize: 'number' as const,
        width: 'number' as const,
        height: 'number' as const,
        isPublic: 'boolean' as const,
        variants: 'json' as const,
        metadata: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
        deletedAt: 'date' as const,
    };

    static writable = {
        create: [
            'provider',
            'storageKey',
            'url',
            'thumbnailUrl',
            'previewUrl',
            'mimeType',
            'mediaKind',
            'status',
            'originalName',
            'title',
            'altText',
            'caption',
            'extension',
            'fileSize',
            'width',
            'height',
            'isPublic',
            'variants',
            'metadata',
            'appId',
            'organizationId',
            'userId',
            'deletedAt',
        ],
        update: ['title', 'altText', 'caption', 'status', 'isPublic', 'variants', 'metadata', 'deletedAt'],
    };

    protected static defaults = {
        status: 'active',
        isPublic: false,
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
        mediaKind: {
            type: 'string',
            editable: false,
            filterable: true,
            sortable: true,
            uiConfig: { label: 'Kind' },
            tableConfig: { visible: true, colWidth: 110 },
        },
        provider: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Provider' },
            tableConfig: { visible: false },
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
        url: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'URL' },
            tableConfig: { visible: false },
        },
        thumbnailUrl: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Thumbnail URL' },
            tableConfig: { visible: false },
        },
        previewUrl: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Preview URL' },
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
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: { label: 'Status' },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: [
                    { id: 'active', name: 'Active' },
                    { id: 'archived', name: 'Archived' },
                ],
            },
            tableConfig: { visible: true, colWidth: 120 },
        },
        isPublic: {
            type: 'boolean',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Public' },
            formConfig: { visible: true, fieldType: 'boolean' },
            tableConfig: { visible: false },
        },
        variants: {
            type: 'json',
            editable: true,
            uiConfig: { label: 'Variants' },
            formConfig: { visible: false, fieldType: 'json' },
            tableConfig: { visible: false },
        },
        metadata: {
            type: 'json',
            editable: true,
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
        deletedAt: {
            type: 'date',
            editable: false,
            uiConfig: { label: 'Deleted' },
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

    async archive() {
        this.set('status', 'archived');
        return this.save();
    }

    async restore() {
        this.set('status', 'active');
        return this.save();
    }
}

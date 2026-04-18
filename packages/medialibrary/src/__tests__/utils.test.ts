import { describe, expect, it } from 'vitest';
import {
    createMediaLibraryRecordInput,
    formatMediaFileSize,
    getMediaKindFromMimeType,
    toMediaSelectionPayload,
} from '../utils';

describe('@ottabase/medialibrary utils', () => {
    it('classifies common media types', () => {
        expect(getMediaKindFromMimeType('image/png', 'cover.png')).toBe('image');
        expect(getMediaKindFromMimeType('video/mp4', 'clip.mp4')).toBe('video');
        expect(getMediaKindFromMimeType('audio/mpeg', 'track.mp3')).toBe('audio');
        expect(getMediaKindFromMimeType('application/pdf', 'guide.pdf')).toBe('document');
        expect(getMediaKindFromMimeType('application/zip', 'bundle.zip')).toBe('archive');
    });

    it('builds a media-library record from upload metadata', () => {
        const record = createMediaLibraryRecordInput({
            provider: 'r2',
            storageKey: 'uploads/hero.png',
            url: '/api/upload/file/uploads/hero.png',
            fileName: 'hero.png',
            mimeType: 'image/png',
            fileSize: 2048,
            appId: 'app-1',
            userId: 'user-1',
        });

        expect(record.mediaKind).toBe('image');
        expect(record.title).toBe('hero.png');
        expect(record.thumbnailUrl).toBe(record.url);
        expect(record.previewUrl).toBe(record.url);
        expect(record.appId).toBe('app-1');
        expect(record.userId).toBe('user-1');
    });

    it('creates a rich selection payload for editor integrations', () => {
        const payload = toMediaSelectionPayload({
            id: 'media-1',
            url: '/uploads/photo.webp',
            thumbnailUrl: '/uploads/photo-thumb.webp',
            previewUrl: '/uploads/photo-preview.webp',
            originalName: 'photo.webp',
            title: 'Homepage photo',
            altText: 'People collaborating',
            caption: 'Captured during the spring launch',
            mimeType: 'image/webp',
            mediaKind: 'image',
            width: 1920,
            height: 1080,
        });

        expect(payload.mediaId).toBe('media-1');
        expect(payload.name).toBe('photo.webp');
        expect(payload.title).toBe('Homepage photo');
        expect(payload.alt).toBe('People collaborating');
        expect(payload.width).toBe(1920);
        expect(payload.thumbnailUrl).toBe('/uploads/photo-thumb.webp');
    });

    it('formats file sizes for UI display', () => {
        expect(formatMediaFileSize(0)).toBe('0 B');
        expect(formatMediaFileSize(1024)).toBe('1.0 KB');
        expect(formatMediaFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });
});

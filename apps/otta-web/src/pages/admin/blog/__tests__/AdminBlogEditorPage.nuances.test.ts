/**
 * Blog editor nuance tests
 *
 * Tests for slug check only when changed, version delete warning, save disabled when not dirty.
 */

import { describe, expect, it } from 'vitest';

// Slug availability: run check only when slug has changed from initial
function shouldRunSlugCheck(currentSlug: string, initialSlug: string): boolean {
    return currentSlug.trim() !== (initialSlug ?? '').trim();
}

// Version history: show "X versions would be deleted" when current count > keep count
function versionsWouldBeDeleted(
    versionsLength: number,
    maxVersionsToKeep: number | null,
    isEditMode: boolean,
): { show: boolean; count: number } {
    if (!isEditMode || maxVersionsToKeep == null || maxVersionsToKeep <= 0 || versionsLength <= maxVersionsToKeep) {
        return { show: false, count: 0 };
    }
    return { show: true, count: versionsLength - maxVersionsToKeep };
}

// Save button: disabled when saving or (edit mode and not dirty)
function isSaveDisabled(isSaving: boolean, isEditMode: boolean, isDirty: boolean): boolean {
    return isSaving || (isEditMode && !isDirty);
}

describe('AdminBlogEditorPage nuances', () => {
    describe('hero image mapping', () => {
        function mapPickerPayloadToHeroImage(
            payload: {
                url: string;
                name?: string;
                alt?: string;
                caption?: string;
                mediaId?: string;
                width?: number;
                height?: number;
            },
            currentAlt?: string,
            currentCfImageId?: string,
        ) {
            return {
                url: payload.url,
                alt: payload.alt || currentAlt || payload.name || '',
                caption: payload.caption,
                mediaId: payload.mediaId,
                width: payload.width,
                height: payload.height,
                cfImageId: currentCfImageId,
            };
        }

        function mapUploadResponseToHeroImage(
            response: { url?: string; cfImageId?: string },
            fileName: string,
            currentAlt?: string,
            currentCaption?: string,
        ) {
            if (!response.url) return null;
            return {
                url: response.url,
                alt: currentAlt || fileName,
                caption: currentCaption,
                cfImageId: response.cfImageId,
            };
        }

        it('should prefer picker alt text, then current alt, then media name', () => {
            const fromPickerAlt = mapPickerPayloadToHeroImage(
                { url: 'https://img.test/1.jpg', alt: 'Library alt', name: 'fallback-name' },
                'Current alt',
            );
            expect(fromPickerAlt.alt).toBe('Library alt');

            const fromCurrentAlt = mapPickerPayloadToHeroImage(
                { url: 'https://img.test/2.jpg', name: 'fallback-name' },
                'Current alt',
            );
            expect(fromCurrentAlt.alt).toBe('Current alt');

            const fromName = mapPickerPayloadToHeroImage({ url: 'https://img.test/3.jpg', name: 'fallback-name' });
            expect(fromName.alt).toBe('fallback-name');
        });

        it('should map upload response to hero image and preserve caption', () => {
            const mapped = mapUploadResponseToHeroImage(
                { url: 'https://img.test/uploaded.jpg', cfImageId: 'cf-123' },
                'photo.png',
                '',
                'Existing caption',
            );

            expect(mapped).toEqual({
                url: 'https://img.test/uploaded.jpg',
                alt: 'photo.png',
                caption: 'Existing caption',
                cfImageId: 'cf-123',
            });
        });

        it('should return null when upload response has no url', () => {
            expect(mapUploadResponseToHeroImage({}, 'photo.png')).toBeNull();
        });
    });

    describe('slug availability check (only when slug changed)', () => {
        it('should run check when slug has changed from initial', () => {
            expect(shouldRunSlugCheck('new-slug', 'old-slug')).toBe(true);
            expect(shouldRunSlugCheck('different', '')).toBe(true);
            expect(shouldRunSlugCheck('  trimmed  ', 'trimmed')).toBe(false);
        });

        it('should not run check when slug equals initial', () => {
            expect(shouldRunSlugCheck('same-slug', 'same-slug')).toBe(false);
            expect(shouldRunSlugCheck('', '')).toBe(false);
            expect(shouldRunSlugCheck('', '')).toBe(false);
        });

        it('should not run check when slug is only whitespace and initial is empty', () => {
            expect(shouldRunSlugCheck('  ', '')).toBe(false);
        });

        it('should run check when slug trimmed differs from initial', () => {
            expect(shouldRunSlugCheck('  new  ', 'old')).toBe(true);
        });
    });

    describe('version history "would be deleted" warning', () => {
        it('should show warning when versions in DB exceed keep count', () => {
            expect(versionsWouldBeDeleted(8, 3, true)).toEqual({ show: true, count: 5 });
            expect(versionsWouldBeDeleted(10, 1, true)).toEqual({ show: true, count: 9 });
        });

        it('should not show when versions <= keep count', () => {
            expect(versionsWouldBeDeleted(3, 5, true)).toEqual({ show: false, count: 0 });
            expect(versionsWouldBeDeleted(5, 5, true)).toEqual({ show: false, count: 0 });
        });

        it('should not show when not in edit mode', () => {
            expect(versionsWouldBeDeleted(8, 3, false)).toEqual({ show: false, count: 0 });
        });

        it('should not show when maxVersionsToKeep is null or 0', () => {
            expect(versionsWouldBeDeleted(8, null, true)).toEqual({ show: false, count: 0 });
            expect(versionsWouldBeDeleted(8, 0, true)).toEqual({ show: false, count: 0 });
        });
    });

    describe('save button disabled state', () => {
        it('should be disabled when saving', () => {
            expect(isSaveDisabled(true, true, true)).toBe(true);
            expect(isSaveDisabled(true, false, true)).toBe(true);
        });

        it('should be disabled in edit mode when not dirty', () => {
            expect(isSaveDisabled(false, true, false)).toBe(true);
        });

        it('should be enabled in edit mode when dirty', () => {
            expect(isSaveDisabled(false, true, true)).toBe(false);
        });

        it('should be enabled for new post when dirty (create mode)', () => {
            expect(isSaveDisabled(false, false, true)).toBe(false);
        });
    });

    describe('junction-filter pagination (in-memory when tag/category filter active)', () => {
        // Simulates the pagination logic from handleBlogPostsList
        function paginateFiltered(
            allPostIds: string[],
            junctionPostIds: string[] | null,
            page: number,
            perPage: number,
        ) {
            if (junctionPostIds === null) {
                // No junction filter — standard paginate
                const total = allPostIds.length;
                const totalPages = Math.ceil(total / perPage);
                const paged = allPostIds.slice((page - 1) * perPage, page * perPage);
                return { data: paged, page, perPage, total, totalPages };
            }
            const junctionSet = new Set(junctionPostIds);
            const filtered = allPostIds.filter((id) => junctionSet.has(id));
            const total = filtered.length;
            const totalPages = Math.ceil(total / perPage);
            const paged = filtered.slice((page - 1) * perPage, page * perPage);
            return { data: paged, page, perPage, total, totalPages };
        }

        it('should return correct total when filtering by junction IDs', () => {
            const allPosts = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            const tagPosts = ['b', 'd', 'f'];
            const result = paginateFiltered(allPosts, tagPosts, 1, 10);
            expect(result.total).toBe(3);
            expect(result.totalPages).toBe(1);
            expect(result.data).toEqual(['b', 'd', 'f']);
        });

        it('should paginate junction-filtered results correctly across pages', () => {
            const allPosts = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            const tagPosts = ['a', 'b', 'c', 'd', 'e'];
            const p1 = paginateFiltered(allPosts, tagPosts, 1, 2);
            expect(p1.data).toEqual(['a', 'b']);
            expect(p1.total).toBe(5);
            expect(p1.totalPages).toBe(3);

            const p2 = paginateFiltered(allPosts, tagPosts, 2, 2);
            expect(p2.data).toEqual(['c', 'd']);

            const p3 = paginateFiltered(allPosts, tagPosts, 3, 2);
            expect(p3.data).toEqual(['e']);
        });

        it('should pass through without filtering when junction IDs are null', () => {
            const allPosts = ['a', 'b', 'c'];
            const result = paginateFiltered(allPosts, null, 1, 10);
            expect(result.total).toBe(3);
            expect(result.data).toEqual(['a', 'b', 'c']);
        });

        it('should return empty when junction filter matches nothing', () => {
            const allPosts = ['a', 'b', 'c'];
            const tagPosts = ['x', 'y'];
            const result = paginateFiltered(allPosts, tagPosts, 1, 10);
            expect(result.total).toBe(0);
            expect(result.data).toEqual([]);
        });
    });
});

// ---------------------------------------------------------------------------
// useEditorLeaveGuard — shouldWarnOnLeave logic
// ---------------------------------------------------------------------------

/**
 * Mirror of the shouldWarnOnLeave computation used in editor pages.
 * Edit mode: warn when isDirty. New mode: warn when title typed or any
 * editor has unsaved changes.
 */
function computeShouldWarn({
    isEditMode,
    isDirty,
    title,
    editorDirty,
}: {
    isEditMode: boolean;
    isDirty: boolean;
    title: string;
    editorDirty: boolean;
}): boolean {
    if (isEditMode) return isDirty;
    return title.trim() !== '' || editorDirty;
}

describe('useEditorLeaveGuard — shouldWarnOnLeave', () => {
    describe('edit mode', () => {
        it('warns when form is dirty', () => {
            expect(computeShouldWarn({ isEditMode: true, isDirty: true, title: '', editorDirty: false })).toBe(true);
        });

        it('does not warn when clean', () => {
            expect(computeShouldWarn({ isEditMode: true, isDirty: false, title: '', editorDirty: false })).toBe(false);
        });

        it('does not warn even if editor has changes once isDirty is false', () => {
            // isDirty already incorporates editorDirty — editorDirty is redundant in edit mode
            expect(computeShouldWarn({ isEditMode: true, isDirty: false, title: 'My Title', editorDirty: true })).toBe(
                false,
            );
        });
    });

    describe('new mode', () => {
        it('does not warn on a blank form', () => {
            expect(computeShouldWarn({ isEditMode: false, isDirty: false, title: '', editorDirty: false })).toBe(false);
        });

        it('warns when title has been typed', () => {
            expect(computeShouldWarn({ isEditMode: false, isDirty: false, title: 'Draft', editorDirty: false })).toBe(
                true,
            );
        });

        it('does not warn when title is only whitespace', () => {
            expect(computeShouldWarn({ isEditMode: false, isDirty: false, title: '   ', editorDirty: false })).toBe(
                false,
            );
        });

        it('warns when editor has unsaved changes even though title is empty', () => {
            expect(computeShouldWarn({ isEditMode: false, isDirty: false, title: '', editorDirty: true })).toBe(true);
        });
    });

    describe('allowNavigateRef one-shot bypass', () => {
        /**
         * Mirrors the shouldBlockFn logic:
         * - if allowNavigateRef is true, reset it and return false (allow)
         * - otherwise return shouldWarn
         */
        function shouldBlock(allowRef: { current: boolean }, shouldWarn: boolean): boolean {
            if (allowRef.current) {
                allowRef.current = false;
                return false;
            }
            return shouldWarn;
        }

        it('bypasses the block when allowNavigateRef is true (post-save redirect)', () => {
            const ref = { current: true };
            expect(shouldBlock(ref, true)).toBe(false);
        });

        it('resets allowNavigateRef after the one-shot bypass', () => {
            const ref = { current: true };
            shouldBlock(ref, true);
            expect(ref.current).toBe(false);
        });

        it('blocks normally after the one-shot is consumed', () => {
            const ref = { current: true };
            shouldBlock(ref, true); // consume
            expect(shouldBlock(ref, true)).toBe(true); // next navigation is blocked again
        });

        it('blocks when allowNavigateRef is false and shouldWarn is true', () => {
            const ref = { current: false };
            expect(shouldBlock(ref, true)).toBe(true);
        });

        it('does not block when allowNavigateRef is false and shouldWarn is false', () => {
            const ref = { current: false };
            expect(shouldBlock(ref, false)).toBe(false);
        });
    });
});

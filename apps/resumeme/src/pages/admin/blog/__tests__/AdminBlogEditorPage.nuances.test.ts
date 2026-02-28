/**
 * Blog editor nuance tests
 *
 * Tests for slug check only when changed, version delete warning, save disabled when not dirty.
 */

import { describe, it, expect } from 'vitest';

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
});

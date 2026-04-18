// ---------------------------------------------------------------------------
// @ottabase/ottalayout – CSS Utility Helpers
//
// Pure functions that map LayoutConfig values to Tailwind CSS class strings.
// Used by layout components to translate config into styles.
// ---------------------------------------------------------------------------

import type { ContainerPadding, ContentWidth, Density, SidebarWidth } from './types';

/** Returns a Tailwind max-width class for the given content width strategy. */
export function contentWidthClass(contentWidth: ContentWidth): string {
    switch (contentWidth) {
        case 'xs':
            return 'max-w-xl'; // 576px
        case 'sm':
            return 'max-w-3xl'; // 768px
        case 'md':
        case 'fixed':
            return 'max-w-5xl'; // 1024px
        case 'lg':
        case 'fluid':
            return 'max-w-7xl'; // 1280px
        case 'xl':
            return 'max-w-[1536px]'; // 1536px
        case 'full':
            return 'w-full';
        default:
            return 'max-w-5xl';
    }
}

/**
 * Returns a Tailwind vertical padding class for the given UI density.
 */
export function densityPadding(density: Density): string {
    switch (density) {
        case 'compact':
            return 'py-4';
        case 'comfy':
            return 'py-10';
        case 'spacious':
            return 'py-16';
        default:
            return 'py-10';
    }
}

/**
 * Returns a Tailwind width class for the sidebar.
 */
export function sidebarWidthClass(width: SidebarWidth = 'standard'): string {
    switch (width) {
        case 'narrow':
            return 'w-48'; // 192px
        case 'standard':
            return 'w-64'; // 256px
        case 'wide':
            return 'w-80'; // 320px
        default:
            return 'w-64';
    }
}

/**
 * Returns a Tailwind horizontal padding class for the container.
 */
export function containerPaddingClass(padding: ContainerPadding = 'md'): string {
    switch (padding) {
        case 'none':
            return 'px-0';
        case 'sm':
            return 'px-2';
        case 'md':
            return 'px-4';
        case 'lg':
            return 'px-8';
        default:
            return 'px-4';
    }
}

import type { LayoutConfig } from '@ottabase/brand-engine';

export function contentWidthClass(contentWidth: LayoutConfig['contentWidth']): string {
    switch (contentWidth) {
        case 'fixed':
            return 'max-w-5xl';
        case 'fluid':
            return 'max-w-7xl';
        case 'full':
            return 'w-full';
        default:
            return 'max-w-5xl';
    }
}

export function densityPadding(density: LayoutConfig['density']): string {
    return density === 'compact' ? 'py-4' : 'py-10';
}

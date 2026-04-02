/**
 * Marketing Pages Admin Constants
 *
 * Shared constants for the drag-and-drop Marketing Pages builder.
 */

import {
    Code2,
    Contact,
    FileText,
    Grid3X3,
    ImageIcon,
    LayoutList,
    Megaphone,
    Navigation,
    Quote,
    Rows3,
    Sparkles,
    Users,
    Video,
    type LucideIcon,
} from 'lucide-react';

// ── Section Slot Types ──────────────────────────────────────────────────────

export interface SlotConfig {
    id: string;
    label: string;
    icon: LucideIcon;
    description: string;
    supportsFeatures: boolean;
    supportsActions: boolean;
    defaultVariant: string;
}

/**
 * Block types for the Marketing Pages drag-and-drop builder.
 * Organized by category for the block palette.
 */
export const BLOCK_TYPES: SlotConfig[] = [
    // Navigation
    {
        id: 'navbar',
        label: 'Navigation Bar',
        icon: Navigation,
        description: 'Site navigation with logo and links',
        supportsFeatures: false,
        supportsActions: true,
        defaultVariant: 'default',
    },
    // Hero Sections
    {
        id: 'hero',
        label: 'Hero Section',
        icon: Sparkles,
        description: 'Bold headline with call-to-action buttons',
        supportsFeatures: false,
        supportsActions: true,
        defaultVariant: 'centered',
    },
    // Content Blocks
    {
        id: 'features',
        label: 'Features Grid',
        icon: Grid3X3,
        description: 'Showcase product features in a grid layout',
        supportsFeatures: true,
        supportsActions: false,
        defaultVariant: 'grid',
    },
    {
        id: 'cta',
        label: 'Call to Action',
        icon: Megaphone,
        description: 'Prominent section with action buttons',
        supportsFeatures: false,
        supportsActions: true,
        defaultVariant: 'default',
    },
    {
        id: 'about',
        label: 'About / Content',
        icon: FileText,
        description: 'Rich text content with optional features',
        supportsFeatures: true,
        supportsActions: true,
        defaultVariant: 'default',
    },
    {
        id: 'testimonials',
        label: 'Testimonials',
        icon: Quote,
        description: 'Customer reviews and testimonials',
        supportsFeatures: true,
        supportsActions: false,
        defaultVariant: 'carousel',
    },
    {
        id: 'gallery',
        label: 'Image Gallery',
        icon: ImageIcon,
        description: 'Visual showcase of images',
        supportsFeatures: true,
        supportsActions: false,
        defaultVariant: 'grid',
    },
    {
        id: 'team',
        label: 'Team Members',
        icon: Users,
        description: 'Display team member profiles',
        supportsFeatures: true,
        supportsActions: false,
        defaultVariant: 'grid',
    },
    {
        id: 'pricing',
        label: 'Pricing Table',
        icon: LayoutList,
        description: 'Product or service pricing plans',
        supportsFeatures: true,
        supportsActions: true,
        defaultVariant: 'cards',
    },
    {
        id: 'faq',
        label: 'FAQ Section',
        icon: Contact,
        description: 'Frequently asked questions',
        supportsFeatures: true,
        supportsActions: false,
        defaultVariant: 'accordion',
    },
    {
        id: 'video',
        label: 'Video Section',
        icon: Video,
        description: 'Embedded video with text',
        supportsFeatures: false,
        supportsActions: true,
        defaultVariant: 'default',
    },
    {
        id: 'code',
        label: 'Code Block',
        icon: Code2,
        description: 'Code snippet with syntax highlighting',
        supportsFeatures: false,
        supportsActions: false,
        defaultVariant: 'default',
    },
    {
        id: 'custom',
        label: 'Custom Block',
        icon: FileText,
        description: 'Flexible block for any content',
        supportsFeatures: true,
        supportsActions: true,
        defaultVariant: 'default',
    },
    // Footer
    {
        id: 'footer',
        label: 'Footer',
        icon: Rows3,
        description: 'Page footer with links and info',
        supportsFeatures: false,
        supportsActions: true,
        defaultVariant: 'default',
    },
];

// Legacy alias for backward compatibility
export const SLOT_TYPES = BLOCK_TYPES;

// Helper to get slot config by id
export function getSlotConfig(slotId: string): SlotConfig | undefined {
    return BLOCK_TYPES.find((s) => s.id === slotId);
}

// Block type variants (different layouts/styles for each block type)
export const BLOCK_VARIANTS: Record<string, { value: string; label: string }[]> = {
    hero: [
        { value: 'centered', label: 'Centered' },
        { value: 'split', label: 'Split (Image Right)' },
        { value: 'split-reverse', label: 'Split (Image Left)' },
        { value: 'fullscreen', label: 'Fullscreen' },
        { value: 'video-bg', label: 'Video Background' },
    ],
    features: [
        { value: 'grid', label: 'Grid (3 cols)' },
        { value: 'grid-2', label: 'Grid (2 cols)' },
        { value: 'grid-4', label: 'Grid (4 cols)' },
        { value: 'list', label: 'List' },
        { value: 'cards', label: 'Cards' },
        { value: 'alternating', label: 'Alternating' },
    ],
    cta: [
        { value: 'default', label: 'Default' },
        { value: 'banner', label: 'Banner' },
        { value: 'gradient', label: 'Gradient' },
        { value: 'minimal', label: 'Minimal' },
    ],
    testimonials: [
        { value: 'carousel', label: 'Carousel' },
        { value: 'grid', label: 'Grid' },
        { value: 'single', label: 'Single Quote' },
        { value: 'masonry', label: 'Masonry' },
    ],
    gallery: [
        { value: 'grid', label: 'Grid' },
        { value: 'masonry', label: 'Masonry' },
        { value: 'carousel', label: 'Carousel' },
        { value: 'lightbox', label: 'Lightbox' },
    ],
    team: [
        { value: 'grid', label: 'Grid' },
        { value: 'cards', label: 'Cards' },
        { value: 'list', label: 'List' },
    ],
    pricing: [
        { value: 'cards', label: 'Cards' },
        { value: 'table', label: 'Table' },
        { value: 'comparison', label: 'Comparison' },
    ],
    faq: [
        { value: 'accordion', label: 'Accordion' },
        { value: 'list', label: 'List' },
        { value: 'two-column', label: 'Two Column' },
    ],
    navbar: [
        { value: 'default', label: 'Default' },
        { value: 'centered', label: 'Centered Logo' },
        { value: 'transparent', label: 'Transparent' },
    ],
    footer: [
        { value: 'default', label: 'Default' },
        { value: 'minimal', label: 'Minimal' },
        { value: 'detailed', label: 'Multi-Column' },
    ],
    about: [
        { value: 'default', label: 'Default' },
        { value: 'with-image', label: 'With Image' },
        { value: 'stats', label: 'With Stats' },
    ],
    video: [
        { value: 'default', label: 'Default' },
        { value: 'fullwidth', label: 'Full Width' },
        { value: 'with-text', label: 'With Text' },
    ],
    code: [
        { value: 'default', label: 'Default' },
        { value: 'with-tabs', label: 'With Tabs' },
    ],
    custom: [
        { value: 'default', label: 'Default' },
        { value: 'card', label: 'Card' },
        { value: 'full-width', label: 'Full Width' },
    ],
};

// Get variants for a block type
export function getBlockVariants(blockId: string): { value: string; label: string }[] {
    return BLOCK_VARIANTS[blockId] || [{ value: 'default', label: 'Default' }];
}

// ── Theme Presets ───────────────────────────────────────────────────────────

export const THEME_PRESETS = [
    { id: 'default', label: 'Default', description: 'Clean and minimal' },
    { id: 'neo', label: 'Neo', description: 'Modern and bold' },
    { id: 'retro', label: 'Retro', description: 'Vintage vibes' },
    { id: 'pastel', label: 'Pastel', description: 'Soft and gentle' },
    { id: 'monochrome', label: 'Monochrome', description: 'Black and white' },
    { id: 'gradient', label: 'Gradient', description: 'Colorful gradients' },
    { id: 'glass', label: 'Glass', description: 'Glassmorphism style' },
    { id: 'brutalist', label: 'Brutalist', description: 'Raw and bold' },
] as const;

// ── Action Variants ─────────────────────────────────────────────────────────

export const ACTION_VARIANTS = [
    { value: 'default', label: 'Primary' },
    { value: 'secondary', label: 'Secondary' },
    { value: 'outline', label: 'Outline' },
    { value: 'ghost', label: 'Ghost' },
    { value: 'link', label: 'Link' },
    { value: 'destructive', label: 'Destructive' },
] as const;

// ── Page Status Options ─────────────────────────────────────────────────────

export const PAGE_STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft', description: 'Not visible to public' },
    { value: 'published', label: 'Published', description: 'Visible to public' },
    { value: 'archived', label: 'Archived', description: 'Hidden but preserved' },
] as const;

// ── Page Type Options ───────────────────────────────────────────────────────

export const PAGE_TYPE_OPTIONS = [
    { value: 'block', label: 'Block', description: 'Section-based page builder' },
    { value: 'content', label: 'Content', description: 'Rich text from CMS' },
] as const;

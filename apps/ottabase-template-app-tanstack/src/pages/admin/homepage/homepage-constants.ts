/**
 * Homepage Admin Constants
 *
 * Single source of truth for slot names, labels, variant metadata,
 * action button variants, and theme presets used across all homepage admin pages.
 *
 * Mirrors SLOT_NAMES and SLOT_REGISTRY from the Next.js homepage-config.ts.
 */

/** All homepage slot names — matches SLOT_NAMES on the Next.js side. */
export const SLOT_NAMES = ['navbar', 'hero', 'features', 'cta', 'footer', 'about'] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

/** Human-readable labels for each slot. */
export const SLOT_LABELS: Record<SlotName, string> = {
    navbar: 'Navigation Bar',
    hero: 'Hero Section',
    features: 'Features Section',
    cta: 'Call-to-Action',
    footer: 'Footer',
    about: 'About Page',
};

/** Short descriptions for each slot. */
export const SLOT_DESCRIPTIONS: Record<SlotName, string> = {
    navbar: 'Site navigation, logo, and links displayed at the top of every page.',
    hero: 'Primary headline, subtitle, and call-to-action buttons above the fold.',
    features: 'Product capabilities displayed as a grid, cards, or list.',
    cta: 'Conversion-focused section with headline, description, and action buttons.',
    footer: 'Site-wide footer with branding, links, and copyright.',
    about: 'Detailed overview page with features, tech stack, and team info.',
};

/** Lucide icon names for each slot (used in admin UI badges). */
export const SLOT_ICONS: Record<SlotName, string> = {
    navbar: 'Navigation',
    hero: 'Sparkles',
    features: 'Grid3X3',
    cta: 'Megaphone',
    footer: 'Rows3',
    about: 'FileText',
};

/** Available button style variants (matches shadcn Button component). */
export const ACTION_VARIANTS = [
    { value: 'default', label: 'Default' },
    { value: 'secondary', label: 'Secondary' },
    { value: 'outline', label: 'Outline' },
    { value: 'ghost', label: 'Ghost' },
] as const;

/** Available theme presets for the homepage. */
export const THEME_PRESETS = [
    { id: 'default', label: 'Default', description: 'Clean and professional' },
    { id: 'neo', label: 'Neo', description: 'Bold modern aesthetic' },
    { id: 'crisp', label: 'Crisp', description: 'Sharp minimal look' },
    { id: 'warm', label: 'Warm', description: 'Friendly earthy tones' },
    { id: 'midnight', label: 'Midnight', description: 'Dark dramatic style' },
    { id: 'ocean', label: 'Ocean', description: 'Cool aquatic palette' },
    { id: 'forest', label: 'Forest', description: 'Natural green hues' },
    { id: 'sunset', label: 'Sunset', description: 'Warm gradient feel' },
] as const;

/** Variant option for a slot's display mode. */
export interface SlotVariantOption {
    id: string;
    label: string;
    desc: string;
}

/** Full slot configuration including available variants. */
export interface SlotConfig {
    label: string;
    variants: readonly SlotVariantOption[];
    default: string;
}

/**
 * Slot configuration registry — maps each slot to its available
 * variant options and default selection. Mirrors SLOT_REGISTRY on the
 * Next.js side (homepage-config.ts).
 */
export const SLOT_CONFIG: Record<SlotName, SlotConfig> = {
    navbar: {
        label: 'Navigation Bar',
        variants: [
            { id: 'default', label: 'Default', desc: 'Logo left, links right, mobile hamburger.' },
            { id: 'centered', label: 'Centered', desc: 'Logo and links centered.' },
            { id: 'minimal', label: 'Minimal', desc: 'Logo and dark-mode toggle only.' },
        ],
        default: 'default',
    },
    hero: {
        label: 'Hero Section',
        variants: [
            { id: 'centered', label: 'Centered', desc: 'Large centered headline with buttons.' },
            { id: 'split', label: 'Split', desc: 'Text left, visual right.' },
            { id: 'minimal', label: 'Minimal', desc: 'Compact headline.' },
        ],
        default: 'centered',
    },
    features: {
        label: 'Features Section',
        variants: [
            { id: 'grid', label: 'Grid', desc: 'Two-column bordered list.' },
            { id: 'cards', label: 'Cards', desc: 'Card layout with hover effects.' },
            { id: 'list', label: 'List', desc: 'Vertical stacked list.' },
        ],
        default: 'grid',
    },
    cta: {
        label: 'Call-to-Action',
        variants: [
            { id: 'default', label: 'Default', desc: 'Centered text with buttons.' },
            { id: 'banner', label: 'Banner', desc: 'Full-width colored banner.' },
            { id: 'minimal', label: 'Minimal', desc: 'Compact inline CTA.' },
        ],
        default: 'default',
    },
    footer: {
        label: 'Footer',
        variants: [
            { id: 'default', label: 'Default', desc: 'Copyright and links row.' },
            { id: 'minimal', label: 'Minimal', desc: 'Single-line copyright.' },
            { id: 'columns', label: 'Columns', desc: 'Multi-column grouped links.' },
        ],
        default: 'default',
    },
    about: {
        label: 'About Page',
        variants: [
            { id: 'default', label: 'Default', desc: 'Full content with features, steps, CTA.' },
            { id: 'minimal', label: 'Minimal', desc: 'Concise single-section.' },
            { id: 'detailed', label: 'Detailed', desc: 'Card-based with tech-stack badges.' },
        ],
        default: 'default',
    },
};

/** Returns the default variant selection for all slots. */
export function getDefaultVariantBySlot(): Record<string, string> {
    const d: Record<string, string> = {};
    for (const [k, v] of Object.entries(SLOT_CONFIG)) {
        d[k] = v.default;
    }
    return d;
}

/** Common lucide icon suggestions for features and actions. */
export const ICON_SUGGESTIONS = [
    'Zap', 'Shield', 'Globe', 'Sparkles', 'Rocket', 'Heart', 'Star',
    'ArrowRight', 'Github', 'Code', 'Database', 'Cloud', 'Lock', 'Users',
    'Settings', 'Palette', 'Layout', 'Layers', 'Package', 'Terminal',
    'BookOpen', 'FileText', 'Image', 'Video', 'Music', 'Mail',
    'Phone', 'MapPin', 'Calendar', 'Clock', 'CheckCircle', 'AlertCircle',
] as const;

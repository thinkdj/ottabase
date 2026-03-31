import type { HomepageSlotName } from './schemas';

/** Describes a single selectable variant inside a slot (matches Next.js `SLOT_REGISTRY`). */
export type HomepageVariantMeta = {
    id: string;
    label: string;
    description: string;
};

/** Per-slot registry entry: label, default variant id, and variant options. */
export type HomepageSlotRegistryEntry = {
    label: string;
    defaultVariant: string;
    variants: HomepageVariantMeta[];
};

/**
 * Authoritative variant ids per slot for admin UI and API validation.
 * Keep in sync with `apps/ottabase-template-app-nextjs-homepage/lib/homepage-config.ts` `SLOT_REGISTRY`.
 */
export const homepageSlotVariantRegistry: Record<HomepageSlotName, HomepageSlotRegistryEntry> = {
    navbar: {
        label: 'Navigation Bar',
        defaultVariant: 'default',
        variants: [
            { id: 'default', label: 'Default', description: 'Logo left, links right, mobile hamburger menu.' },
            { id: 'centered', label: 'Centered', description: 'Logo and links centered with balanced layout.' },
            { id: 'minimal', label: 'Minimal', description: 'Logo and dark-mode toggle only — no nav links.' },
        ],
    },
    hero: {
        label: 'Hero Section',
        defaultVariant: 'centered',
        variants: [
            { id: 'centered', label: 'Centered', description: 'Large centered headline with action buttons.' },
            { id: 'split', label: 'Split', description: 'Text on the left, decorative visual on the right.' },
            { id: 'minimal', label: 'Minimal', description: 'Compact headline with subtle styling.' },
        ],
    },
    features: {
        label: 'Features Section',
        defaultVariant: 'grid',
        variants: [
            { id: 'grid', label: 'Grid', description: 'Two-column bordered list of features.' },
            { id: 'cards', label: 'Cards', description: 'Card-based layout with hover effects.' },
            { id: 'list', label: 'List', description: 'Vertical stacked list with alternating accents.' },
        ],
    },
    cta: {
        label: 'Call-to-Action',
        defaultVariant: 'default',
        variants: [
            { id: 'default', label: 'Default', description: 'Centered text with action buttons.' },
            { id: 'banner', label: 'Banner', description: 'Full-width coloured banner with actions.' },
            { id: 'minimal', label: 'Minimal', description: 'Compact inline call-to-action.' },
        ],
    },
    footer: {
        label: 'Footer',
        defaultVariant: 'default',
        variants: [
            { id: 'default', label: 'Default', description: 'Copyright and links row.' },
            { id: 'minimal', label: 'Minimal', description: 'Single-line copyright only.' },
            { id: 'columns', label: 'Columns', description: 'Multi-column footer with grouped links.' },
        ],
    },
    about: {
        label: 'About Page',
        defaultVariant: 'default',
        variants: [
            { id: 'default', label: 'Default', description: 'Full-length content with features, steps, and CTA.' },
            { id: 'minimal', label: 'Minimal', description: 'Concise single-section overview.' },
            { id: 'detailed', label: 'Detailed', description: 'Card-based layout with tech-stack badges.' },
        ],
    },
};

export function getHomepageVariantIdsForSlot(slot: HomepageSlotName): string[] {
    return homepageSlotVariantRegistry[slot].variants.map((v) => v.id);
}

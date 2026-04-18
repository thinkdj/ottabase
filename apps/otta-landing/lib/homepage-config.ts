/**
 * Homepage slot configuration system.
 *
 * Defines the available "slots" (hero, features, navbar, footer, cta),
 * the variant options for each slot, and helpers to persist the active
 * selection in localStorage so the homepage can be reconfigured at runtime.
 */

// ── Slot / variant type definitions ─────────────────────────────────────────

/** Every switchable section of the homepage. */
export const SLOT_NAMES = ['navbar', 'hero', 'features', 'cta', 'footer', 'about'] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

/** Describes a single selectable variant inside a slot. */
export type VariantMeta = {
    /** Machine key – matches the component lookup key */
    id: string;
    /** Human-readable label shown in the config UI */
    label: string;
    /** Short description of what makes this variant different */
    description: string;
};

/** Full registry: maps each slot to its available variants + the default. */
export type SlotRegistry = Record<
    SlotName,
    {
        label: string;
        defaultVariant: string;
        variants: VariantMeta[];
    }
>;

// ── Registry definition ─────────────────────────────────────────────────────

export const SLOT_REGISTRY: SlotRegistry = {
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

// ── Config persistence ──────────────────────────────────────────────────────

export const HOMEPAGE_CONFIG_KEY = 'ottabase.homepage.slots-config';

/** Maps each slot to its currently selected variant id. */
export type HomepageConfig = Record<SlotName, string>;

/** Returns the default config (every slot set to its default variant). */
export function getDefaultConfig(): HomepageConfig {
    const config = {} as HomepageConfig;
    for (const slot of SLOT_NAMES) {
        config[slot] = SLOT_REGISTRY[slot].defaultVariant;
    }
    return config;
}

/** Read persisted config from localStorage, falling back to defaults. */
export function loadConfig(): HomepageConfig {
    if (typeof window === 'undefined') return getDefaultConfig();
    try {
        const raw = localStorage.getItem(HOMEPAGE_CONFIG_KEY);
        if (!raw) return getDefaultConfig();
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return getDefaultConfig();
        }
        const defaults = getDefaultConfig();
        const result = { ...defaults };
        // Only accept keys that are valid slot names with string values AND valid variant IDs
        for (const slot of SLOT_NAMES) {
            if (typeof parsed[slot] === 'string') {
                // Validate that the variant ID exists in this slot's registry
                const validIds = SLOT_REGISTRY[slot].variants.map((v) => v.id);
                if (validIds.includes(parsed[slot])) {
                    result[slot] = parsed[slot];
                }
                // If invalid, keep the default (already set above)
            }
        }
        return result;
    } catch {
        return getDefaultConfig();
    }
}

/** Persist the full config to localStorage. */
export function saveConfig(config: HomepageConfig): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(HOMEPAGE_CONFIG_KEY, JSON.stringify(config));
}

/** Canonical data contract for every features variant. */
export type FeatureItemData = {
    title: string;
    description: string;
    /** Lucide icon name (e.g. 'Zap', 'Shield') — rendered by variants that support icons */
    icon?: string;
    /** Image URL for visual feature cards */
    imageUrl?: string;
    /** Link target for clickable feature items */
    href?: string;
};

export type FeaturesData = {
    /** Optional section heading */
    title?: string;
    features: FeatureItemData[];
};

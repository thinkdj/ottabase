/** Canonical data contract for every features variant. */
export type FeatureItemData = {
    title: string;
    description: string;
};

export type FeaturesData = {
    /** Optional section heading */
    title?: string;
    features: FeatureItemData[];
};

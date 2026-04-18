import type { ReactNode } from 'react';

/** Shared action button data used across all CTA variants. */
export type CTAAction = {
    href: string;
    label: ReactNode;
    variant?: 'default' | 'secondary' | 'outline' | 'ghost';
    external?: boolean;
};

/** Canonical data contract for every CTA variant. */
export type CTAData = {
    title: string;
    description?: ReactNode;
    actions: CTAAction[];
};

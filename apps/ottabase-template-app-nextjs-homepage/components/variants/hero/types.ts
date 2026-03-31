import type { ReactNode } from 'react';

/** Shared action button data used across all hero variants. */
export type HeroAction = {
    href: string;
    label: ReactNode;
    variant?: 'default' | 'secondary' | 'outline' | 'ghost';
    /** Lucide icon name (e.g. 'Rocket', 'Github') */
    icon?: string;
    external?: boolean;
};

/** Canonical data contract for every hero variant. */
export type HeroData = {
    title: ReactNode;
    subtitle?: string;
    body?: string;
    actions?: HeroAction[];
};

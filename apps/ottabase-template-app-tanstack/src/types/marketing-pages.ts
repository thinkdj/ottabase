export type PageStatus = 'draft' | 'published' | 'archived';

export interface MarketingPage {
    id: string;
    appId: string;
    slug: string;
    title: string;
    organizationId?: string | null;
    userId?: string | null;
    status: PageStatus;
    createdAt: number;
    updatedAt: number;
}

export interface MarketingSection {
    id: string;
    pageId: string;
    appId: string;
    organizationId?: string | null;
    userId?: string | null;
    slot: string;
    variant: string;
    title?: string;
    subtitle?: string;
    body?: string;
    enabled: boolean;
    sortOrder: number;
}

export interface MarketingAction {
    id: string;
    sectionId: string;
    appId: string;
    organizationId?: string | null;
    userId?: string | null;
    label: string;
    href: string;
    variant: string;
    external: boolean;
    sortOrder: number;
}

export interface MarketingFeature {
    id: string;
    sectionId: string;
    appId: string;
    organizationId?: string | null;
    userId?: string | null;
    title: string;
    description?: string;
    icon?: string;
    link?: string;
    sortOrder: number;
}

export interface BlockDefinition {
    id: string;
    label: string;
    category: string;
    variants: Array<{ id: string; label: string }>;
    fields: Array<{ id: string; label: string; type: string }>;
}

/** Shared types for the page builder UI components. */

export type EditableBlock = {
    id: string;
    title?: string;
    subtitle?: string;
    body?: string;
    variant?: string;
    enabled?: boolean;
};

export type PageDraft = {
    id: string;
    title: string;
    slug: string;
    status: string;
};

export type BlockDefinition = {
    id: string;
    label: string;
    category: string;
    variants: Array<{ id: string; label: string }>;
    fields: Array<{ id: string; label: string; type: string }>;
};

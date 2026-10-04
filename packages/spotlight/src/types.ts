import { ReactNode } from 'react';

export interface SpotlightResult {
    id: string;
    label: string;
    description?: string;
    icon?: ReactNode;
    keywords?: string[];
    /** Section heading; consecutive results with the same group render under one heading */
    group?: string;
    /** Optional right-aligned hint, e.g. a shortcut or "Recent" */
    hint?: string;
    onSelect?: () => void;
    [key: string]: unknown;
}

export interface SpotlightConfig {
    enabled?: boolean;
    shortcuts?: string[];
    placeholder?: string;
    emptyMessage?: string;
    /** Shown before anything is typed when there are no default results. Default: 'Type to search' */
    idleMessage?: string;
    loadingMessage?: string;
    errorMessage?: string;
    onSearch?: (query: string, signal?: AbortSignal) => Promise<SpotlightResult[]> | SpotlightResult[];
    renderResult?: (result: SpotlightResult, index: number, isSelected: boolean) => ReactNode;
    renderLoading?: () => ReactNode;
    renderEmpty?: () => ReactNode;
    renderError?: (error: Error) => ReactNode;
    maxResults?: number;
    searchDebounceMs?: number;
    minQueryLength?: number;
    onQueryChange?: (query: string) => void;
    onResultSelect?: (result: SpotlightResult) => void;
    onOpenChange?: (open: boolean) => void;
    defaultResults?: SpotlightResult[];
}

export interface SpotlightContextValue {
    open: boolean;
    setOpen: (open: boolean) => void;
    toggle: () => void;
}

export interface SpotlightProps extends SpotlightConfig {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    className?: string;
    overlayClassName?: string;
}

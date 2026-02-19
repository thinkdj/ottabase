import { ReactNode } from 'react';

export interface SpotlightResult {
    id: string;
    label: string;
    description?: string;
    icon?: ReactNode;
    keywords?: string[];
    onSelect?: () => void;
    [key: string]: unknown;
}

export interface SpotlightConfig {
    enabled?: boolean;
    shortcuts?: string[];
    placeholder?: string;
    emptyMessage?: string;
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

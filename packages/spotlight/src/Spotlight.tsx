import { cn, Dialog, DialogOverlay, DialogTitle } from '@ottabase/ui-shadcn';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { IconAlertCircle, IconSearch, IconX } from '@tabler/icons-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { SpotlightProps, SpotlightResult } from './types';

const DEFAULT_RESULTS: SpotlightResult[] = [
    { id: 'home', label: 'Home', onSelect: () => console.log('Home') },
    { id: 'about', label: 'About us', onSelect: () => console.log('About') },
    { id: 'contacts', label: 'Contacts', onSelect: () => console.log('Contacts') },
    { id: 'blog', label: 'Blog', onSelect: () => console.log('Blog') },
    { id: 'careers', label: 'Careers', onSelect: () => console.log('Careers') },
    { id: 'terms', label: 'Terms of service', onSelect: () => console.log('Terms') },
];

function defaultRenderResult(result: SpotlightResult, index: number, isSelected: boolean) {
    return (
        <div
            className={cn(
                'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-75',
                isSelected && 'bg-accent text-accent-foreground',
            )}
        >
            {result.icon && <div className="flex-shrink-0">{result.icon}</div>}
            <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{result.label}</div>
                {result.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{result.description}</div>
                )}
            </div>
        </div>
    );
}

export function Spotlight({
    open: openProp,
    onOpenChange,
    placeholder = 'Search...',
    emptyMessage = 'No results found',
    loadingMessage = 'Searching...',
    errorMessage = 'An error occurred while searching',
    onSearch,
    renderResult = defaultRenderResult,
    renderLoading,
    renderEmpty,
    renderError,
    maxResults = 50,
    searchDebounceMs = 300,
    minQueryLength = 0,
    onQueryChange,
    onResultSelect,
    defaultResults = [],
    className,
    overlayClassName,
}: SpotlightProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SpotlightResult[]>(defaultResults);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const defaultResultsRef = useRef(defaultResults);
    const onQueryChangeRef = useRef(onQueryChange);
    const onResultSelectRef = useRef(onResultSelect);

    // Keep refs in sync
    useEffect(() => {
        defaultResultsRef.current = defaultResults;
        onQueryChangeRef.current = onQueryChange;
        onResultSelectRef.current = onResultSelect;
    }, [defaultResults, onQueryChange, onResultSelect]);

    const open = openProp ?? internalOpen;
    const setOpen = useCallback(
        (value: boolean) => {
            if (onOpenChange) {
                onOpenChange(value);
            } else {
                setInternalOpen(value);
            }
        },
        [onOpenChange],
    );

    // Search handler with abort controller support
    const performSearch = useCallback(
        async (searchQuery: string) => {
            // Cancel previous request if exists
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            const trimmedQuery = searchQuery.trim();

            // Handle empty query - use defaultResults from ref to avoid dependency
            if (!trimmedQuery) {
                const defaults = defaultResultsRef.current;
                setResults(defaults);
                setSelectedIndex(defaults.length > 0 ? 0 : -1);
                setError(null);
                setIsLoading(false);
                return;
            }

            // Check minimum query length
            if (trimmedQuery.length < minQueryLength) {
                setResults([]);
                setSelectedIndex(-1);
                setError(null);
                setIsLoading(false);
                return;
            }

            // Create new abort controller for this request
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            setIsLoading(true);
            setError(null);

            try {
                let searchResults: SpotlightResult[] = [];

                if (onSearch) {
                    const fetchedResults = await onSearch(trimmedQuery, abortController.signal);

                    if (abortController.signal.aborted) return;

                    searchResults = Array.isArray(fetchedResults) ? fetchedResults : [];
                } else {
                    // Default search logic
                    const lowerQuery = trimmedQuery.toLowerCase();
                    searchResults = DEFAULT_RESULTS.filter((result) => {
                        const matchesLabel = result.label.toLowerCase().includes(lowerQuery);
                        const matchesKeywords =
                            result.keywords?.some((keyword) => keyword.toLowerCase().includes(lowerQuery)) ?? false;
                        return matchesLabel || matchesKeywords;
                    });
                }

                if (abortController.signal.aborted) return;

                const limitedResults = searchResults.slice(0, maxResults);
                setResults(limitedResults);
                setSelectedIndex(limitedResults.length > 0 ? 0 : -1);
            } catch (err) {
                if (abortController.signal.aborted) return;

                const error = err instanceof Error ? err : new Error(String(err));
                console.error('Spotlight search error:', error);
                setError(error);
                setResults([]);
                setSelectedIndex(-1);
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        },
        [onSearch, maxResults, minQueryLength],
    );

    // Debounced search with cleanup
    useEffect(() => {
        // If query is empty and we have default results, show them immediately
        if (!query.trim() && defaultResultsRef.current.length > 0) {
            setResults(defaultResultsRef.current);
            setSelectedIndex(defaultResultsRef.current.length > 0 ? 0 : -1);
            setError(null);
            setIsLoading(false);
            onQueryChangeRef.current?.(query);
            return;
        }

        onQueryChangeRef.current?.(query);

        const timer = setTimeout(() => {
            performSearch(query);
        }, searchDebounceMs);

        return () => {
            clearTimeout(timer);
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [query, searchDebounceMs, performSearch]);

    // Reset when opening/closing
    useEffect(() => {
        if (open) {
            setQuery('');
            setError(null);
            // Set default results only if provided
            if (defaultResults.length > 0) {
                setResults(defaultResults);
                setSelectedIndex(0);
            } else {
                setResults([]);
                setSelectedIndex(-1);
            }
            // Focus input after dialog animation
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        } else {
            // Cleanup on close
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            setQuery('');
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Keyboard navigation
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex((prev) => Math.max(prev - 1, -1));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (selectedIndex >= 0 && results[selectedIndex]) {
                        const selectedResult = results[selectedIndex];
                        onResultSelectRef.current?.(selectedResult);
                        selectedResult.onSelect?.();
                        setOpen(false);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    setOpen(false);
                    break;
            }
        },
        [results, selectedIndex, setOpen],
    );

    // Scroll selected item into view
    useEffect(() => {
        if (selectedIndex >= 0 && resultsRef.current) {
            const selectedElement = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth',
                });
            }
        }
    }, [selectedIndex]);

    const handleResultClick = useCallback(
        (result: SpotlightResult) => {
            onResultSelectRef.current?.(result);
            result.onSelect?.();
            setOpen(false);
        },
        [setOpen],
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Portal>
                <DialogOverlay
                    className={cn(
                        'bg-black/40 backdrop-blur-sm supports-[backdrop-filter]:bg-black/30',
                        overlayClassName,
                    )}
                />
                <DialogPrimitive.Content
                    className={cn(
                        'fixed left-[50%] top-[10%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-0 p-0 gap-0 overflow-hidden',
                        'bg-white dark:bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-white dark:supports-[backdrop-filter]:bg-background/80',
                        'border shadow-lg rounded-lg',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                        'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[10%]',
                        'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[10%]',
                        'duration-100',
                        className,
                    )}
                    onKeyDown={handleKeyDown}
                >
                    <DialogTitle className="sr-only">Search</DialogTitle>
                    {/* Search Input */}
                    <div className="flex items-center gap-3 border-b px-4 py-3">
                        <IconSearch className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={placeholder}
                            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                            autoFocus
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                className="text-muted-foreground hover:text-foreground transition-colors duration-75"
                                aria-label="Clear search"
                            >
                                <IconX className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Results */}
                    <div ref={resultsRef} className="max-h-[400px] overflow-y-auto overflow-x-hidden">
                        {error ? (
                            renderError ? (
                                renderError(error)
                            ) : (
                                <div className="px-4 py-8 text-center text-sm text-destructive">
                                    <div className="flex items-center justify-center gap-2">
                                        <IconAlertCircle className="h-4 w-4" />
                                        <span>{errorMessage}</span>
                                    </div>
                                </div>
                            )
                        ) : isLoading ? (
                            renderLoading ? (
                                renderLoading()
                            ) : (
                                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                    {loadingMessage}
                                </div>
                            )
                        ) : results.length === 0 ? (
                            renderEmpty ? (
                                renderEmpty()
                            ) : (
                                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                    {emptyMessage}
                                </div>
                            )
                        ) : (
                            <div className="py-2">
                                {results.map((result, index) => (
                                    <div
                                        key={result.id}
                                        data-index={index}
                                        onClick={() => handleResultClick(result)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        {renderResult(result, index, index === selectedIndex)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </Dialog>
    );
}

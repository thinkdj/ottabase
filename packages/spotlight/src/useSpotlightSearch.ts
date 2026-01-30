import { useCallback, useRef, useState } from 'react';
import type { SpotlightResult } from './types';

export interface UseSpotlightSearchOptions {
    debounceMs?: number;
    minQueryLength?: number;
    onSearch: (query: string, signal?: AbortSignal) => Promise<SpotlightResult[]> | SpotlightResult[];
    onError?: (error: Error) => void;
    onSuccess?: (results: SpotlightResult[]) => void;
}

export interface UseSpotlightSearchReturn {
    query: string;
    setQuery: (query: string) => void;
    results: SpotlightResult[];
    isLoading: boolean;
    error: Error | null;
    search: (query: string) => void;
    reset: () => void;
}

/**
 * Custom hook for managing spotlight search with debouncing and abort controller support
 *
 * @example
 * ```tsx
 * const { query, setQuery, results, isLoading, error } = useSpotlightSearch({
 *   debounceMs: 300,
 *   minQueryLength: 2,
 *   onSearch: async (query, signal) => {
 *     const response = await fetch(`/api/search?q=${query}`, { signal });
 *     return response.json();
 *   },
 *   onError: (error) => console.error(error),
 *   onSuccess: (results) => console.log('Found', results.length, 'results'),
 * });
 * ```
 */
export function useSpotlightSearch({
    debounceMs = 300,
    minQueryLength = 0,
    onSearch,
    onError,
    onSuccess,
}: UseSpotlightSearchOptions): UseSpotlightSearchReturn {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SpotlightResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const performSearch = useCallback(
        async (searchQuery: string) => {
            // Cancel previous request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            const trimmedQuery = searchQuery.trim();

            if (!trimmedQuery || trimmedQuery.length < minQueryLength) {
                setResults([]);
                setError(null);
                setIsLoading(false);
                return;
            }

            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            setIsLoading(true);
            setError(null);

            try {
                const searchResults = await onSearch(trimmedQuery, abortController.signal);

                if (abortController.signal.aborted) {
                    return;
                }

                const finalResults = Array.isArray(searchResults) ? searchResults : [];
                setResults(finalResults);
                onSuccess?.(finalResults);
            } catch (err) {
                if (abortController.signal.aborted) {
                    return;
                }

                const error = err instanceof Error ? err : new Error(String(err));
                setError(error);
                setResults([]);
                onError?.(error);
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        },
        [onSearch, minQueryLength, onError, onSuccess],
    );

    const search = useCallback(
        (searchQuery: string) => {
            setQuery(searchQuery);

            // Clear existing timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Set new timeout for debounced search
            timeoutRef.current = setTimeout(() => {
                performSearch(searchQuery);
            }, debounceMs);
        },
        [debounceMs, performSearch],
    );

    const reset = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setQuery('');
        setResults([]);
        setError(null);
        setIsLoading(false);
    }, []);

    return {
        query,
        setQuery: search,
        results,
        isLoading,
        error,
        search,
        reset,
    };
}

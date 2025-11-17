/**
 * useSearch hook
 * Main hook for search functionality
 */

import { useState, useCallback, useEffect } from 'react';
import type { SearchAdapter, SearchResult, SearchState, GroupedResults } from '../types';
import { groupResults, debounce, flattenResults } from '../utils';

export interface UseSearchOptions {
  /** Search adapter */
  adapter: SearchAdapter;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Auto-search on query change */
  autoSearch?: boolean;
  /** Minimum query length for auto-search */
  minQueryLength?: number;
}

export function useSearch(options: UseSearchOptions) {
  const {
    adapter,
    debounceMs = 300,
    autoSearch = true,
    minQueryLength = 1,
  } = options;

  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    groupedResults: [],
    isLoading: false,
    error: null,
    isOpen: false,
    focusedIndex: -1,
    recentSearches: [],
  });

  // Load recent searches on mount
  useEffect(() => {
    if (adapter.getRecentSearches) {
      adapter.getRecentSearches().then((recent) => {
        setState((prev) => ({ ...prev, recentSearches: recent }));
      });
    }
  }, [adapter]);

  // Perform search
  const search = useCallback(
    async (query: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const results = await adapter.search(query);
        const grouped = groupResults(results);

        setState((prev) => ({
          ...prev,
          results,
          groupedResults: grouped,
          isLoading: false,
          focusedIndex: -1,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Search failed',
          isLoading: false,
          results: [],
          groupedResults: [],
        }));
      }
    },
    [adapter]
  );

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      if (query.length >= minQueryLength) {
        search(query);
      } else {
        setState((prev) => ({
          ...prev,
          results: [],
          groupedResults: [],
        }));
      }
    }, debounceMs),
    [search, minQueryLength, debounceMs]
  );

  // Set query and optionally trigger search
  const setQuery = useCallback(
    (query: string) => {
      setState((prev) => ({ ...prev, query }));

      if (autoSearch) {
        debouncedSearch(query);
      }
    },
    [autoSearch, debouncedSearch]
  );

  // Open modal
  const open = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true }));
  }, []);

  // Close modal
  const close = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
      query: '',
      results: [],
      groupedResults: [],
      focusedIndex: -1,
      error: null,
    }));
  }, []);

  // Toggle modal
  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  // Set focused index
  const setFocusedIndex = useCallback((index: number) => {
    setState((prev) => ({ ...prev, focusedIndex: index }));
  }, []);

  // Navigate to next result
  const focusNext = useCallback(() => {
    setState((prev) => {
      const flatResults = flattenResults(prev.groupedResults);
      const maxIndex = flatResults.length - 1;
      const nextIndex = prev.focusedIndex < maxIndex ? prev.focusedIndex + 1 : 0;
      return { ...prev, focusedIndex: nextIndex };
    });
  }, []);

  // Navigate to previous result
  const focusPrevious = useCallback(() => {
    setState((prev) => {
      const flatResults = flattenResults(prev.groupedResults);
      const maxIndex = flatResults.length - 1;
      const prevIndex =
        prev.focusedIndex > 0 ? prev.focusedIndex - 1 : maxIndex;
      return { ...prev, focusedIndex: prevIndex };
    });
  }, []);

  // Select result
  const selectResult = useCallback(
    (result: SearchResult) => {
      // Navigate to URL if provided
      if (result.url && typeof window !== 'undefined') {
        window.location.href = result.url;
      }

      // Update recent searches
      if (adapter.getRecentSearches) {
        adapter.getRecentSearches().then((recent) => {
          setState((prev) => ({ ...prev, recentSearches: recent }));
        });
      }

      // Close modal
      close();
    },
    [adapter, close]
  );

  // Select focused result
  const selectFocused = useCallback(() => {
    const flatResults = flattenResults(state.groupedResults);
    const result = flatResults[state.focusedIndex];
    if (result) {
      selectResult(result);
    }
  }, [state.groupedResults, state.focusedIndex, selectResult]);

  // Clear search
  const clear = useCallback(() => {
    setState((prev) => ({
      ...prev,
      query: '',
      results: [],
      groupedResults: [],
      focusedIndex: -1,
      error: null,
    }));
  }, []);

  // Clear history
  const clearHistory = useCallback(async () => {
    if (adapter.clearHistory) {
      await adapter.clearHistory();
      setState((prev) => ({ ...prev, recentSearches: [] }));
    }
  }, [adapter]);

  return {
    ...state,
    setQuery,
    search,
    open,
    close,
    toggle,
    setFocusedIndex,
    focusNext,
    focusPrevious,
    selectFocused,
    selectResult,
    clear,
    clearHistory,
    adapter,
  };
}

/**
 * Core types for OttaSearch
 */

/**
 * A single search result item
 */
export interface SearchResult {
  /** Unique identifier */
  id: string;
  /** Display title */
  title: string;
  /** Optional description/subtitle */
  description?: string;
  /** Category/group for organizing results */
  category?: string;
  /** Icon name from lucide-react (optional) */
  icon?: string;
  /** URL to navigate to on selection */
  url?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Search options for adapters
 */
export interface SearchOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Categories/tables to filter by */
  categories?: string[];
  /** Additional adapter-specific options */
  [key: string]: any;
}

/**
 * Search adapter interface
 * Implement this to create custom data sources
 */
export interface SearchAdapter {
  /**
   * Perform a search query
   * @param query - Search query string
   * @param options - Search options
   * @returns Promise of search results
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Get recent searches (optional)
   * @returns Promise of recent search results
   */
  getRecentSearches?(): Promise<SearchResult[]>;

  /**
   * Get search suggestions based on partial query (optional)
   * @param query - Partial query string
   * @returns Promise of suggested results
   */
  getSuggestions?(query: string): Promise<SearchResult[]>;

  /**
   * Clear search history (optional)
   */
  clearHistory?(): Promise<void>;
}

/**
 * Grouped search results by category
 */
export interface GroupedResults {
  category: string;
  results: SearchResult[];
}

/**
 * Search state
 */
export interface SearchState {
  /** Current search query */
  query: string;
  /** Search results */
  results: SearchResult[];
  /** Grouped results by category */
  groupedResults: GroupedResults[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Whether search modal is open */
  isOpen: boolean;
  /** Currently focused result index */
  focusedIndex: number;
  /** Recent searches */
  recentSearches: SearchResult[];
}

/**
 * Search actions
 */
export interface SearchActions {
  /** Set search query */
  setQuery: (query: string) => void;
  /** Perform search */
  search: (query: string) => Promise<void>;
  /** Open search modal */
  open: () => void;
  /** Close search modal */
  close: () => void;
  /** Toggle search modal */
  toggle: () => void;
  /** Set focused result index */
  setFocusedIndex: (index: number) => void;
  /** Navigate to next result */
  focusNext: () => void;
  /** Navigate to previous result */
  focusPrevious: () => void;
  /** Select current focused result */
  selectFocused: () => void;
  /** Select a specific result */
  selectResult: (result: SearchResult) => void;
  /** Clear search */
  clear: () => void;
  /** Clear history */
  clearHistory: () => Promise<void>;
}

/**
 * Search context value
 */
export interface SearchContextValue extends SearchState, SearchActions {
  /** Search adapter */
  adapter: SearchAdapter;
}

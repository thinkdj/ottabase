/**
 * localStorage utilities for search persistence
 */

const RECENT_SEARCHES_KEY = 'ottasearch_recent_searches';
const MAX_RECENT_SEARCHES = 5;

export interface StoredSearch {
  id: string;
  title: string;
  description?: string;
  category?: string;
  icon?: string;
  url?: string;
  timestamp: number;
}

/**
 * Get recent searches from localStorage
 */
export function getRecentSearches(): StoredSearch[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) return [];

    const searches = JSON.parse(stored) as StoredSearch[];
    return searches.slice(0, MAX_RECENT_SEARCHES);
  } catch (error) {
    console.error('Error loading recent searches:', error);
    return [];
  }
}

/**
 * Add a search to recent searches
 */
export function addRecentSearch(search: Omit<StoredSearch, 'timestamp'>): void {
  if (typeof window === 'undefined') return;

  try {
    const recent = getRecentSearches();

    // Remove if already exists
    const filtered = recent.filter(s => s.id !== search.id);

    // Add to beginning with timestamp
    const updated = [
      { ...search, timestamp: Date.now() },
      ...filtered
    ].slice(0, MAX_RECENT_SEARCHES);

    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving recent search:', error);
  }
}

/**
 * Clear all recent searches
 */
export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch (error) {
    console.error('Error clearing recent searches:', error);
  }
}

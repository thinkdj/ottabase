/**
 * Utility functions for OttaSearch
 */

import type { SearchResult, GroupedResults } from '../types';

/**
 * Group search results by category
 */
export function groupResults(results: SearchResult[]): GroupedResults[] {
  const groups = new Map<string, SearchResult[]>();

  results.forEach((result) => {
    const category = result.category || 'Other';
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(result);
  });

  return Array.from(groups.entries()).map(([category, results]) => ({
    category,
    results,
  }));
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Highlight search query in text (returns HTML string)
 */
export function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;

  // Escape special regex characters
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');

  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-900/50 text-gray-900 dark:text-gray-100">$1</mark>');
}

/**
 * Highlight text and return parts for React rendering
 */
export function highlightTextParts(text: string, query: string): Array<{text: string; highlight: boolean}> {
  if (!query.trim()) return [{text, highlight: false}];

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts: Array<{text: string; highlight: boolean}> = [];

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add non-matching part
    if (match.index > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, match.index),
        highlight: false
      });
    }

    // Add matching part
    parts.push({
      text: match[0],
      highlight: true
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      highlight: false
    });
  }

  return parts;
}

/**
 * Get platform-specific command key
 */
export function getCommandKey(): string {
  if (typeof window === 'undefined') return '⌘';
  return navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl';
}

/**
 * Check if command key is pressed
 */
export function isCommandKey(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

/**
 * Flatten grouped results back to array
 */
export function flattenResults(groupedResults: GroupedResults[]): SearchResult[] {
  return groupedResults.flatMap((group) => group.results);
}

/**
 * Filter results by category
 */
export function filterByCategory(
  results: SearchResult[],
  categories: string[]
): SearchResult[] {
  if (categories.length === 0) return results;
  return results.filter(
    (result) => result.category && categories.includes(result.category)
  );
}

/**
 * Simple client-side search filter
 */
export function clientSearch(
  results: SearchResult[],
  query: string
): SearchResult[] {
  if (!query.trim()) return results;

  const lowerQuery = query.toLowerCase();
  return results.filter(
    (result) =>
      result.title.toLowerCase().includes(lowerQuery) ||
      result.description?.toLowerCase().includes(lowerQuery)
  );
}

// Re-export storage utilities
export { getRecentSearches, addRecentSearch, clearRecentSearches } from './storage';
export type { StoredSearch } from './storage';

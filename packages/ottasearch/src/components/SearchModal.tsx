/**
 * SearchModal - Full-screen Notion-like search experience
 */

import React, { useEffect, useRef } from 'react';
import { Search, Loader2, Clock, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { SearchResult, GroupedResults } from '../types';
import { getCommandKey } from '../utils';
import * as LucideIcons from 'lucide-react';

export interface SearchModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Search query */
  query: string;
  /** Query change handler */
  onQueryChange: (query: string) => void;
  /** Grouped search results */
  groupedResults: GroupedResults[];
  /** Recent searches */
  recentSearches?: SearchResult[];
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
  /** Focused result index */
  focusedIndex: number;
  /** Result selection handler */
  onSelectResult: (result: SearchResult) => void;
  /** Clear history handler */
  onClearHistory?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Custom className */
  className?: string;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  query,
  onQueryChange,
  groupedResults,
  recentSearches = [],
  isLoading = false,
  error = null,
  focusedIndex,
  onSelectResult,
  onClearHistory,
  placeholder = 'Search...',
  className,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll focused result into view
  useEffect(() => {
    if (focusedIndex >= 0 && resultsRef.current) {
      const focusedElement = resultsRef.current.querySelector(
        `[data-index="${focusedIndex}"]`
      ) as HTMLElement;

      if (focusedElement) {
        focusedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [focusedIndex]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const hasResults = groupedResults.length > 0;
  const showRecent = !query && recentSearches.length > 0;
  const showEmpty = !isLoading && !error && !hasResults && !showRecent && query;

  return (
    <div
      className={clsx(
        'fixed inset-0 z-50 flex items-start justify-center',
        'bg-black/50 dark:bg-black/70 backdrop-blur-sm',
        'p-4 pt-[15vh]',
        className
      )}
      onClick={onClose}
    >
      <div
        className={clsx(
          'w-full max-w-2xl',
          'bg-white dark:bg-gray-900',
          'rounded-lg shadow-2xl',
          'border border-gray-200 dark:border-gray-700',
          'flex flex-col',
          'max-h-[70vh]',
          'animate-in fade-in slide-in-from-top-4 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            className={clsx(
              'flex-1 text-base',
              'bg-transparent',
              'text-gray-900 dark:text-gray-100',
              'placeholder:text-gray-400 dark:placeholder:text-gray-500',
              'focus:outline-none'
            )}
          />
          {query && (
            <button
              onClick={() => onQueryChange('')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </button>
          )}
          <kbd
            className={clsx(
              'hidden sm:inline-flex items-center gap-1',
              'px-2 py-1 text-xs font-mono',
              'bg-gray-100 dark:bg-gray-800',
              'text-gray-500 dark:text-gray-400',
              'border border-gray-300 dark:border-gray-600',
              'rounded'
            )}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="overflow-y-auto flex-1 py-2"
        >
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-sm">Searching...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center justify-center py-12 text-red-500 dark:text-red-400">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {showEmpty && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <Search className="w-8 h-8 mb-3 opacity-50" />
              <p className="text-sm">No results found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}

          {/* Recent Searches */}
          {showRecent && (
            <div className="px-2">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Recent</span>
                </div>
                {onClearHistory && (
                  <button
                    onClick={onClearHistory}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-0.5">
                {recentSearches.map((result, index) => (
                  <ResultItem
                    key={result.id}
                    result={result}
                    index={index}
                    isFocused={index === focusedIndex}
                    onSelect={onSelectResult}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {hasResults && (
            <div className="px-2 space-y-4">
              {groupedResults.map((group, groupIndex) => (
                <div key={group.category}>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {group.category}
                  </div>
                  <div className="space-y-0.5">
                    {group.results.map((result, resultIndex) => {
                      // Calculate global index
                      const globalIndex = groupedResults
                        .slice(0, groupIndex)
                        .reduce((acc, g) => acc + g.results.length, 0) + resultIndex;

                      return (
                        <ResultItem
                          key={result.id}
                          result={result}
                          index={globalIndex}
                          isFocused={globalIndex === focusedIndex}
                          onSelect={onSelectResult}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={clsx(
            'flex items-center justify-between',
            'px-4 py-2',
            'border-t border-gray-200 dark:border-gray-700',
            'text-xs text-gray-500 dark:text-gray-400'
          )}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs">
                ↑↓
              </kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs">
                ↵
              </kbd>
              <span>Select</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span>Open with</span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs">
              {getCommandKey()}K
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ResultItemProps {
  result: SearchResult;
  index: number;
  isFocused: boolean;
  onSelect: (result: SearchResult) => void;
}

const ResultItem: React.FC<ResultItemProps> = ({
  result,
  index,
  isFocused,
  onSelect,
}) => {
  // Get icon component
  const IconComponent = result.icon
    ? (LucideIcons as any)[result.icon]
    : null;

  return (
    <button
      data-index={index}
      onClick={() => onSelect(result)}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left',
        'transition-colors duration-150',
        'group',
        isFocused
          ? 'bg-blue-50 dark:bg-blue-900/30'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
      )}
    >
      {/* Icon */}
      {IconComponent && (
        <IconComponent
          className={clsx(
            'w-4 h-4 flex-shrink-0',
            isFocused
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-400 dark:text-gray-500'
          )}
        />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          className={clsx(
            'text-sm font-medium truncate',
            isFocused
              ? 'text-blue-900 dark:text-blue-100'
              : 'text-gray-900 dark:text-gray-100'
          )}
        >
          {result.title}
        </div>
        {result.description && (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {result.description}
          </div>
        )}
      </div>

      {/* Enter hint on hover/focus */}
      {isFocused && (
        <kbd className="hidden sm:block px-1.5 py-0.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
          ↵
        </kbd>
      )}
    </button>
  );
};

export default SearchModal;

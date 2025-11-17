/**
 * SearchInput - Inline search input with dropdown results
 */

import React, { useRef, useEffect, useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { SearchResult, GroupedResults } from '../types';
import * as LucideIcons from 'lucide-react';

export interface SearchInputProps {
  /** Search query */
  query: string;
  /** Query change handler */
  onQueryChange: (query: string) => void;
  /** Grouped search results */
  groupedResults: GroupedResults[];
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
  /** Focused result index */
  focusedIndex: number;
  /** Result selection handler */
  onSelectResult: (result: SearchResult) => void;
  /** Focus next handler */
  onFocusNext: () => void;
  /** Focus previous handler */
  onFocusPrevious: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Custom className */
  className?: string;
  /** Dropdown className */
  dropdownClassName?: string;
  /** Max results to show */
  maxResults?: number;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  query,
  onQueryChange,
  groupedResults,
  isLoading = false,
  error = null,
  focusedIndex,
  onSelectResult,
  onFocusNext,
  onFocusPrevious,
  placeholder = 'Search...',
  className,
  dropdownClassName,
  maxResults = 8,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Flatten results for display
  const flatResults = groupedResults.flatMap((g) => g.results).slice(0, maxResults);
  const hasResults = flatResults.length > 0;
  const showDropdown = isOpen && (query.length > 0 || hasResults || isLoading || error);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll focused result into view
  useEffect(() => {
    if (focusedIndex >= 0 && dropdownRef.current) {
      const focusedElement = dropdownRef.current.querySelector(
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        onFocusNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        onFocusPrevious();
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && flatResults[focusedIndex]) {
          onSelectResult(flatResults[focusedIndex]);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className={clsx('relative w-full', className)}>
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={clsx(
            'w-full pl-10 pr-10 py-2 text-sm',
            'bg-white dark:bg-gray-800',
            'border border-gray-300 dark:border-gray-600',
            'text-gray-900 dark:text-gray-100',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent',
            'transition-colors duration-150'
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-gray-400 dark:text-gray-500 animate-spin" />
          ) : query ? (
            <button
              onClick={() => onQueryChange('')}
              className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className={clsx(
            'absolute z-50 w-full mt-2',
            'bg-white dark:bg-gray-800',
            'border border-gray-200 dark:border-gray-700',
            'rounded-lg shadow-lg dark:shadow-gray-900/50',
            'max-h-80 overflow-y-auto',
            'py-1',
            dropdownClassName
          )}
        >
          {/* Error */}
          {error && (
            <div className="px-3 py-4 text-center text-sm text-red-500 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && !hasResults && query && (
            <div className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              <Search className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p>No results found</p>
            </div>
          )}

          {/* Results */}
          {hasResults &&
            flatResults.map((result, index) => {
              const IconComponent = result.icon
                ? (LucideIcons as any)[result.icon]
                : null;
              const isFocused = index === focusedIndex;

              return (
                <button
                  key={result.id}
                  data-index={index}
                  onClick={() => {
                    onSelectResult(result);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-left',
                    'transition-colors duration-150',
                    isFocused
                      ? 'bg-blue-50 dark:bg-blue-900/30'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
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
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {result.description}
                      </div>
                    )}
                  </div>
                  {result.category && (
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {result.category}
                    </div>
                  )}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default SearchInput;

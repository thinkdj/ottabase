/**
 * SearchPopover - Minimal dropdown for quick search results
 * Appears right below the search trigger, Notion-style
 */

import React, { useRef, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { SearchResult, GroupedResults, EmptyStateConfig } from '../types';
import { highlightTextParts } from '../utils';
import * as LucideIcons from 'lucide-react';

export interface SearchPopoverProps {
  /** Whether popover is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
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
  /** Position relative to trigger */
  anchorRef?: React.RefObject<HTMLElement>;
  /** Custom className */
  className?: string;
  /** Max results to show */
  maxResults?: number;
  /** Search query for highlighting */
  query?: string;
  /** Empty state configuration */
  emptyStateConfig?: EmptyStateConfig;
}

export const SearchPopover: React.FC<SearchPopoverProps> = ({
  isOpen,
  onClose,
  groupedResults,
  isLoading = false,
  error = null,
  focusedIndex,
  onSelectResult,
  anchorRef,
  className,
  maxResults = 8,
  query = '',
  emptyStateConfig,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Flatten and limit results
  const flatResults = groupedResults
    .flatMap((g) => g.results)
    .slice(0, maxResults);
  const hasResults = flatResults.length > 0;

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInside =
        popoverRef.current?.contains(target) ||
        anchorRef?.current?.contains(target);

      if (!clickedInside) {
        onClose();
      }
    };

    // Add slight delay to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  // Scroll focused result into view
  useEffect(() => {
    if (focusedIndex >= 0 && popoverRef.current) {
      const focusedElement = popoverRef.current.querySelector(
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

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className={clsx(
        'absolute z-50 w-full mt-1',
        'bg-white dark:bg-gray-800',
        'border border-gray-200 dark:border-gray-700',
        'rounded-lg shadow-lg dark:shadow-gray-900/50',
        'max-h-[400px] overflow-hidden',
        'animate-in fade-in slide-in-from-top-2 duration-150',
        className
      )}
    >
      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center gap-2 px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Searching...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="px-3 py-4 text-sm text-red-500 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && !hasResults && (
        <div className="px-3 py-4">
          {emptyStateConfig?.component ? (
            <emptyStateConfig.component />
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Search className="w-4 h-4 opacity-50" />
              <span>{emptyStateConfig?.message || 'No results found'}</span>
            </div>
          )}
          {emptyStateConfig?.suggestions && emptyStateConfig.suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {emptyStateConfig.suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={suggestion.onClick}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {hasResults && !isLoading && (
        <div className="overflow-y-auto max-h-[400px] py-1">
          {flatResults.map((result, index) => {
            const IconComponent = result.icon
              ? (LucideIcons as any)[result.icon]
              : null;
            const isFocused = index === focusedIndex;

            // Highlight title and description
            const titleParts = highlightTextParts(result.title, query);
            const descriptionParts = result.description ? highlightTextParts(result.description, query) : [];

            return (
              <button
                key={result.id}
                data-index={index}
                onClick={() => {
                  onSelectResult(result);
                  onClose();
                }}
                className={clsx(
                  'w-full flex items-start gap-3 px-3 py-2 text-left',
                  'transition-colors duration-100',
                  'group',
                  isFocused
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                )}
              >
                {/* Icon */}
                {IconComponent && (
                  <div className="flex-shrink-0 mt-0.5">
                    <IconComponent
                      className={clsx(
                        'w-4 h-4',
                        isFocused
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400 dark:text-gray-500'
                      )}
                    />
                  </div>
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
                    {titleParts.map((part, idx) => (
                      part.highlight ? (
                        <mark
                          key={idx}
                          className="bg-yellow-200 dark:bg-yellow-900/50 text-gray-900 dark:text-gray-100"
                        >
                          {part.text}
                        </mark>
                      ) : (
                        <span key={idx}>{part.text}</span>
                      )
                    ))}
                  </div>
                  {result.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {descriptionParts.map((part, idx) => (
                        part.highlight ? (
                          <mark
                            key={idx}
                            className="bg-yellow-200 dark:bg-yellow-900/50 text-gray-700 dark:text-gray-300"
                          >
                            {part.text}
                          </mark>
                        ) : (
                          <span key={idx}>{part.text}</span>
                        )
                      ))}
                    </div>
                  )}
                  {result.url && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                      {result.url}
                    </div>
                  )}
                </div>

                {/* Category badge (optional) */}
                {result.category && (
                  <div className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
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

export default SearchPopover;

/**
 * OttaSearch - Main component with all variants
 */

import React from 'react';
import type { SearchAdapter } from '../types';
import { useSearch } from '../hooks/useSearch';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { SearchModal } from './SearchModal';
import { SearchButton } from './SearchButton';
import { SearchInput } from './SearchInput';

export interface OttaSearchProps {
  /** Search adapter */
  adapter: SearchAdapter;
  /** UI variant */
  variant?: 'modal' | 'button' | 'input';
  /** Placeholder text */
  placeholder?: string;
  /** Show keyboard shortcut hint */
  showShortcut?: boolean;
  /** Result selection callback */
  onSelect?: (result: any) => void;
  /** Custom className */
  className?: string;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Auto-search on query change */
  autoSearch?: boolean;
  /** Minimum query length for auto-search */
  minQueryLength?: number;
}

export const OttaSearch: React.FC<OttaSearchProps> = ({
  adapter,
  variant = 'modal',
  placeholder = 'Search...',
  showShortcut = true,
  onSelect,
  className,
  debounceMs = 300,
  autoSearch = true,
  minQueryLength = 1,
}) => {
  const searchState = useSearch({
    adapter,
    debounceMs,
    autoSearch,
    minQueryLength,
  });

  const {
    query,
    groupedResults,
    recentSearches,
    isLoading,
    error,
    isOpen,
    focusedIndex,
    setQuery,
    open,
    close,
    focusNext,
    focusPrevious,
    selectFocused,
    selectResult,
    clearHistory,
  } = searchState;

  // Handle result selection
  const handleSelectResult = (result: any) => {
    selectResult(result);
    if (onSelect) {
      onSelect(result);
    }
  };

  // Setup keyboard navigation
  useKeyboardNavigation({
    isOpen,
    onOpen: open,
    onClose: close,
    onNext: focusNext,
    onPrevious: focusPrevious,
    onSelect: selectFocused,
    enableShortcut: variant === 'modal' || variant === 'button',
  });

  // Render variant
  if (variant === 'input') {
    return (
      <SearchInput
        query={query}
        onQueryChange={setQuery}
        groupedResults={groupedResults}
        isLoading={isLoading}
        error={error}
        focusedIndex={focusedIndex}
        onSelectResult={handleSelectResult}
        onFocusNext={focusNext}
        onFocusPrevious={focusPrevious}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  return (
    <>
      {/* Trigger Button (for button and modal variants) */}
      {variant === 'button' || variant === 'modal' ? (
        <SearchButton
          onClick={open}
          showShortcut={showShortcut}
          className={className}
        />
      ) : null}

      {/* Modal */}
      <SearchModal
        isOpen={isOpen}
        onClose={close}
        query={query}
        onQueryChange={setQuery}
        groupedResults={groupedResults}
        recentSearches={recentSearches}
        isLoading={isLoading}
        error={error}
        focusedIndex={focusedIndex}
        onSelectResult={handleSelectResult}
        onClearHistory={clearHistory}
        placeholder={placeholder}
      />
    </>
  );
};

export default OttaSearch;

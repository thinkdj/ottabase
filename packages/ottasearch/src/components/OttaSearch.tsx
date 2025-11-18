/**
 * OttaSearch - Main component with flexible trigger and display options
 */

import React, { useRef } from 'react';
import type { SearchAdapter, SearchScope, EmptyStateConfig } from '../types';
import { useSearch } from '../hooks/useSearch';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { SearchModal } from './SearchModal';
import { SearchButton } from './SearchButton';
import { SearchInput } from './SearchInput';
import { SearchPopover } from './SearchPopover';
import { SearchIconTrigger } from './SearchIconTrigger';

export interface OttaSearchProps {
  /** Search adapter */
  adapter: SearchAdapter;
  /** Trigger type - what the user clicks/interacts with */
  trigger?: 'button' | 'input' | 'icon' | 'icon-input';
  /** Display type - how results are shown */
  display?: 'modal' | 'popover';
  /** Placeholder text */
  placeholder?: string;
  /** Show keyboard shortcut hint (for button trigger) */
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
  /** Size for icon/button triggers */
  size?: 'sm' | 'md' | 'lg';
  /** Variant for button triggers */
  variant?: 'default' | 'ghost' | 'minimal';
  /** Available search scopes */
  scopes?: SearchScope[];
  /** Empty state configuration */
  emptyStateConfig?: EmptyStateConfig;
}

export const OttaSearch: React.FC<OttaSearchProps> = ({
  adapter,
  trigger = 'button',
  display = 'modal',
  placeholder = 'Search...',
  showShortcut = true,
  onSelect,
  className,
  debounceMs = 300,
  autoSearch = true,
  minQueryLength = 1,
  size = 'md',
  variant = 'default',
  scopes,
  emptyStateConfig,
}) => {
  const triggerRef = useRef<HTMLDivElement>(null);

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
    activeScope,
    setQuery,
    open,
    close,
    focusNext,
    focusPrevious,
    selectFocused,
    selectResult,
    clearHistory,
    setActiveScope,
  } = searchState;

  // Handle result selection
  const handleSelectResult = (result: any) => {
    selectResult(result);
    if (onSelect) {
      onSelect(result);
    }
  };

  // Setup keyboard navigation
  const enableGlobalShortcut = trigger === 'button' && display === 'modal';
  useKeyboardNavigation({
    isOpen,
    onOpen: open,
    onClose: close,
    onNext: focusNext,
    onPrevious: focusPrevious,
    onSelect: selectFocused,
    enableShortcut: enableGlobalShortcut,
  });

  // Handle keyboard events in popover mode
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusPrevious();
        break;
      case 'Enter':
        e.preventDefault();
        selectFocused();
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
    }
  };

  // Render different combinations of trigger + display

  // Input trigger (works with both modal and popover)
  if (trigger === 'input' && display === 'popover') {
    return (
      <div ref={triggerRef} className={className}>
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
        />
      </div>
    );
  }

  // Icon trigger with popover
  if ((trigger === 'icon' || trigger === 'icon-input') && display === 'popover') {
    return (
      <div className={className}>
        <div className="relative">
          <SearchIconTrigger
            ref={triggerRef}
            isOpen={isOpen}
            onOpen={open}
            onClose={close}
            query={query}
            onQueryChange={setQuery}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            expandable={trigger === 'icon-input'}
            size={size}
            variant={variant === 'default' ? 'default' : 'ghost'}
          />
          <SearchPopover
            isOpen={isOpen}
            onClose={close}
            groupedResults={groupedResults}
            isLoading={isLoading}
            error={error}
            focusedIndex={focusedIndex}
            onSelectResult={handleSelectResult}
            anchorRef={triggerRef}
            query={query}
            emptyStateConfig={emptyStateConfig}
          />
        </div>
      </div>
    );
  }

  // Input trigger with modal
  if (trigger === 'input' && display === 'modal') {
    return (
      <>
        <div ref={triggerRef} className={className}>
          <button
            onClick={open}
            className="w-full px-3 py-2 text-left text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors text-gray-500 dark:text-gray-400"
          >
            {placeholder}
          </button>
        </div>
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
          emptyStateConfig={emptyStateConfig}
          scopes={scopes}
          activeScope={activeScope}
          onScopeChange={setActiveScope}
        />
      </>
    );
  }

  // Button trigger with modal (default)
  return (
    <>
      <SearchButton
        onClick={open}
        showShortcut={showShortcut && display === 'modal'}
        className={className}
        variant={variant}
        size={size}
      />
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
        emptyStateConfig={emptyStateConfig}
        scopes={scopes}
        activeScope={activeScope}
        onScopeChange={setActiveScope}
      />
    </>
  );
};

export default OttaSearch;

/**
 * @ottabase/ottasearch
 * Universal search component for Ottabase applications
 */

// Main component
export {
  OttaSearch,
  SearchModal,
  SearchButton,
  SearchInput,
  SearchPopover,
  SearchIconTrigger,
} from './components';
export type {
  OttaSearchProps,
  SearchModalProps,
  SearchButtonProps,
  SearchInputProps,
  SearchPopoverProps,
  SearchIconTriggerProps,
} from './components';

// Adapters
export { createMockAdapter } from './adapters';
export type { MockAdapterConfig } from './adapters';

// Types
export type {
  SearchAdapter,
  SearchResult,
  SearchOptions,
  GroupedResults,
  SearchState,
  SearchActions,
  SearchContextValue,
} from './types';

// Hooks
export { useSearch, useKeyboardNavigation } from './hooks';
export type { UseSearchOptions, UseKeyboardNavigationOptions } from './hooks';

// Utils
export {
  groupResults,
  debounce,
  highlightText,
  getCommandKey,
  isCommandKey,
  flattenResults,
  filterByCategory,
  clientSearch,
} from './utils';

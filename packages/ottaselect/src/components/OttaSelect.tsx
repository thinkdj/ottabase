import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { Search, X, ChevronDown, Loader2, Check } from "lucide-react";
import { clsx } from "clsx";

// Output format - always standardized with id and name
export interface OttaSelectItem extends Record<string, any> {
  id: string;
  name: string;
}

// Input can be any object with id and name/label/title
export type OttaSelectInputItem = Record<string, any>;

export interface OttaSelectProps {
  // Mode configuration
  mode?: "single" | "multiple";

  // Value management - always returns with normalized id and name
  value?: OttaSelectItem | OttaSelectItem[] | null;
  onChange?: (value: OttaSelectItem | OttaSelectItem[] | null) => void;

  // Data source - accepts any object with id and name/label/title
  items?: OttaSelectInputItem[];
  fetchCollection?: (searchQuery: string) => Promise<OttaSelectInputItem[]>;

  // Search configuration
  searchable?: boolean;
  searchDebounceMs?: number;
  searchPlaceholder?: string;

  // UI customization
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;

  // Styling
  className?: string;
  dropdownClassName?: string;

  // Display options
  maxDisplayItems?: number;
  emptyMessage?: string;
  loadingMessage?: string;
  errorMessage?: string;
}

// Helper function to normalize input items to standard format
const normalizeItem = (item: OttaSelectInputItem): OttaSelectItem => {
  // Extract id - must exist
  const id = item.id?.toString() || "";

  // Extract display name with fallbacks: name -> label -> title
  const name = item.name || item.label || item.title || "";

  // Return the original object with normalized id and name
  return {
    ...item,
    id,
    name: String(name),
  };
};

export const OttaSelect: React.FC<OttaSelectProps> = ({
  mode = "single",
  value = null,
  onChange,
  items = [],
  fetchCollection,
  searchable = true,
  searchDebounceMs = 300,
  searchPlaceholder = "Search...",
  placeholder = "Select an option",
  disabled = false,
  clearable = true,
  header,
  footer,
  className,
  dropdownClassName,
  maxDisplayItems = 100,
  emptyMessage = "No options found",
  loadingMessage = "Loading...",
  errorMessage = "Error loading options",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedItems, setFetchedItems] = useState<OttaSelectItem[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize static items
  const normalizedStaticItems = useMemo(() => {
    return items.map(normalizeItem);
  }, [items]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, searchDebounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, searchDebounceMs]);

  // Fetch collection when search query changes
  useEffect(() => {
    if (!fetchCollection || !isOpen) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const results = await fetchCollection(debouncedSearchQuery);
        // Normalize fetched items
        const normalizedResults = results.map(normalizeItem);
        setFetchedItems(normalizedResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : errorMessage);
        setFetchedItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [debouncedSearchQuery, fetchCollection, isOpen, errorMessage]);

  // Get normalized selected items
  const selectedItems = useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  // Merge selected items with available items (selected items always visible)
  const allItems = useMemo(() => {
    const itemsSource = fetchCollection ? fetchedItems : normalizedStaticItems;
    const itemsMap = new Map<string, OttaSelectItem>();

    // Add selected items first (they should always be visible)
    selectedItems.forEach((item) => {
      itemsMap.set(item.id, item);
    });

    // Add available items
    itemsSource.forEach((item) => {
      if (!itemsMap.has(item.id)) {
        itemsMap.set(item.id, item);
      }
    });

    return Array.from(itemsMap.values());
  }, [normalizedStaticItems, fetchedItems, selectedItems, fetchCollection]);

  // Filter items based on search query (client-side filtering for static items)
  const filteredItems = useMemo(() => {
    if (!searchQuery || fetchCollection) {
      return allItems.slice(0, maxDisplayItems);
    }

    const query = searchQuery.toLowerCase();
    return allItems
      .filter((item) => item.name.toLowerCase().includes(query))
      .slice(0, maxDisplayItems);
  }, [allItems, searchQuery, fetchCollection, maxDisplayItems]);

  // Check if item is selected
  const isSelected = useCallback(
    (item: OttaSelectItem) => {
      return selectedItems.some((selected) => selected.id === item.id);
    },
    [selectedItems],
  );

  // Handle item selection
  const handleSelect = useCallback(
    (item: OttaSelectItem) => {
      if (!onChange) return;

      if (mode === "single") {
        onChange(item);
        setIsOpen(false);
        setSearchQuery("");
      } else {
        const isItemSelected = isSelected(item);
        if (isItemSelected) {
          const newValue = selectedItems.filter(
            (selected) => selected.id !== item.id,
          );
          onChange(newValue.length > 0 ? newValue : null);
        } else {
          onChange([...selectedItems, item]);
        }
      }
    },
    [mode, onChange, selectedItems, isSelected],
  );

  // Handle clear
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onChange) {
        onChange(null);
      }
      setSearchQuery("");
    },
    [onChange],
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < filteredItems.length - 1 ? prev + 1 : prev,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < filteredItems.length) {
            handleSelect(filteredItems[focusedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setSearchQuery("");
          break;
      }
    },
    [isOpen, filteredItems, focusedIndex, handleSelect],
  );

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && dropdownRef.current) {
      const focusedElement = dropdownRef.current.querySelector(
        `[data-index="${focusedIndex}"]`,
      ) as HTMLElement;

      if (focusedElement) {
        focusedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [focusedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        // Clear search query when closing if no selection
        if (mode === "single" && !value) {
          setSearchQuery("");
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mode, value]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Reset focused index when filtered items change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [filteredItems]);

  // Get display text
  const displayText = useMemo(() => {
    if (mode === "single") {
      return selectedItems[0]?.name || placeholder;
    }

    if (selectedItems.length === 0) return placeholder;
    if (selectedItems.length === 1) return selectedItems[0].name;
    return `${selectedItems.length} items selected`;
  }, [mode, selectedItems, placeholder]);

  const hasValue = selectedItems.length > 0;

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative w-full",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "w-full px-3 py-2 text-left",
          "bg-white dark:bg-gray-800",
          "border border-gray-300 dark:border-gray-600",
          "text-gray-900 dark:text-gray-100",
          "rounded-lg",
          "hover:border-gray-400 dark:hover:border-gray-500",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent",
          "transition-colors duration-150",
          "flex items-center justify-between gap-2",
          disabled && "cursor-not-allowed",
          !hasValue && "text-gray-500 dark:text-gray-400",
        )}
      >
        <span className="truncate flex-1">{displayText}</span>

        <div className="flex items-center gap-1 flex-shrink-0">
          {clearable && hasValue && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer"
              role="button"
              aria-label="Clear selection"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClear(e as any);
                }
              }}
            >
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </span>
          )}

          <ChevronDown
            className={clsx(
              "w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200",
              isOpen && "transform rotate-180",
            )}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={clsx(
            "absolute z-50 w-full mt-2",
            "bg-white dark:bg-gray-800",
            "border border-gray-200 dark:border-gray-700",
            "rounded-lg shadow-lg dark:shadow-gray-900/50",
            "max-h-80 overflow-hidden flex flex-col",
            dropdownClassName,
          )}
        >
          {/* Header */}
          {header && (
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              {header}
            </div>
          )}

          {/* Search Input */}
          {searchable && (
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={clsx(
                    "w-full pl-8 pr-3 py-1.5 text-sm rounded",
                    "bg-white dark:bg-gray-900",
                    "border border-gray-300 dark:border-gray-600",
                    "text-gray-900 dark:text-gray-100",
                    "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent",
                  )}
                />
              </div>
            </div>
          )}

          {/* Items List */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                {loadingMessage}
              </div>
            ) : error ? (
              <div className="px-3 py-8 text-center text-sm text-red-500 dark:text-red-400">
                {error}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {emptyMessage}
              </div>
            ) : (
              <div className="py-1">
                {filteredItems.map((item, index) => {
                  const selected = isSelected(item);
                  const focused = index === focusedIndex;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-index={index}
                      onClick={() => handleSelect(item)}
                      className={clsx(
                        "w-full px-3 py-2 text-left text-sm",
                        "text-gray-900 dark:text-gray-100",
                        "hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                        "flex items-center justify-between gap-2",
                        focused && "bg-gray-100 dark:bg-gray-700",
                        selected &&
                          "bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50",
                      )}
                    >
                      <span className="truncate flex-1">{item.name}</span>
                      {selected && (
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OttaSelect;

import { clsx } from "clsx";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Output format - always standardized with id and name
export interface OttaSelectItem extends Record<string, any> {
  id: string;
  name: string;
}

// Input can be any object with id and name/label/title
export type OttaSelectInputItem = Record<string, any>;

// Custom renderer props passed to renderItem
export interface ItemRendererProps {
  item: OttaSelectItem;
  isSelected: boolean;
  isFocused: boolean;
}

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

  // Custom rendering
  /**
   * Custom renderer for dropdown items.
   * Example: (props) => <div>{props.item.flag} {props.item.name}</div>
   */
  renderItem?: (props: ItemRendererProps) => React.ReactNode;

  /**
   * Custom renderer for the selected value display in the trigger button.
   * For single mode, receives the selected item. For multiple mode, receives the first item.
   * Example: (item) => <div>{item.flag} {item.name}</div>
   */
  renderValue?: (item: OttaSelectItem) => React.ReactNode;

  /**
   * Custom renderer for selected chips in multiple mode.
   * If not provided, defaults to showing item.name.
   */
  renderChip?: (item: OttaSelectItem) => React.ReactNode;

  // Styling
  className?: string;
  dropdownClassName?: string;

  // Display options
  maxDisplayItems?: number;
  emptyMessage?: string;
  loadingMessage?: string;
  errorMessage?: string;

  /**
   * Show selected items at the top of the dropdown list.
   * Useful when using pagination where selected items might not be in current page.
   * Default: true
   */
  showSelectedFirst?: boolean;

  /**
   * For multiple mode: show selected items as chips instead of "N items selected".
   * Chips will overflow with "+N more" when space runs out.
   * Default: true
   */
  showChips?: boolean;
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

// Chip component for multi-select display
const Chip = ({
  item,
  renderChip,
  onRemove,
  disabled,
}: {
  item: OttaSelectItem;
  renderChip?: (item: OttaSelectItem) => React.ReactNode;
  onRemove?: (e: React.MouseEvent, item: OttaSelectItem) => void;
  disabled?: boolean;
}) => {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 text-sm",
        "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200",
        "rounded-md whitespace-nowrap"
      )}
    >
      {renderChip ? renderChip(item) : item.name}
      {onRemove && !disabled && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => onRemove(e, item)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onRemove(e as any, item);
            }
          }}
          className="ml-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
        </span>
      )}
    </span>
  );
};

export function OttaSelect({
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
  renderItem,
  renderValue,
  renderChip,
  className,
  dropdownClassName,
  maxDisplayItems = 100,
  emptyMessage = "No options found",
  loadingMessage = "Loading...",
  errorMessage = "Error loading options",
  showSelectedFirst = true,
  showChips = true,
}: OttaSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedItems, setFetchedItems] = useState<OttaSelectItem[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [visibleChipCount, setVisibleChipCount] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const chipsContainerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

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

  // Create a set of selected IDs for fast lookup
  const selectedIds = useMemo(() => {
    return new Set(selectedItems.map((item) => item.id));
  }, [selectedItems]);

  // Merge selected items with available items
  // Selected items are ALWAYS included, even if not in current API response (pagination case)
  const allItems = useMemo(() => {
    const itemsSource = fetchCollection ? fetchedItems : normalizedStaticItems;
    const itemsMap = new Map<string, OttaSelectItem>();
    const selectedNotInSource: OttaSelectItem[] = [];

    // First pass: identify selected items not in source
    selectedItems.forEach((item) => {
      const inSource = itemsSource.some(
        (sourceItem) => sourceItem.id === item.id,
      );
      if (!inSource) {
        selectedNotInSource.push(item);
      }
    });

    // Build the items list
    if (showSelectedFirst) {
      // Add all selected items first (including those not in current page)
      selectedItems.forEach((item) => {
        itemsMap.set(item.id, item);
      });

      // Then add remaining items from source (excluding already added selected ones)
      itemsSource.forEach((item) => {
        if (!itemsMap.has(item.id)) {
          itemsMap.set(item.id, item);
        }
      });
    } else {
      // Add items from source first
      itemsSource.forEach((item) => {
        itemsMap.set(item.id, item);
      });

      // Ensure selected items not in source are still included (append at end)
      selectedNotInSource.forEach((item) => {
        if (!itemsMap.has(item.id)) {
          itemsMap.set(item.id, item);
        }
      });
    }

    return Array.from(itemsMap.values());
  }, [
    normalizedStaticItems,
    fetchedItems,
    selectedItems,
    fetchCollection,
    showSelectedFirst,
  ]);

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
  const isItemSelected = useCallback(
    (item: OttaSelectItem) => {
      return selectedIds.has(item.id);
    },
    [selectedIds],
  );

  // Handle removing a chip
  const handleRemoveChip = useCallback(
    (e: React.MouseEvent, item: OttaSelectItem) => {
      e.stopPropagation();
      if (!onChange) return;

      const newValue = selectedItems.filter(
        (selected) => selected.id !== item.id,
      );
      onChange(newValue.length > 0 ? newValue : null);
    },
    [onChange, selectedItems],
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
        const isSelected = isItemSelected(item);
        if (isSelected) {
          const newValue = selectedItems.filter(
            (selected) => selected.id !== item.id,
          );
          onChange(newValue.length > 0 ? newValue : null);
        } else {
          onChange([...selectedItems, item]);
        }
      }
    },
    [mode, onChange, selectedItems, isItemSelected],
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

  // Calculate how many chips can fit
  useLayoutEffect(() => {
    if (mode !== "multiple" || !showChips || selectedItems.length === 0) {
      setVisibleChipCount(null);
      return;
    }

    const calculateVisibleChips = () => {
      if (!chipsContainerRef.current || !measureRef.current) return;

      const containerWidth = chipsContainerRef.current.offsetWidth;
      // Reserve space for "+N more" badge and some padding
      const reservedWidth = 70;
      const availableWidth = containerWidth - reservedWidth;

      let usedWidth = 0;
      let count = 0;
      const gap = 4; // gap between chips

      // Measure each chip
      const measureContainer = measureRef.current;
      measureContainer.innerHTML = "";

      for (const item of selectedItems) {
        // Create a temporary chip to measure
        const chipEl = document.createElement("span");
        chipEl.className =
          "inline-flex items-center gap-1 px-2 py-0.5 text-sm rounded-md whitespace-nowrap";
        chipEl.textContent = item.name;
        measureContainer.appendChild(chipEl);

        const chipWidth = chipEl.offsetWidth + (count > 0 ? gap : 0);

        if (usedWidth + chipWidth <= availableWidth) {
          usedWidth += chipWidth;
          count++;
        } else {
          break;
        }
      }

      // Show at least 1 chip if there's any selection
      setVisibleChipCount(Math.max(1, count));
    };

    calculateVisibleChips();

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(calculateVisibleChips);
    if (chipsContainerRef.current) {
      resizeObserver.observe(chipsContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [mode, showChips, selectedItems]);

  // Get display text/content
  const displayContent = useMemo(() => {
    if (mode === "single") {
      if (selectedItems.length === 0) {
        return (
          <span className="text-gray-500 dark:text-gray-400">
            {placeholder}
          </span>
        );
      }
      if (renderValue) {
        return renderValue(selectedItems[0]);
      }
      return selectedItems[0].name;
    }

    // Multiple mode
    if (selectedItems.length === 0) {
      return (
        <span className="text-gray-500 dark:text-gray-400">{placeholder}</span>
      );
    }

    // Show chips mode
    if (showChips) {
      const visibleItems =
        visibleChipCount !== null
          ? selectedItems.slice(0, visibleChipCount)
          : selectedItems;
      const hiddenCount = selectedItems.length - visibleItems.length;

      return (
        <div
          ref={chipsContainerRef}
          className="flex items-center gap-1 flex-1 overflow-hidden"
        >
          {visibleItems.map((item, index) => (
            <Chip
              key={item.id || `chip-${index}`}
              item={item}
              renderChip={renderChip}
              onRemove={handleRemoveChip}
              disabled={disabled}
            />
          ))}
          {hiddenCount > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              +{hiddenCount} more
            </span>
          )}
        </div>
      );
    }

    // Fallback to text display
    if (selectedItems.length === 1) {
      if (renderValue) {
        return renderValue(selectedItems[0]);
      }
      return selectedItems[0].name;
    }
    return `${selectedItems.length} items selected`;
  }, [
    mode,
    selectedItems,
    placeholder,
    renderValue,
    renderChip,
    showChips,
    visibleChipCount,
    handleRemoveChip,
    disabled,
  ]);

  const hasValue = selectedItems.length > 0;

  // Default item renderer
  const defaultRenderItem = useCallback((props: ItemRendererProps) => {
    return <span className="truncate flex-1">{props.item.name}</span>;
  }, []);

  const itemRenderer = renderItem || defaultRenderItem;

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
      {/* Hidden measure container */}
      <div
        ref={measureRef}
        className="absolute -left-[9999px] flex items-center gap-1"
        aria-hidden="true"
      />

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "w-full px-3 py-2 text-left min-h-[42px]",
          "bg-white dark:bg-gray-800",
          "border border-gray-300 dark:border-gray-600",
          "text-gray-900 dark:text-gray-100",
          "rounded-lg",
          "hover:border-gray-400 dark:hover:border-gray-500",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent",
          "transition-colors duration-150",
          "flex items-center justify-between gap-2",
          disabled && "cursor-not-allowed",
        )}
      >
        <span className={clsx("flex-1", mode === "single" && "truncate")}>
          {displayContent}
        </span>

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
                  const selected = isItemSelected(item);
                  const focused = index === focusedIndex;

                  return (
                    <button
                      key={item.id || `item-${index}`}
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
                      {itemRenderer({
                        item,
                        isSelected: selected,
                        isFocused: focused,
                      })}
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
}

export default OttaSelect;

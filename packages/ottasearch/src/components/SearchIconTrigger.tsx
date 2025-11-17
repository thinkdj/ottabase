/**
 * SearchIconTrigger - Minimal icon trigger for search
 * Can be used standalone or with popover
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { clsx } from 'clsx';

export interface SearchIconTriggerProps {
  /** Whether search is open/active */
  isOpen: boolean;
  /** Open handler */
  onOpen: () => void;
  /** Close handler */
  onClose: () => void;
  /** Search query */
  query: string;
  /** Query change handler */
  onQueryChange: (query: string) => void;
  /** Keyboard event handler */
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Show as icon only (expands on click) or always show input */
  expandable?: boolean;
  /** Custom className */
  className?: string;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Variant */
  variant?: 'default' | 'ghost';
}

export const SearchIconTrigger = React.forwardRef<
  HTMLDivElement,
  SearchIconTriggerProps
>(
  (
    {
      isOpen,
      onOpen,
      onClose,
      query,
      onQueryChange,
      onKeyDown,
      placeholder = 'Search...',
      expandable = true,
      className,
      size = 'md',
      variant = 'default',
    },
    ref
  ) => {
    const [isExpanded, setIsExpanded] = useState(!expandable);
    const inputRef = useRef<HTMLInputElement>(null);

    const sizeClasses = {
      sm: 'h-8',
      md: 'h-9',
      lg: 'h-10',
    };

    const iconSizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    };

    const variantClasses = {
      default: clsx(
        'bg-white dark:bg-gray-800',
        'border border-gray-300 dark:border-gray-600',
        'hover:border-gray-400 dark:hover:border-gray-500'
      ),
      ghost: clsx(
        'bg-transparent',
        'border border-transparent',
        'hover:bg-gray-100 dark:hover:bg-gray-800'
      ),
    };

    // Auto-expand when opened
    useEffect(() => {
      if (isOpen && expandable) {
        setIsExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }, [isOpen, expandable]);

    // Focus input when expanded
    useEffect(() => {
      if (isExpanded && inputRef.current) {
        inputRef.current.focus();
      }
    }, [isExpanded]);

    const handleIconClick = () => {
      if (expandable && !isExpanded) {
        setIsExpanded(true);
        onOpen();
      } else if (!isOpen) {
        onOpen();
      }
    };

    const handleClose = () => {
      onQueryChange('');
      onClose();
      if (expandable) {
        setIsExpanded(false);
      }
    };

    return (
      <div
        ref={ref}
        className={clsx(
          'relative flex items-center gap-2',
          'rounded-lg transition-all duration-200',
          sizeClasses[size],
          variantClasses[variant],
          isExpanded ? 'w-full max-w-md' : 'w-auto',
          className
        )}
      >
        {/* Icon */}
        <button
          type="button"
          onClick={handleIconClick}
          className={clsx(
            'flex items-center justify-center flex-shrink-0',
            'text-gray-500 dark:text-gray-400',
            'hover:text-gray-700 dark:hover:text-gray-300',
            'transition-colors',
            isExpanded ? 'px-3' : 'px-2.5'
          )}
          aria-label="Search"
        >
          <Search className={iconSizeClasses[size]} />
        </button>

        {/* Input (expanded state) */}
        {isExpanded && (
          <>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={onOpen}
              placeholder={placeholder}
              className={clsx(
                'flex-1 text-sm',
                'bg-transparent',
                'text-gray-900 dark:text-gray-100',
                'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                'focus:outline-none',
                'pr-2'
              )}
            />

            {/* Clear button */}
            {query && (
              <button
                type="button"
                onClick={handleClose}
                className={clsx(
                  'flex items-center justify-center flex-shrink-0 px-2',
                  'text-gray-400 dark:text-gray-500',
                  'hover:text-gray-600 dark:hover:text-gray-300',
                  'transition-colors'
                )}
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>
    );
  }
);

SearchIconTrigger.displayName = 'SearchIconTrigger';

export default SearchIconTrigger;

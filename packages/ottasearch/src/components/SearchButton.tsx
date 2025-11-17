/**
 * SearchButton - Simple button to trigger search modal
 */

import React from 'react';
import { Search } from 'lucide-react';
import { clsx } from 'clsx';
import { getCommandKey } from '../utils';

export interface SearchButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Show keyboard shortcut hint */
  showShortcut?: boolean;
  /** Custom className */
  className?: string;
  /** Button variant */
  variant?: 'default' | 'ghost' | 'minimal';
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Disabled state */
  disabled?: boolean;
}

export const SearchButton: React.FC<SearchButtonProps> = ({
  onClick,
  showShortcut = true,
  className,
  variant = 'default',
  size = 'md',
  disabled = false,
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1.5 text-sm gap-2',
    md: 'px-3 py-2 text-sm gap-2',
    lg: 'px-4 py-2.5 text-base gap-3',
  };

  const variantClasses = {
    default: clsx(
      'bg-white dark:bg-gray-800',
      'border border-gray-300 dark:border-gray-600',
      'text-gray-700 dark:text-gray-300',
      'hover:bg-gray-50 dark:hover:bg-gray-700',
      'hover:border-gray-400 dark:hover:border-gray-500',
      'shadow-sm'
    ),
    ghost: clsx(
      'bg-transparent',
      'border border-transparent',
      'text-gray-600 dark:text-gray-400',
      'hover:bg-gray-100 dark:hover:bg-gray-800',
      'hover:text-gray-900 dark:hover:text-gray-100'
    ),
    minimal: clsx(
      'bg-transparent',
      'border border-transparent',
      'text-gray-500 dark:text-gray-400',
      'hover:text-gray-900 dark:hover:text-gray-100'
    ),
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex items-center justify-between',
        'rounded-lg',
        'transition-colors duration-150',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4" />
        <span>Search</span>
      </div>
      {showShortcut && !disabled && (
        <kbd
          className={clsx(
            'hidden sm:inline-flex items-center gap-0.5',
            'px-1.5 py-0.5 text-xs font-mono',
            'bg-gray-100 dark:bg-gray-700',
            'border border-gray-300 dark:border-gray-600',
            'rounded'
          )}
        >
          <span className="text-xs">{getCommandKey()}</span>K
        </kbd>
      )}
    </button>
  );
};

export default SearchButton;

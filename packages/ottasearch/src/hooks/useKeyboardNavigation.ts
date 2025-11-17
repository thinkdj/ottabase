/**
 * useKeyboardNavigation hook
 * Handles keyboard shortcuts and navigation for search
 */

import { useEffect, useCallback } from 'react';
import { isCommandKey } from '../utils';

export interface UseKeyboardNavigationOptions {
  /** Whether modal is open */
  isOpen: boolean;
  /** Open modal handler */
  onOpen: () => void;
  /** Close modal handler */
  onClose: () => void;
  /** Navigate to next result */
  onNext: () => void;
  /** Navigate to previous result */
  onPrevious: () => void;
  /** Select current result */
  onSelect: () => void;
  /** Whether to enable Cmd/Ctrl+K shortcut */
  enableShortcut?: boolean;
}

export function useKeyboardNavigation(options: UseKeyboardNavigationOptions) {
  const {
    isOpen,
    onOpen,
    onClose,
    onNext,
    onPrevious,
    onSelect,
    enableShortcut = true,
  } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Global shortcut: Cmd/Ctrl+K to open modal
      if (enableShortcut && isCommandKey(event) && event.key === 'k') {
        event.preventDefault();
        if (!isOpen) {
          onOpen();
        }
        return;
      }

      // Only handle these keys when modal is open
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          onNext();
          break;

        case 'ArrowUp':
          event.preventDefault();
          onPrevious();
          break;

        case 'Enter':
          event.preventDefault();
          onSelect();
          break;

        case 'Escape':
          event.preventDefault();
          onClose();
          break;

        default:
          break;
      }
    },
    [isOpen, onOpen, onClose, onNext, onPrevious, onSelect, enableShortcut]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

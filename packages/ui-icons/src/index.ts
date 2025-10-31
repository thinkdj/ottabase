/**
 * @ottabase/ui-icons
 *
 * Unified icon system for Ottabase applications
 * Provides a consistent API for Lucide, Tabler, and custom icons
 */

// Export types
export type {
  IconComponent,
  IconProps,
  IconMeta,
  IconRegistryEntry,
  IconRegistry,
} from './types';

export { IconSource } from './types';

// Export utility functions
export {
  normalizeSize,
  createLucideWrapper,
  createTablerWrapper,
  isValidIconComponent,
} from './utils';

// Export Lucide icons
export {
  Icons,
  getLucideIcon,
  hasLucideIcon,
  type LucideIconName,
} from './lucide';

// Export Tabler icons
export {
  TablerIconSet,
  getTablerIcon,
  hasTablerIcon,
  type TablerIconName,
} from './tabler';

// Export custom icon support
export {
  registerCustomIcon,
  getCustomIcon,
  hasCustomIcon,
  getCustomIconNames,
  unregisterCustomIcon,
  clearCustomIcons,
  getCustomIconRegistry,
  createSvgIcon,
} from './custom';

// Re-export commonly used icons as a unified set
// This provides a curated, opinionated selection combining the best from both libraries
import { Icons as LucideIcons, getLucideIcon, hasLucideIcon } from './lucide';
import { TablerIconSet, getTablerIcon, hasTablerIcon } from './tabler';
import { getCustomIcon, hasCustomIcon } from './custom';
import type { IconComponent } from './types';

/**
 * Unified icon set combining Lucide and Tabler icons
 * This is the recommended way to import icons for consistency across the app
 *
 * @example
 * ```tsx
 * import { Icon } from '@ottabase/ui-icons';
 *
 * function MyComponent() {
 *   return <Icon.Home size={24} color="blue" />;
 * }
 * ```
 */
export const Icon = {
  // Prefer Lucide for most common icons (they're simpler and more consistent)
  ...LucideIcons,

  // Add specific Tabler icons that might be better or not available in Lucide
  // Users can override by importing from TablerIconSet directly if needed
} as const;

// Default export for convenient usage
export default Icon;

/**
 * Get an icon from any source by name
 * Searches in order: Custom -> Lucide -> Tabler
 *
 * @example
 * ```tsx
 * const HomeIcon = getIcon('Home'); // Returns Lucide Home icon
 * const MyIcon = getIcon('my-custom-icon'); // Returns custom icon if registered
 * ```
 */
export function getIcon(name: string): IconComponent | undefined {
  // Search order: Custom -> Lucide -> Tabler
  return (
    getCustomIcon(name) ||
    getLucideIcon(name as any) ||
    getTablerIcon(name as any)
  );
}

/**
 * Check if an icon exists in any registry
 */
export function hasIcon(name: string): boolean {
  return hasCustomIcon(name) || hasLucideIcon(name) || hasTablerIcon(name);
}

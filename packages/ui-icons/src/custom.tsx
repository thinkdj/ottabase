/**
 * Custom icon support for Ottabase
 * Allows registering custom SVG icons with the same API as Lucide and Tabler
 */

import React from 'react';
import type { IconComponent, IconProps, IconRegistry, IconRegistryEntry, IconSource } from './types';

/**
 * Global registry for custom icons
 */
const customIconRegistry: IconRegistry = new Map();

/**
 * Register a custom icon component
 *
 * @example
 * ```tsx
 * import { registerCustomIcon } from '@ottabase/ui-icons';
 *
 * const MyIcon = (props: IconProps) => (
 *   <svg {...props} viewBox="0 0 24 24">
 *     <path d="..." />
 *   </svg>
 * );
 *
 * registerCustomIcon('my-icon', MyIcon, { tags: ['custom', 'brand'] });
 * ```
 */
export function registerCustomIcon(
  name: string,
  component: IconComponent,
  options?: {
    tags?: string[];
    originalName?: string;
  }
): void {
  const entry: IconRegistryEntry = {
    component,
    meta: {
      source: 'custom' as IconSource,
      originalName: options?.originalName || name,
      name,
      tags: options?.tags,
    },
  };

  customIconRegistry.set(name, entry);
}

/**
 * Get a custom icon by name
 */
export function getCustomIcon(name: string): IconComponent | undefined {
  return customIconRegistry.get(name)?.component;
}

/**
 * Check if a custom icon exists
 */
export function hasCustomIcon(name: string): boolean {
  return customIconRegistry.has(name);
}

/**
 * Get all registered custom icon names
 */
export function getCustomIconNames(): string[] {
  return Array.from(customIconRegistry.keys());
}

/**
 * Unregister a custom icon
 */
export function unregisterCustomIcon(name: string): boolean {
  return customIconRegistry.delete(name);
}

/**
 * Clear all custom icons
 */
export function clearCustomIcons(): void {
  customIconRegistry.clear();
}

/**
 * Get the full custom icon registry
 */
export function getCustomIconRegistry(): IconRegistry {
  return new Map(customIconRegistry);
}

/**
 * Helper to create a simple SVG icon component
 *
 * @example
 * ```tsx
 * const MyIcon = createSvgIcon(
 *   <path d="M12 2L2 7l10 5 10-5-10-5z" />,
 *   'MyIcon'
 * );
 * ```
 */
export function createSvgIcon(
  children: React.ReactNode,
  displayName?: string
): IconComponent {
  const SvgIcon: IconComponent = ({
    size = 24,
    color = 'currentColor',
    className,
    style,
    ...props
  }: IconProps) => {
    const numericSize = typeof size === 'number' ? size : parseInt(String(size), 10) || 24;

    return (
      <svg
        width={numericSize}
        height={numericSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        {...props}
      >
        {children}
      </svg>
    );
  };

  if (displayName) {
    SvgIcon.displayName = displayName;
  }

  return SvgIcon;
}

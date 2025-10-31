import type { ComponentType, SVGProps } from 'react';

/**
 * Standard icon component type that all icons in the system conform to.
 * This allows for consistent usage across different icon libraries.
 */
export type IconComponent = ComponentType<IconProps>;

/**
 * Props accepted by all icon components in the unified icon system.
 * Extends standard SVG props for maximum flexibility.
 */
export interface IconProps extends SVGProps<SVGSVGElement> {
  /**
   * Size of the icon in pixels or as a string (e.g., "24px", "1.5rem")
   * @default 24
   */
  size?: number | string;

  /**
   * Color of the icon. Can be any valid CSS color value.
   * @default "currentColor"
   */
  color?: string;

  /**
   * Stroke width for outline icons
   * @default 2 (for Lucide), 1.5 (for Tabler)
   */
  strokeWidth?: number;

  /**
   * Additional CSS class name(s)
   */
  className?: string;

  /**
   * Inline styles
   */
  style?: React.CSSProperties;
}

/**
 * Icon source enum to identify which library an icon comes from
 */
export enum IconSource {
  LUCIDE = 'lucide',
  TABLER = 'tabler',
  CUSTOM = 'custom',
}

/**
 * Metadata about an icon
 */
export interface IconMeta {
  /**
   * The source library of the icon
   */
  source: IconSource;

  /**
   * Original name from the source library
   */
  originalName: string;

  /**
   * Unified name in the ottabase icon system
   */
  name: string;

  /**
   * Optional tags for categorization
   */
  tags?: string[];
}

/**
 * Icon registry entry
 */
export interface IconRegistryEntry {
  /**
   * The icon component
   */
  component: IconComponent;

  /**
   * Metadata about the icon
   */
  meta: IconMeta;
}

/**
 * Icon registry type for storing all available icons
 */
export type IconRegistry = Map<string, IconRegistryEntry>;

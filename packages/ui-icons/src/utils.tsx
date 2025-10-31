import React from 'react';
import type { IconProps, IconComponent } from './types';

/**
 * Normalizes size prop to a number value
 */
export function normalizeSize(size?: number | string): number | undefined {
  if (typeof size === 'number') {
    return size;
  }
  if (typeof size === 'string') {
    const parsed = parseInt(size, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Creates a wrapper component that normalizes props for Lucide icons
 */
export function createLucideWrapper(
  LucideIcon: any,
  defaultStrokeWidth = 2
): IconComponent {
  return function WrappedLucideIcon({
    size = 24,
    color = 'currentColor',
    strokeWidth = defaultStrokeWidth,
    className,
    style,
    ...props
  }: IconProps) {
    return (
      <LucideIcon
        size={size}
        color={color}
        strokeWidth={strokeWidth}
        className={className}
        style={style}
        {...props}
      />
    );
  };
}

/**
 * Creates a wrapper component that normalizes props for Tabler icons
 */
export function createTablerWrapper(
  TablerIcon: any,
  defaultStrokeWidth = 1.5
): IconComponent {
  return function WrappedTablerIcon({
    size = 24,
    color = 'currentColor',
    strokeWidth = defaultStrokeWidth,
    className,
    style,
    ...props
  }: IconProps) {
    const numericSize = normalizeSize(size) || 24;

    return (
      <TablerIcon
        size={numericSize}
        color={color}
        stroke={strokeWidth}
        className={className}
        style={style}
        {...props}
      />
    );
  };
}

/**
 * Validates if a component is a valid icon component
 */
export function isValidIconComponent(component: any): component is IconComponent {
  return (
    typeof component === 'function' ||
    (typeof component === 'object' && component !== null)
  );
}

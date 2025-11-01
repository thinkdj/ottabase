"use client";

import { ActionIcon, Switch, Tooltip } from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export type MantineThemeSwitcherProps = {
  /**
   * The type of switcher to render
   * - "button": Action icon button with icon
   * - "switch": Toggle switch with labels
   */
  variant?: "button" | "switch";
  /**
   * Size of the component
   * @default "md"
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /**
   * Tooltip text for button variant
   * @default "Toggle theme"
   */
  tooltip?: string;
  /**
   * Show labels for switch variant
   * @default false
   */
  showLabels?: boolean;
};

/**
 * MantineThemeSwitcher - A Mantine-styled theme switcher component
 *
 * This component integrates with next-themes to provide theme switching
 * functionality using Mantine's ActionIcon or Switch components.
 *
 * Usage:
 * ```tsx
 * // Button variant (icon button)
 * <MantineThemeSwitcher variant="button" />
 *
 * // Switch variant (toggle switch)
 * <MantineThemeSwitcher variant="switch" showLabels />
 * ```
 */
export function MantineThemeSwitcher({
  variant = "button",
  size = "md",
  tooltip = "Toggle theme",
  showLabels = false,
}: MantineThemeSwitcherProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering on client
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isDark = resolvedTheme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  if (variant === "switch") {
    return (
      <Switch
        size={size}
        checked={isDark}
        onChange={toggleTheme}
        onLabel={showLabels ? <IconMoon size={16} /> : undefined}
        offLabel={showLabels ? <IconSun size={16} /> : undefined}
        aria-label={tooltip}
      />
    );
  }

  return (
    <Tooltip label={tooltip} position="bottom" withArrow>
      <ActionIcon
        onClick={toggleTheme}
        variant="default"
        size={size}
        aria-label={tooltip}
      >
        {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

export default MantineThemeSwitcher;

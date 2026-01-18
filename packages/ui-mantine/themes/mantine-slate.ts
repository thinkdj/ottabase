import type { MantineThemeOverride } from "@mantine/core";

/**
 * Helper function to create rgba from hex color
 */
const rgba = (color: string, alpha: number): string => {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * A comprehensive Mantine theme built around a neutral slate design system:
 * - Balanced neutral palette with proper semantic colors
 * - Inter font family with optimized typography scale
 * - Subtle shadows and proper focus rings for accessibility
 * - Consistent spacing and border radius system
 * - Comprehensive component overrides matching minimal UI patterns
 * - Proper dark/light mode support with CSS custom properties
 */
export const mantineSlate: MantineThemeOverride = {
  primaryColor: "slate",
  primaryShade: 9,
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
  headings: {
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "2.25rem", lineHeight: "1.2" },
      h2: { fontSize: "1.875rem", lineHeight: "1.3" },
      h3: { fontSize: "1.5rem", lineHeight: "1.4" },
      h4: { fontSize: "1.25rem", lineHeight: "1.5" },
      h5: { fontSize: "1.125rem", lineHeight: "1.5" },
      h6: { fontSize: "1rem", lineHeight: "1.5" },
    },
  },

  // Neutral slate color system
  colors: {
    // Primary neutral palette - Slate
    slate: [
      "#f8fafc",
      "#f1f5f9",
      "#e2e8f0",
      "#cbd5e1",
      "#94a3b8",
      "#64748b",
      "#475569",
      "#334155",
      "#1e293b",
      "#0f172a",
    ],
    // Keep as 'dark' for Mantine compatibility
    dark: [
      "#f8fafc",
      "#f1f5f9",
      "#e2e8f0",
      "#cbd5e1",
      "#94a3b8",
      "#64748b",
      "#475569",
      "#334155",
      "#1e293b",
      "#0f172a",
    ],
    // Accent Blue
    blue: [
      "#eff6ff",
      "#dbeafe",
      "#bfdbfe",
      "#93c5fd",
      "#60a5fa",
      "#3b82f6",
      "#2563eb",
      "#1d4ed8",
      "#1e40af",
      "#1e3a8a",
    ],
    // Success Green
    green: [
      "#f0fdf4",
      "#dcfce7",
      "#bbf7d0",
      "#86efac",
      "#4ade80",
      "#22c55e",
      "#16a34a",
      "#15803d",
      "#166534",
      "#14532d",
    ],
    // Error Red
    red: [
      "#fef2f2",
      "#fecaca",
      "#fca5a5",
      "#f87171",
      "#ef4444",
      "#dc2626",
      "#b91c1c",
      "#991b1b",
      "#7f1d1d",
      "#450a0a",
    ],
    // Warning Yellow
    yellow: [
      "#fefce8",
      "#fef3c7",
      "#fde68a",
      "#fcd34d",
      "#fbbf24",
      "#f59e0b",
      "#d97706",
      "#b45309",
      "#92400e",
      "#78350f",
    ],
  },

  // Slate spacing and radius system
  defaultRadius: "md",
  radius: {
    xs: "0.125rem", // 2px
    sm: "0.25rem", // 4px
    md: "0.375rem", // 6px
    lg: "0.5rem", // 8px
    xl: "0.75rem", // 12px
  },
  spacing: {
    xs: "0.5rem", // 8px
    sm: "0.75rem", // 12px
    md: "1rem", // 16px
    lg: "1.5rem", // 24px
    xl: "2rem", // 32px
  },

  // Enhanced typography scale
  fontSizes: {
    xs: "0.75rem", // 12px
    sm: "0.875rem", // 14px
    md: "1rem", // 16px
    lg: "1.125rem", // 18px
    xl: "1.25rem", // 20px
  },

  lineHeights: {
    xs: "1.4",
    sm: "1.5",
    md: "1.6",
    lg: "1.65",
    xl: "1.7",
  },

  // Subtle shadow system
  shadows: {
    xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    sm: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  },

  // Comprehensive component overrides for the slate aesthetic
  components: {
    Button: {
      defaultProps: {
        radius: "md",
        size: "md",
      } as { radius: string; size: string },
      styles: (theme: any) =>
        ({
          root: {
            fontWeight: "500",
            fontSize: "0.875rem",
            lineHeight: "1.25rem",
            height: "2.5rem",
            paddingLeft: "1rem",
            paddingRight: "1rem",
            borderRadius: theme.radius.md,
            transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
            cursor: "pointer",
            border: "1px solid transparent",
            "&:focus": {
              outline: "none",
              boxShadow: `0 0 0 2px ${theme.colorScheme === "dark" ? "rgba(148, 163, 184, 0.2)" : "hsl(210 40% 60% / 0.2)"}`,
            },
          },
          filled: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[7] : theme.colors.slate[9],
            color: theme.colorScheme === "dark" ? theme.colors.slate[0] : theme.colors.slate[0],
            "&:hover": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[6] : theme.colors.slate[8],
            },
            "&:active": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[5] : theme.colors.slate[9],
            },
          },
          outline: {
            border: "1px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
            color: "var(--mantine-color-text)",
            "&:hover": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[8] : theme.colors.slate[1],
              color: "var(--mantine-color-text)",
            },
          },
          subtle: {
            backgroundColor: "transparent",
            color: "var(--mantine-color-text)",
            "&:hover": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[8] : theme.colors.slate[1],
            },
          },
          light: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[8] : theme.colors.slate[1],
            color: "var(--mantine-color-text)",
            "&:hover": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[7] : theme.colors.slate[2],
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Card: {
      defaultProps: {
        radius: "lg",
        padding: "lg",
        shadow: "sm",
      } as { radius: string; padding: string; shadow: string },
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: "var(--mantine-color-body)",
            border: "1px solid var(--mantine-color-default-border)",
            boxShadow:
              "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
            borderRadius: theme.radius.lg,
            padding: theme.spacing.lg,
          },
        } as Record<string, React.CSSProperties>),
    },

    Paper: {
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: "var(--mantine-color-body)",
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: theme.radius.lg,
          },
        } as Record<string, React.CSSProperties>),
    },

    TextInput: {
      defaultProps: {
        size: "md",
        radius: "md",
      } as { size: string; radius: string },
      styles: (theme: any) =>
        ({
          input: {
            height: "2.5rem",
            borderRadius: theme.radius.md,
            border: "1px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
            fontSize: "0.875rem",
            fontWeight: "400",
            padding: "0.5rem 0.75rem",
            transition: "all 0.15s ease",
            "&:focus": {
              borderColor: theme.colors.slate[5],
              boxShadow: `0 0 0 2px ${rgba(theme.colors.slate[5], 0.2)}`,
              outline: "none",
            },
            "&::placeholder": {
              color: theme.colors.slate[4],
              fontSize: "0.875rem",
            },
          },
          label: {
            fontSize: "0.875rem",
            fontWeight: "500",
            color: "var(--mantine-color-text)",
            marginBottom: "0.5rem",
          },
        } as Record<string, React.CSSProperties>),
    },

    Select: {
      defaultProps: {
        size: "md",
        radius: "md",
      } as { size: string; radius: string },
      styles: (theme: any) =>
        ({
          input: {
            height: "2.5rem",
            borderRadius: theme.radius.md,
            border: "1px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
            fontSize: "0.875rem",
            fontWeight: "400",
            padding: "0.5rem 0.75rem",
            "&:focus": {
              borderColor: "#64748b",
              boxShadow: "0 0 0 2px hsl(215.4 16.3% 46.9% / 0.2)",
            },
          },
          dropdown: {
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: theme.radius.md,
            backgroundColor: "var(--mantine-color-body)",
            padding: "0.25rem",
          },
          item: {
            borderRadius: theme.radius.sm,
            fontSize: "0.875rem",
            padding: "0.5rem 0.75rem",
            "&[data-hovered]": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[8] : theme.colors.slate[1],
              color: "var(--mantine-color-text)",
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Textarea: {
      styles: (theme: any) =>
        ({
          input: {
            borderRadius: theme.radius.md,
            border: "1px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
            fontSize: "0.875rem",
            fontWeight: "400",
            padding: "0.75rem",
            minHeight: "5rem",
            resize: "vertical",
            "&:focus": {
              borderColor: "#64748b",
              boxShadow: "0 0 0 2px hsl(215.4 16.3% 46.9% / 0.2)",
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Badge: {
      defaultProps: {
        radius: "md",
        variant: "light",
      } as { radius: string; variant: string },
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[8] : theme.colors.slate[1],
            color: theme.colorScheme === "dark" ? theme.colors.slate[3] : theme.colors.slate[6],
            border: `1px solid ${theme.colorScheme === "dark" ? theme.colors.slate[7] : theme.colors.slate[2]}`,
            fontWeight: "500",
            fontSize: "0.75rem",
            height: "1.25rem",
            paddingLeft: "0.5rem",
            paddingRight: "0.5rem",
            borderRadius: theme.radius.md,
          },
        } as Record<string, React.CSSProperties>),
    },

    Radio: {
      styles: (theme: any) =>
        ({
          radio: {
            width: "1rem",
            height: "1rem",
            border: "1px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
            "&:checked": {
              backgroundColor: "var(--mantine-color-body)",
              borderColor: theme.colorScheme === "dark" ? theme.colors.slate[3] : theme.colors.slate[9],
              "&::before": {
                backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[3] : theme.colors.slate[9],
                width: "0.375rem",
                height: "0.375rem",
                borderRadius: "50%",
                content: '""',
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              },
            },
            "&:focus": {
              boxShadow: `0 0 0 2px ${rgba(theme.colors.slate[5], 0.2)}`,
            },
          },
          label: {
            fontSize: "0.875rem",
            fontWeight: "400",
            color: "var(--mantine-color-text)",
            marginLeft: "0.5rem",
          },
        } as Record<string, React.CSSProperties>),
    },

    Checkbox: {
      styles: (theme: any) =>
        ({
          input: {
            width: "1rem",
            height: "1rem",
            borderRadius: theme.radius.sm,
            border: "1px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
            "&:checked": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[3] : theme.colors.slate[9],
              borderColor: theme.colorScheme === "dark" ? theme.colors.slate[3] : theme.colors.slate[9],
            },
          },
          label: {
            fontSize: "0.875rem",
            fontWeight: "400",
            color: "var(--mantine-color-text)",
          },
        } as Record<string, React.CSSProperties>),
    },

    Switch: {
      styles: (theme: any) =>
        ({
          track: {
            backgroundColor: theme.colors.slate[3],
            border: "none",
            width: "2.75rem",
            height: "1.5rem",
            "&[dataChecked]": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[4] : theme.colors.slate[9],
            },
          },
          thumb: {
            backgroundColor: theme.colors.slate[0],
            border: "none",
            width: "1.25rem",
            height: "1.25rem",
            boxShadow: "0 2px 4px 0 rgb(0 0 0 / 0.2)",
          },
        } as Record<string, React.CSSProperties>),
    },

    Modal: {
      defaultProps: {
        centered: true,
        radius: "lg",
        shadow: "xl",
      } as { centered: boolean; radius: string; shadow: string },
      styles: (theme: any) =>
        ({
          content: {
            borderRadius: theme.radius.lg,
            backgroundColor: "var(--mantine-color-body)",
            border: "1px solid var(--mantine-color-default-border)",
            boxShadow:
              "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
          },
          header: {
            backgroundColor: "var(--mantine-color-body)",
            borderBottom: "1px solid var(--mantine-color-default-border)",
            padding: theme.spacing.lg,
          },
          body: {
            padding: theme.spacing.lg,
          },
        } as Record<string, React.CSSProperties>),
    },

    Table: {
      styles: (theme: any) =>
        ({
          table: {
            borderCollapse: "separate",
            borderSpacing: "0",
            width: "100%",
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: theme.radius.lg,
          },
          thead: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[8] : theme.colors.slate[0],
          },
          th: {
            padding: "0.75rem 1rem",
            fontSize: "0.875rem",
            fontWeight: "500",
            color: theme.colorScheme === "dark" ? theme.colors.slate[3] : theme.colors.slate[6],
            borderBottom: "1px solid var(--mantine-color-default-border)",
            "&:not(:last-child)": {
              borderRight: "1px solid var(--mantine-color-default-border)",
            },
          },
          td: {
            padding: "0.75rem 1rem",
            fontSize: "0.875rem",
            borderBottom: "1px solid var(--mantine-color-default-border)",
            "&:not(:last-child)": {
              borderRight: "1px solid var(--mantine-color-default-border)",
            },
          },
          tr: {
            "&:hover": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[8] : theme.colors.slate[0],
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Progress: {
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: theme.colors.slate[2],
            borderRadius: "9999px",
            height: "0.5rem",
          },
          bar: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[4] : theme.colors.slate[9],
            borderRadius: "9999px",
          },
        } as Record<string, React.CSSProperties>),
    },

    Tabs: {
      styles: (theme: any) =>
        ({
          tabsList: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[8] : theme.colors.slate[1],
            padding: "0.25rem",
            borderRadius: theme.radius.lg,
          },
          tab: {
            borderRadius: theme.radius.md,
            fontSize: "0.875rem",
            fontWeight: "500",
            padding: "0.5rem 1rem",
            color: theme.colors.slate[5],
            "&[data-active]": {
              backgroundColor: "var(--mantine-color-body)",
              color: "var(--mantine-color-text)",
              boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Menu: {
      styles: (theme: any) =>
        ({
          dropdown: {
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: theme.radius.lg,
            backgroundColor: "var(--mantine-color-body)",
            padding: "0.25rem",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          },
          item: {
            borderRadius: theme.radius.md,
            fontSize: "0.875rem",
            padding: "0.5rem 0.75rem",
            "&[data-hovered]": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[8] : theme.colors.slate[1],
              color: "var(--mantine-color-text)",
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Popover: {
      styles: (theme: any) =>
        ({
          dropdown: {
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: theme.radius.lg,
            backgroundColor: "var(--mantine-color-body)",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          },
        } as Record<string, React.CSSProperties>),
    },

    Tooltip: {
      styles: (theme: any) =>
        ({
          tooltip: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.slate[2] : theme.colors.slate[9],
            color: theme.colorScheme === "dark" ? theme.colors.slate[9] : theme.colors.slate[0],
            borderRadius: theme.radius.md,
            fontSize: "0.75rem",
            padding: "0.5rem 0.75rem",
            border: "none",
          },
        } as Record<string, React.CSSProperties>),
    },

    Alert: {
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: "var(--mantine-color-body)",
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: theme.radius.lg,
            padding: theme.spacing.md,
          },
        } as Record<string, React.CSSProperties>),
    },
  },
};

export default mantineSlate;

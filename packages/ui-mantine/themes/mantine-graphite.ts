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
 * A Mantine theme built around a graphite monochrome design language:
 * - Ultra-minimal aesthetic with stark black/white contrast
 * - Geometric sans font stack (fallback to Inter)
 * - Extremely subtle borders and shadows
 * - Sharp, precise geometric shapes
 * - Gradient accents and modern animations
 * - Focus on typography hierarchy and white space
 * - Consistent, high-contrast layout patterns
 */
export const mantineGraphite: MantineThemeOverride = {
  primaryColor: "dark",
  primaryShade: 9,
  fontFamily:
    'Geist Sans, Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: {
    fontFamily:
      'Geist Sans, Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "3rem", lineHeight: "1.1" },
      h2: { fontSize: "2.25rem", lineHeight: "1.2" },
      h3: { fontSize: "1.875rem", lineHeight: "1.3" },
      h4: { fontSize: "1.5rem", lineHeight: "1.4" },
      h5: { fontSize: "1.25rem", lineHeight: "1.5" },
      h6: { fontSize: "1.125rem", lineHeight: "1.5" },
    },
  },

  // Graphite monochrome color system
  colors: {
    // Graphite grayscale system
    dark: [
      "#fafafa", // gray-50
      "#f4f4f5", // gray-100
      "#e4e4e7", // gray-200
      "#d4d4d8", // gray-300
      "#a1a1aa", // gray-400
      "#71717a", // gray-500
      "#52525b", // gray-600
      "#3f3f46", // gray-700
      "#27272a", // gray-800
      "#18181b", // gray-900
    ],
    gray: [
      "#fafafa",
      "#f4f4f5",
      "#e4e4e7",
      "#d4d4d8",
      "#a1a1aa",
      "#71717a",
      "#52525b",
      "#3f3f46",
      "#27272a",
      "#18181b",
    ],
    // Accent colors
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
    violet: [
      "#f5f3ff",
      "#ede9fe",
      "#ddd6fe",
      "#c4b5fd",
      "#a78bfa",
      "#8b5cf6",
      "#7c3aed",
      "#6d28d9",
      "#5b21b6",
      "#4c1d95",
    ],
    pink: [
      "#fdf2f8",
      "#fce7f3",
      "#fbcfe8",
      "#f9a8d4",
      "#f472b6",
      "#ec4899",
      "#db2777",
      "#be185d",
      "#9d174d",
      "#831843",
    ],
    cyan: [
      "#ecfeff",
      "#cffafe",
      "#a5f3fc",
      "#67e8f9",
      "#22d3ee",
      "#06b6d4",
      "#0891b2",
      "#0e7490",
      "#155e75",
      "#164e63",
    ],
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
    red: [
      "#fef2f2",
      "#fee2e2",
      "#fecaca",
      "#fca5a5",
      "#f87171",
      "#ef4444",
      "#dc2626",
      "#b91c1c",
      "#991b1b",
      "#7f1d1d",
    ],
    orange: [
      "#fff7ed",
      "#ffedd5",
      "#fed7aa",
      "#fdba74",
      "#fb923c",
      "#f97316",
      "#ea580c",
      "#c2410c",
      "#9a3412",
      "#7c2d12",
    ],
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

  // Graphite spacing and sizing
  defaultRadius: 8,
  radius: {
    xs: "4px",
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
  },

  spacing: {
    xs: "8px",
    sm: "12px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },

  // Graphite shadow system
  shadows: {
    xs: "0 0 0 1px rgba(0, 0, 0, 0.05)",
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  },

  // Typography scale for graphite layouts
  fontSizes: {
    xs: "0.75rem", // 12px
    sm: "0.875rem", // 14px
    md: "1rem", // 16px
    lg: "1.125rem", // 18px
    xl: "1.25rem", // 20px
  },

  lineHeights: {
    xs: "1.4",
    sm: "1.45",
    md: "1.55",
    lg: "1.6",
    xl: "1.65",
  },

  // Component overrides for the graphite aesthetic
  components: {
    Button: {
      defaultProps: {
        radius: "md",
        size: "sm",
      },
      styles: (theme: any, params: any) => ({
        root: {
          fontWeight: "500",
          fontSize: "14px",
          height: "40px",
          paddingLeft: "16px",
          paddingRight: "16px",
          border: "1px solid transparent",
          transition: "all 0.15s ease",
          letterSpacing: "-0.01em",
          cursor: "pointer",
        },
        // Primary button (black background in light, inverted in dark)
        filled: {
          backgroundColor: theme.colorScheme === "dark" ? theme.colors.gray[1] : theme.colors.gray[9],
          color: theme.colorScheme === "dark" ? theme.colors.gray[9] : theme.colors.gray[0],
          border: `1px solid ${theme.colorScheme === "dark" ? theme.colors.gray[1] : theme.colors.gray[9]}`,
          "&:hover": {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[7],
            borderColor: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[7],
            transform: "translateY(-1px)",
          },
          "&:active": {
            transform: "translateY(0)",
          },
        },
        // Secondary button (white with border)
        outline: {
          backgroundColor: "transparent",
          color: "var(--mantine-color-text)",
          border: "1px solid var(--mantine-color-default-border)",
          "&:hover": {
            backgroundColor: "var(--mantine-color-default)",
            borderColor: "var(--mantine-color-text)",
            transform: "translateY(-1px)",
          },
        },
        // Ghost button
        subtle: {
          backgroundColor: "transparent",
          color: "var(--mantine-color-text)",
          border: "none",
          "&:hover": {
            backgroundColor: "var(--mantine-color-default)",
          },
        },
        // Light button
        light: {
          backgroundColor: "var(--mantine-color-default)",
          color: "var(--mantine-color-text)",
          border: "none",
          "&:hover": {
            backgroundColor: "#f1f1f1",
          },
        },
      }),
    },

    Card: {
      defaultProps: {
        radius: "lg",
        padding: "lg",
      } as { radius: string; padding: string },
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: "var(--mantine-color-body)",
            border: `1px solid var(--mantine-color-default-border)`,
            boxShadow: "none",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              borderColor: "#e1e1e1",
              transform: "translateY(-1px)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Paper: {
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: "var(--mantine-color-body)",
            border: `1px solid var(--mantine-color-default-border)`,
            boxShadow: "none",
            borderRadius: theme.radius.lg,
          },
        } as Record<string, React.CSSProperties>),
    },

    TextInput: {
      defaultProps: {
        size: "sm",
      } as { size: string },
      styles: (theme: any) =>
        ({
          input: {
            height: "40px",
            borderRadius: theme.radius.md,
            border: `1px solid var(--mantine-color-default-border)`,
            backgroundColor: "var(--mantine-color-body)",
            fontSize: "14px",
            fontWeight: "400",
            padding: "0 12px",
            transition: "all 0.15s ease",
            "&:focus": {
              borderColor: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[9],
              boxShadow: "none",
              outline: "none",
            },
            "&::placeholder": {
              color: theme.colors.gray[5],
              fontSize: "14px",
            },
          },
          label: {
            fontWeight: "500",
            fontSize: "14px",
            color: "var(--mantine-color-text)",
            marginBottom: "6px",
          },
        } as Record<string, React.CSSProperties>),
    },

    Select: {
      defaultProps: {
        size: "sm",
      } as { size: string },
      styles: (theme: any) =>
        ({
          input: {
            height: "40px",
            borderRadius: theme.radius.md,
            border: `1px solid var(--mantine-color-default-border)`,
            backgroundColor: "var(--mantine-color-body)",
            fontSize: "14px",
            fontWeight: "400",
            padding: "0 32px 0 12px",
            transition: "all 0.15s ease",
            cursor: "pointer",
            "&:focus": {
              borderColor: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[9],
              boxShadow: "none",
              outline: "none",
            },
          },
          dropdown: {
            border: `1px solid var(--mantine-color-default-border)`,
            borderRadius: theme.radius.md,
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          },
        } as Record<string, React.CSSProperties>),
    },

    Textarea: {
      styles: (theme: any) =>
        ({
          input: {
            borderRadius: theme.radius.md,
            border: `1px solid var(--mantine-color-default-border)`,
            backgroundColor: "var(--mantine-color-body)",
            fontSize: "14px",
            fontWeight: "400",
            padding: "12px",
            transition: "all 0.15s ease",
            minHeight: "80px",
            resize: "vertical",
            "&:focus": {
              borderColor: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[9],
              boxShadow: "none",
              outline: "none",
            },
            "&::placeholder": {
              color: theme.colors.gray[5],
              fontSize: "14px",
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Badge: {
      defaultProps: {
        radius: "md",
        size: "sm",
      } as { radius: string; size: string },
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.gray[8] : theme.colors.gray[1],
            color: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[9],
            border: `1px solid ${theme.colorScheme === "dark" ? theme.colors.gray[7] : theme.colors.gray[2]}`,
            fontWeight: "500",
            fontSize: "12px",
            height: "24px",
            padding: "0 8px",
            letterSpacing: "-0.01em",
          },
        } as Record<string, React.CSSProperties>),
    },

    Radio: {
      styles: (theme: any) =>
        ({
          radio: {
            border: `2px solid var(--mantine-color-default-border)`,
            backgroundColor: "var(--mantine-color-body)",
            "&:checked": {
              backgroundColor: "var(--mantine-color-body)",
              borderColor: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[9],
              "&::before": {
                backgroundColor: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[9],
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                content: '""',
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              },
            },
          },
          label: {
            fontSize: "14px",
            fontWeight: "500",
            color: "var(--mantine-color-text)",
          },
        } as Record<string, React.CSSProperties>),
    },

    Checkbox: {
      styles: (theme: any) =>
        ({
          input: {
            border: `2px solid var(--mantine-color-default-border)`,
            backgroundColor: "var(--mantine-color-body)",
            borderRadius: theme.radius.sm,
            "&:checked": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[9],
              borderColor: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[9],
            },
          },
          label: {
            fontSize: "14px",
            fontWeight: "500",
            color: "var(--mantine-color-text)",
          },
        } as Record<string, React.CSSProperties>),
    },

    Switch: {
      styles: (theme: any) =>
        ({
          track: {
            border: "none",
            backgroundColor: theme.colors.gray[2],
            "&[dataChecked]": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[9],
            },
          },
          thumb: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.gray[8] : theme.colors.gray[0],
            border: "none",
          },
          label: {
            fontSize: "14px",
            fontWeight: "500",
            color: "var(--mantine-color-text)",
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
            border: `1px solid var(--mantine-color-default-border)`,
            backgroundColor: "var(--mantine-color-body)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          },
          header: {
            borderBottom: `1px solid var(--mantine-color-default-border)`,
            paddingBottom: theme.spacing.md,
            fontSize: "18px",
            fontWeight: "600",
          },
        } as Record<string, React.CSSProperties>),
    },

    Notification: {
      styles: (theme: any) =>
        ({
          root: {
            border: `1px solid var(--mantine-color-default-border)`,
            borderRadius: theme.radius.lg,
            backgroundColor: "var(--mantine-color-body)",
            boxShadow:
              "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          },
          title: {
            fontWeight: "600",
            fontSize: "14px",
          },
          description: {
            fontSize: "14px",
            color: "var(--mantine-color-dimmed)",
          },
        } as Record<string, React.CSSProperties>),
    },

    Tooltip: {
      styles: (theme: any) =>
        ({
          tooltip: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.gray[1] : theme.colors.gray[9],
            color: theme.colorScheme === "dark" ? theme.colors.gray[9] : theme.colors.gray[0],
            borderRadius: theme.radius.sm,
            fontSize: "12px",
            fontWeight: "500",
            padding: "6px 8px",
            border: "none",
          },
        } as Record<string, React.CSSProperties>),
    },

    Popover: {
      styles: (theme: any) =>
        ({
          dropdown: {
            border: `1px solid var(--mantine-color-default-border)`,
            borderRadius: theme.radius.lg,
            backgroundColor: "var(--mantine-color-body)",
            boxShadow:
              "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          },
        } as Record<string, React.CSSProperties>),
    },

    // Navigation components
    NavLink: {
      styles: (theme: any) =>
        ({
          root: {
            borderRadius: theme.radius.md,
            color: "var(--mantine-color-text)",
            fontSize: "14px",
            fontWeight: "500",
            padding: "8px 12px",
            "&:hover": {
              backgroundColor: "var(--mantine-color-default)",
            },
            "&[data-active]": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.gray[8] : theme.colors.gray[1],
              color: "var(--mantine-color-text)",
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Menu: {
      styles: (theme: any) =>
        ({
          dropdown: {
            border: `1px solid var(--mantine-color-default-border)`,
            borderRadius: theme.radius.md,
            backgroundColor: "var(--mantine-color-body)",
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            padding: "4px",
          },
          item: {
            borderRadius: theme.radius.sm,
            fontSize: "14px",
            fontWeight: "500",
            padding: "8px 12px",
            "&:hover": {
              backgroundColor: "var(--mantine-color-default)",
            },
          },
          divider: {
            borderTop: `1px solid var(--mantine-color-default-border)`,
            margin: "4px 0",
          },
        } as Record<string, React.CSSProperties>),
    },

    // Typography components
    Title: {
      styles: (theme: any) =>
        ({
          root: {
            color: "var(--mantine-color-text)",
            fontWeight: "600",
            letterSpacing: "-0.025em",
          },
        } as Record<string, React.CSSProperties>),
    },

    Text: {
      styles: (theme: any) =>
        ({
          root: {
            color: "var(--mantine-color-text)",
            fontSize: "14px",
            lineHeight: "1.6",
          },
        } as Record<string, React.CSSProperties>),
    },

    Code: {
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.gray[8] : theme.colors.gray[1],
            color: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[9],
            border: `1px solid ${theme.colorScheme === "dark" ? theme.colors.gray[7] : theme.colors.gray[2]}`,
            borderRadius: theme.radius.sm,
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: "13px",
            fontWeight: "500",
            padding: "2px 6px",
          },
        } as Record<string, React.CSSProperties>),
    },

    // Table components
    Table: {
      styles: (theme: any) =>
        ({
          root: {
            border: `1px solid var(--mantine-color-default-border)`,
            borderRadius: theme.radius.lg,
            overflow: "hidden",
          },
          thead: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.gray[8] : theme.colors.gray[0],
            borderBottom: `1px solid var(--mantine-color-default-border)`,
          },
          th: {
            fontSize: "12px",
            fontWeight: "600",
            color: "var(--mantine-color-text)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "12px 16px",
          },
          td: {
            fontSize: "14px",
            padding: "12px 16px",
            borderBottom: `1px solid var(--mantine-color-default-border)`,
          },
        } as Record<string, React.CSSProperties>),
    },

    // Progress components
    Progress: {
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: theme.colors.gray[2],
            borderRadius: theme.radius.xl,
          },
          bar: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[9],
            borderRadius: theme.radius.xl,
          },
        } as Record<string, React.CSSProperties>),
    },

    // Tabs with graphite styling
    Tabs: {
      styles: (theme: any) =>
        ({
          root: {
            borderBottom: `1px solid var(--mantine-color-default-border)`,
          },
          tab: {
            fontWeight: "500",
            fontSize: "14px",
            color: theme.colors.gray[5],
            border: "none",
            borderBottom: "2px solid transparent",
            padding: "12px 16px",
            "&[data-active]": {
              color: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[9],
              borderBottomColor: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[9],
            },
            "&:hover": {
              backgroundColor: "transparent",
              color: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.colors.gray[9],
            },
          },
          panel: {
            paddingTop: theme.spacing.lg,
          },
        } as Record<string, React.CSSProperties>),
    },
  },

  // Graphite-specific design tokens
  other: {
    graphiteGradient: "linear-gradient(to right, #000000, #262626)",
    graphiteBlur: "blur(12px)",
    graphiteTransition: "all 0.2s ease",
  },
};

export default mantineGraphite;

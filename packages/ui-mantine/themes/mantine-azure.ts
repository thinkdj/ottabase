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
 * A comprehensive Mantine theme built for structured enterprise dashboards:
 * - Signature blue color palette with clear hierarchy
 * - Professional, structured layouts for analytics experiences
 * - Optimized for admin applications and dashboards
 * - Consistent spacing and typography for an orderly feel
 * - Comprehensive component overrides with proper dark/light mode compatibility
 * - Clean, accessible design with proper focus states
 */
export const mantineAzure: MantineThemeOverride = {
  primaryColor: "blue",
  primaryShade: 6,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
  headings: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "2.5rem", lineHeight: "1.23" },
      h2: { fontSize: "2rem", lineHeight: "1.35" },
      h3: { fontSize: "1.5rem", lineHeight: "1.35" },
      h4: { fontSize: "1.25rem", lineHeight: "1.4" },
      h5: { fontSize: "1rem", lineHeight: "1.5" },
      h6: { fontSize: "0.875rem", lineHeight: "1.6" },
    },
  },

  // Azure color system
  colors: {
    // Azure Blue (Primary)
    blue: [
      "#e6f7ff",
      "#bae7ff",
      "#91d5ff",
      "#69c0ff",
      "#40a9ff",
      "#1890ff",
      "#096dd9",
      "#0050b3",
      "#003a8c",
      "#002766",
    ],
    // Alert Red (Error/Danger)
    red: [
      "#fff2f0",
      "#ffece6",
      "#ffd8bf",
      "#ffbb96",
      "#ff9c6e",
      "#ff7a45",
      "#fa541c",
      "#d4380d",
      "#ad2102",
      "#871400",
    ],
    // Success Green
    green: [
      "#f6ffed",
      "#d9f7be",
      "#b7eb8f",
      "#95de64",
      "#73d13d",
      "#52c41a",
      "#389e0d",
      "#237804",
      "#135200",
      "#092b00",
    ],
    // Warning Gold/Orange
    yellow: [
      "#fffbe6",
      "#fff1b8",
      "#ffe58f",
      "#ffd666",
      "#ffc53d",
      "#faad14",
      "#d48806",
      "#ad6800",
      "#874d00",
      "#613400",
    ],
    // Neutral Gray
    gray: [
      "#ffffff",
      "#fafafa",
      "#f5f5f5",
      "#f0f0f0",
      "#d9d9d9",
      "#bfbfbf",
      "#8c8c8c",
      "#595959",
      "#434343",
      "#262626",
    ],
    // Keep as 'dark' for Mantine compatibility
    dark: [
      "#ffffff",
      "#fafafa",
      "#f5f5f5",
      "#f0f0f0",
      "#d9d9d9",
      "#bfbfbf",
      "#8c8c8c",
      "#595959",
      "#434343",
      "#262626",
    ],
  },

  // Structured spacing and radius system
  defaultRadius: "sm",
  radius: {
    xs: "2px",
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

  // Typography scale for structured layouts
  fontSizes: {
    xs: "12px",
    sm: "14px",
    md: "16px",
    lg: "18px",
    xl: "20px",
  },

  lineHeights: {
    xs: "1.5",
    sm: "1.5714",
    md: "1.5714",
    lg: "1.5556",
    xl: "1.5",
  },

  // Structured shadow system
  shadows: {
    xs: "0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)",
    sm: "0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)",
    md: "0 4px 12px rgba(0, 0, 0, 0.15)",
    lg: "0 8px 24px rgba(0, 0, 0, 0.12)",
    xl: "0 12px 48px rgba(0, 0, 0, 0.18)",
  },

  // Comprehensive component overrides for the azure aesthetic with dark mode support
  components: {
    Button: {
      defaultProps: {
        radius: "sm",
        size: "md",
      } as { radius: string; size: string },
      styles: (theme: any) =>
        ({
          root: {
            fontWeight: "400",
            fontSize: "14px",
            lineHeight: "1.5714",
            height: "32px",
            padding: "4px 15px",
            borderRadius: "6px",
            border: "1px solid var(--mantine-color-default-border)",
            transition: "all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1)",
            cursor: "pointer",
            "&:focus": {
              outline: "none",
              boxShadow: "0 0 0 2px rgba(24, 144, 255, 0.2)",
            },
            "&:hover": {
              zIndex: 1,
            },
          },
          filled: {
            backgroundColor: theme.colors.blue[5],
            borderColor: theme.colors.blue[5],
            color: "#ffffff",
            "&:hover": {
              backgroundColor: theme.colors.blue[4],
              borderColor: theme.colors.blue[4],
            },
            "&:active": {
              backgroundColor: theme.colors.blue[6],
              borderColor: theme.colors.blue[6],
            },
          },
          outline: {
            backgroundColor: "var(--mantine-color-body)",
            borderColor: "var(--mantine-color-default-border)",
            color: "var(--mantine-color-text)",
            "&:hover": {
              backgroundColor: "var(--mantine-color-body)",
              borderColor: theme.colors.blue[5],
              color: theme.colors.blue[5],
            },
            "&:active": {
              backgroundColor: "var(--mantine-color-body)",
              borderColor: theme.colors.blue[6],
              color: theme.colors.blue[6],
            },
          },
          light: {
            backgroundColor: "transparent",
            borderColor: "transparent",
            color: "var(--mantine-color-text)",
            "&:hover": {
              backgroundColor: "var(--mantine-color-gray-light-hover)",
            },
            "&:active": {
              backgroundColor: "var(--mantine-color-gray-light)",
            },
          },
          subtle: {
            backgroundColor: theme.colors.blue[5],
            borderColor: theme.colors.blue[5],
            color: "#ffffff",
            "&:hover": {
              backgroundColor: theme.colors.blue[4],
              borderColor: theme.colors.blue[4],
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Card: {
      defaultProps: {
        radius: "sm",
        padding: "lg",
        shadow: "sm",
      } as { radius: string; padding: string; shadow: string },
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: "var(--mantine-color-body)",
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: "8px",
            boxShadow:
              "0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)",
          },
        } as Record<string, React.CSSProperties>),
    },

    Paper: {
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: "var(--mantine-color-body)",
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: "8px",
          },
        } as Record<string, React.CSSProperties>),
    },

    TextInput: {
      defaultProps: {
        size: "md",
        radius: "sm",
      } as { size: string; radius: string },
      styles: (theme: any) =>
        ({
          input: {
            height: "32px",
            padding: "4px 11px",
            fontSize: "14px",
            lineHeight: "1.5714",
            borderRadius: "6px",
            border: "1px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
            transition: "all 0.3s",
            "&:hover": {
              borderColor: theme.colors.blue[4],
            },
            "&:focus": {
              borderColor: theme.colors.blue[5],
              boxShadow: `0 0 0 2px ${rgba(theme.colors.blue[5], 0.2)}`,
              outline: "none",
            },
            "&::placeholder": {
              color: "var(--mantine-color-placeholder)",
            },
          },
          label: {
            fontSize: "14px",
            fontWeight: "400",
            color: "var(--mantine-color-text)",
            marginBottom: "4px",
          },
        } as Record<string, React.CSSProperties>),
    },

    Select: {
      defaultProps: {
        size: "md",
        radius: "sm",
      } as { size: string; radius: string },
      styles: (theme: any) =>
        ({
          input: {
            height: "32px",
            padding: "4px 11px",
            fontSize: "14px",
            borderRadius: "6px",
            border: "1px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
            "&:hover": {
              borderColor: theme.colors.blue[4],
            },
            "&:focus": {
              borderColor: theme.colors.blue[5],
              boxShadow: `0 0 0 2px ${rgba(theme.colors.blue[5], 0.2)}`,
            },
          },
          dropdown: {
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: "6px",
            backgroundColor: "var(--mantine-color-body)",
            boxShadow:
              "0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)",
            padding: "4px",
          },
          item: {
            fontSize: "14px",
            padding: "5px 12px",
            borderRadius: "6px",
            "&[data-hovered]": {
              backgroundColor: "var(--mantine-color-gray-light-hover)",
            },
            "&[data-selected]": {
              backgroundColor: theme.colorScheme === "dark" ? rgba(theme.colors.blue[5], 0.2) : "var(--mantine-color-blue-light)",
              color: theme.colors.blue[5],
              fontWeight: "600",
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Textarea: {
      styles: (theme: any) =>
        ({
          input: {
            padding: "4px 11px",
            fontSize: "14px",
            borderRadius: "6px",
            border: "1px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
            minHeight: "80px",
            resize: "vertical",
            "&:hover": {
              borderColor: theme.colors.blue[4],
            },
            "&:focus": {
              borderColor: theme.colors.blue[5],
              boxShadow: `0 0 0 2px ${rgba(theme.colors.blue[5], 0.2)}`,
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Badge: {
      defaultProps: {
        radius: "sm",
        variant: "light",
      } as { radius: string; variant: string },
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: "var(--mantine-color-gray-light)",
            color: "var(--mantine-color-text)",
            border: "1px solid var(--mantine-color-default-border)",
            fontWeight: "400",
            fontSize: "12px",
            height: "22px",
            padding: "0 7px",
            borderRadius: "6px",
          },
        } as Record<string, React.CSSProperties>),
    },

    Radio: {
      styles: (theme: any) =>
        ({
          radio: {
            width: "16px",
            height: "16px",
            border: "1px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
            "&:checked": {
              backgroundColor: "var(--mantine-color-body)",
              borderColor: theme.colors.blue[5],
              "&::before": {
                backgroundColor: theme.colors.blue[5],
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
            "&:hover": {
              borderColor: theme.colors.blue[4],
            },
            "&:focus": {
              boxShadow: `0 0 0 2px ${rgba(theme.colors.blue[5], 0.2)}`,
              outline: "none",
            },
          },
          label: {
            fontSize: "14px",
            fontWeight: "400",
            color: "var(--mantine-color-text)",
            marginLeft: "8px",
          },
        } as Record<string, React.CSSProperties>),
    },

    Checkbox: {
      styles: (theme: any) =>
        ({
          input: {
            width: "16px",
            height: "16px",
            borderRadius: "2px",
            border: "1px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
            "&:checked": {
              backgroundColor: theme.colors.blue[5],
              borderColor: theme.colors.blue[5],
            },
            "&:hover": {
              borderColor: theme.colors.blue[4],
            },
          },
          label: {
            fontSize: "14px",
            fontWeight: "400",
            color: "var(--mantine-color-text)",
          },
        } as Record<string, React.CSSProperties>),
    },

    Switch: {
      styles: (theme: any) =>
        ({
          track: {
            backgroundColor: "var(--mantine-color-dimmed)",
            border: "none",
            width: "44px",
            height: "22px",
            "&[dataChecked]": {
              backgroundColor: theme.colors.blue[5],
            },
          },
          thumb: {
            backgroundColor: "var(--mantine-color-body)",
            border: "none",
            width: "18px",
            height: "18px",
            boxShadow: "0 2px 4px 0 rgba(0, 35, 11, 0.2)",
          },
        } as Record<string, React.CSSProperties>),
    },

    Modal: {
      defaultProps: {
        centered: true,
        radius: "sm",
        shadow: "lg",
      } as { centered: boolean; radius: string; shadow: string },
      styles: (theme: any) =>
        ({
          content: {
            borderRadius: "8px",
            backgroundColor: "var(--mantine-color-body)",
            border: "1px solid var(--mantine-color-default-border)",
            boxShadow:
              "0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)",
          },
          header: {
            backgroundColor: "var(--mantine-color-body)",
            borderBottom: "1px solid var(--mantine-color-default-border)",
            padding: "16px 24px",
            fontSize: "16px",
            fontWeight: "500",
          },
          body: {
            padding: "24px",
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
            backgroundColor: "var(--mantine-color-body)",
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: "8px",
          },
          thead: {
            backgroundColor: "var(--mantine-color-gray-light)",
          },
          th: {
            padding: "16px",
            fontSize: "14px",
            fontWeight: "500",
            color: "var(--mantine-color-text)",
            borderBottom: "1px solid var(--mantine-color-default-border)",
            "&:not(:last-child)": {
              borderRight: "1px solid var(--mantine-color-default-border)",
            },
          },
          td: {
            padding: "16px",
            fontSize: "14px",
            color: "var(--mantine-color-text)",
            borderBottom: "1px solid var(--mantine-color-default-border)",
            "&:not(:last-child)": {
              borderRight: "1px solid var(--mantine-color-default-border)",
            },
          },
          tr: {
            "&:hover": {
              backgroundColor: "var(--mantine-color-gray-light-hover)",
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Progress: {
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: "var(--mantine-color-gray-light)",
            borderRadius: "100px",
            height: "6px",
          },
          bar: {
            backgroundColor: theme.colors.blue[5],
            borderRadius: "100px",
          },
        } as Record<string, React.CSSProperties>),
    },

    Tabs: {
      styles: (theme: any) =>
        ({
          tabsList: {
            borderBottom: "1px solid var(--mantine-color-default-border)",
            backgroundColor: "transparent",
            gap: "0",
          },
          tab: {
            fontSize: "14px",
            fontWeight: "400",
            padding: "12px 16px",
            color: "var(--mantine-color-dimmed)",
            borderBottom: "2px solid transparent",
            backgroundColor: "transparent",
            borderRadius: "0",
            "&:hover": {
              color: theme.colors.blue[4],
            },
            "&[data-active]": {
              color: theme.colors.blue[5],
              borderBottomColor: theme.colors.blue[5],
              backgroundColor: "transparent",
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Menu: {
      styles: (theme: any) =>
        ({
          dropdown: {
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: "8px",
            backgroundColor: "var(--mantine-color-body)",
            padding: "4px",
            boxShadow:
              "0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)",
          },
          item: {
            borderRadius: "6px",
            fontSize: "14px",
            padding: "5px 12px",
            color: "var(--mantine-color-text)",
            "&[data-hovered]": {
              backgroundColor: "var(--mantine-color-gray-light-hover)",
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Popover: {
      styles: (theme: any) =>
        ({
          dropdown: {
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: "8px",
            backgroundColor: "var(--mantine-color-body)",
            boxShadow:
              "0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)",
          },
        } as Record<string, React.CSSProperties>),
    },

    Tooltip: {
      styles: (theme: any) =>
        ({
          tooltip: {
            backgroundColor: "var(--mantine-color-dark-6)",
            color: "var(--mantine-color-white)",
            borderRadius: "6px",
            fontSize: "12px",
            padding: "6px 8px",
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
            borderRadius: "8px",
            padding: "15px",
          },
        } as Record<string, React.CSSProperties>),
    },

    Notification: {
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: "var(--mantine-color-body)",
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: "8px",
            boxShadow:
              "0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)",
          },
        } as Record<string, React.CSSProperties>),
    },
  },
};

export default mantineAzure;

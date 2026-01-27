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
 * Artisan Theme - Creative Yet Minimal, Artistic Yet Classy
 *
 * A sophisticated design system inspired by luxury galleries:
 * - Deep burgundy wine primary for refined elegance
 * - Vibrant gold accents for artistic flair
 * - Minimal but intentional spacing and typography
 * - Artistic details with refined transitions
 * - Cream to charcoal palette for classy simplicity
 * - Premium aesthetic with gallery-like precision
 */
export const mantineArtisan: MantineThemeOverride = {
  primaryColor: "burgundy",
  primaryShade: 6,
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
  headings: {
    fontFamily:
      '"Sohne", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeight: "700",
    sizes: {
      h1: { fontSize: "2.5rem", lineHeight: "1.15", fontWeight: "700" },
      h2: { fontSize: "2rem", lineHeight: "1.2", fontWeight: "700" },
      h3: { fontSize: "1.5rem", lineHeight: "1.3", fontWeight: "700" },
      h4: { fontSize: "1.25rem", lineHeight: "1.4", fontWeight: "600" },
      h5: { fontSize: "1.125rem", lineHeight: "1.5", fontWeight: "600" },
      h6: { fontSize: "1rem", lineHeight: "1.5", fontWeight: "600" },
    },
  },

  // Curated artistic color palette inspired by galleries
  colors: {
    // Primary - Deep Burgundy Wine (refined, sophisticated)
    burgundy: [
      "#faf7f4",
      "#f0e6eb",
      "#e5cdd8",
      "#d4a8b9",
      "#c68da3",
      "#b8729a",
      "#a8577d",
      "#8b3a62",
      "#6d2d50",
      "#522040",
    ],
    // Keep as 'dark' for Mantine compatibility (matches dark mode colors)
    dark: [
      "#faf7f4",
      "#f0e6eb",
      "#e5cdd8",
      "#d4a8b9",
      "#c68da3",
      "#b8729a",
      "#a8577d",
      "#1a1318",
      "#120d11",
      "#0a0608",
    ],
    // Accent: Vibrant Gold (artistic warmth and prestige)
    gold: [
      "#fffef5",
      "#fffbeb",
      "#fff8d6",
      "#fff5b2",
      "#fff28e",
      "#ffed5f",
      "#ffe833",
      "#e8d51b",
      "#d1c410",
      "#b3ad00",
    ],
    // Accent: Warm cream (for secondary elements)
    cream: [
      "#faf7f4",
      "#f5f0e9",
      "#f0e9e0",
      "#ebe2d7",
      "#e6dace",
      "#e1d2c5",
      "#dccabc",
      "#d7c2b3",
      "#d2baaa",
      "#cdb2a1",
    ],
    // Accent: Dusty Rose (artistic subtlety)
    rose: [
      "#fdf0f3",
      "#f9d9e3",
      "#f1b3cc",
      "#e98bb8",
      "#e363a6",
      "#d73e91",
      "#c82c7d",
      "#b0206e",
      "#8a1759",
      "#6b0f48",
    ],
    // Semantic colors aligned with palette
    blue: [
      "#e6f4fe",
      "#b3d9f2",
      "#80beec",
      "#4da3e6",
      "#2d8fd9",
      "#1a7bc7",
      "#1169b0",
      "#0d5a99",
      "#0a4a7f",
      "#063a66",
    ],
    green: [
      "#e6f7f0",
      "#b3e8d6",
      "#80d9ba",
      "#4dca9f",
      "#2db884",
      "#1aa670",
      "#119460",
      "#0d7d4f",
      "#096440",
      "#044b30",
    ],
    red: [
      "#fee8e5",
      "#f7b8ae",
      "#ed8876",
      "#e35844",
      "#d43c2b",
      "#bf2e1f",
      "#a62618",
      "#8c1f13",
      "#72180f",
      "#54100a",
    ],
    yellow: [
      "#fffae6",
      "#fff0b3",
      "#ffe680",
      "#ffdd4d",
      "#ffd41a",
      "#e6c200",
      "#ccaa00",
      "#b39500",
      "#998000",
      "#7a6200",
    ],
  },

  // Artistic spacing and radius system
  defaultRadius: "md",
  radius: {
    xs: "0.25rem", // 4px - subtle rounding
    sm: "0.375rem", // 6px
    md: "0.5rem", // 8px - refined default
    lg: "0.75rem", // 12px - gallery card style
    xl: "1rem", // 16px - generous, artistic
  },
  spacing: {
    xs: "0.625rem", // 10px - intentional micro
    sm: "1rem", // 16px
    md: "1.5rem", // 24px
    lg: "2rem", // 32px - generous breathing room
    xl: "2.5rem", // 40px - open, artistic
  },

  // Refined typography scale
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
    lg: "1.7",
    xl: "1.8",
  },

  // Artistic shadow system - softer, more atmospheric
  shadows: {
    xs: "0 1px 2px 0 rgb(168 87 125 / 0.04)",
    sm: "0 2px 4px 0 rgb(168 87 125 / 0.08), 0 1px 2px -1px rgb(168 87 125 / 0.04)",
    md: "0 4px 8px -2px rgb(168 87 125 / 0.12), 0 2px 4px -2px rgb(168 87 125 / 0.08)",
    lg: "0 8px 16px -4px rgb(168 87 125 / 0.15), 0 4px 8px -4px rgb(168 87 125 / 0.1)",
    xl: "0 20px 25px -5px rgb(168 87 125 / 0.2), 0 10px 15px -6px rgb(168 87 125 / 0.15)",
  },

  // Comprehensive component overrides for the artisan aesthetic
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
            lineHeight: "1.5",
            height: "2.5rem",
            paddingLeft: "1.25rem",
            paddingRight: "1.25rem",
            borderRadius: theme.radius.md,
            transition: "all 0.25s cubic-bezier(0.35, 0.1, 0.25, 1)",
            cursor: "pointer",
            border: "1px solid transparent",
            letterSpacing: "0.3px",
            "&:focus": {
              outline: "none",
              boxShadow: `0 0 0 2px ${theme.colorScheme === "dark" ? rgba(theme.colors.burgundy[2], 0.3) : rgba(theme.colors.burgundy[6], 0.2)}`,
            },
          },
          filled: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[5] : theme.colors.burgundy[6],
            color: theme.colorScheme === "dark" ? theme.colors.burgundy[0] : theme.colors.burgundy[0],
            "&:hover": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[4] : theme.colors.burgundy[7],
              transform: "translateY(-1px)",
              boxShadow: "0 4px 8px -2px rgb(168 87 125 / 0.12)",
            },
            "&:active": {
              transform: "translateY(0)",
              boxShadow: "0 2px 4px 0 rgb(168 87 125 / 0.08)",
            },
          },
          outline: {
            border: "1px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
            color: "var(--mantine-color-text)",
            "&:hover": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[8] : theme.colors.burgundy[1],
              borderColor: theme.colorScheme === "dark" ? theme.colors.burgundy[6] : theme.colors.burgundy[5],
            },
          },
          subtle: {
            backgroundColor: "transparent",
            color: "var(--mantine-color-text)",
            "&:hover": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[8] : theme.colors.burgundy[1],
            },
          },
          light: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[8] : theme.colors.burgundy[1],
            color: "var(--mantine-color-text)",
            "&:hover": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[7] : theme.colors.burgundy[2],
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
            boxShadow: "0 2px 4px 0 rgb(168 87 125 / 0.08)",
            borderRadius: theme.radius.lg,
            padding: theme.spacing.lg,
            transition: "all 0.25s cubic-bezier(0.35, 0.1, 0.25, 1)",
            "&:hover": {
              boxShadow: "0 4px 8px -2px rgb(168 87 125 / 0.12)",
            },
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
            transition: "all 0.25s cubic-bezier(0.35, 0.1, 0.25, 1)",
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
            padding: "0.625rem 1rem",
            transition: "all 0.2s ease",
            "&:focus": {
              borderColor: theme.colors.burgundy[5],
              boxShadow: `0 0 0 3px ${rgba(theme.colors.burgundy[5], 0.15)}`,
              outline: "none",
            },
            "&::placeholder": {
              color: theme.colors.burgundy[3],
              fontSize: "0.875rem",
              fontWeight: "400",
            },
          },
          label: {
            fontSize: "0.875rem",
            fontWeight: "500",
            color: "var(--mantine-color-text)",
            marginBottom: "0.5rem",
            letterSpacing: "0.2px",
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
            padding: "0.625rem 1rem",
            "&:focus": {
              borderColor: theme.colors.burgundy[5],
              boxShadow: `0 0 0 3px ${rgba(theme.colors.burgundy[5], 0.15)}`,
            },
          },
          dropdown: {
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: theme.radius.md,
            backgroundColor: "var(--mantine-color-body)",
            padding: "0.375rem",
            boxShadow: "0 4px 8px -2px rgb(168 87 125 / 0.12)",
          },
          item: {
            borderRadius: theme.radius.sm,
            fontSize: "0.875rem",
            padding: "0.625rem 1rem",
            "&[data-hovered]": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[7] : theme.colors.burgundy[1],
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
            padding: "1rem",
            minHeight: "5rem",
            resize: "vertical",
            transition: "all 0.2s ease",
            "&:focus": {
              borderColor: theme.colors.burgundy[5],
              boxShadow: `0 0 0 3px ${rgba(theme.colors.burgundy[5], 0.15)}`,
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
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[7] : theme.colors.burgundy[1],
            color: theme.colorScheme === "dark" ? theme.colors.burgundy[1] : theme.colors.burgundy[7],
            border: `1px solid ${theme.colorScheme === "dark" ? theme.colors.burgundy[6] : theme.colors.burgundy[2]}`,
            fontWeight: "500",
            fontSize: "0.75rem",
            height: "1.5rem",
            paddingLeft: "0.625rem",
            paddingRight: "0.625rem",
            borderRadius: theme.radius.md,
            letterSpacing: "0.5px",
          },
        } as Record<string, React.CSSProperties>),
    },

    Radio: {
      styles: (theme: any) =>
        ({
          radio: {
            width: "1rem",
            height: "1rem",
            border: "1.5px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
            transition: "all 0.2s ease",
            "&:checked": {
              backgroundColor: "var(--mantine-color-body)",
              borderColor: theme.colorScheme === "dark" ? theme.colors.burgundy[3] : theme.colors.burgundy[6],
              "&::before": {
                backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[3] : theme.colors.burgundy[6],
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
              boxShadow: `0 0 0 3px ${rgba(theme.colors.burgundy[5], 0.2)}`,
            },
          },
          label: {
            fontSize: "0.875rem",
            fontWeight: "400",
            color: "var(--mantine-color-text)",
            marginLeft: "0.75rem",
          },
        } as Record<string, React.CSSProperties>),
    },

    Checkbox: {
      styles: (theme: any) =>
        ({
          input: {
            width: "1rem",
            height: "1rem",
            borderRadius: theme.radius.xs,
            border: "1.5px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
            transition: "all 0.2s ease",
            "&:checked": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[3] : theme.colors.burgundy[6],
              borderColor: theme.colorScheme === "dark" ? theme.colors.burgundy[3] : theme.colors.burgundy[6],
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
            backgroundColor: theme.colors.burgundy[2],
            border: "none",
            width: "3rem",
            height: "1.625rem",
            transition: "all 0.3s cubic-bezier(0.35, 0.1, 0.25, 1)",
            "&[dataChecked]": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[4] : theme.colors.burgundy[5],
            },
          },
          thumb: {
            backgroundColor: theme.colors.burgundy[0],
            border: "none",
            width: "1.375rem",
            height: "1.375rem",
            boxShadow: "0 2px 4px 0 rgb(168 87 125 / 0.15)",
            transition: "all 0.3s cubic-bezier(0.35, 0.1, 0.25, 1)",
          },
        } as Record<string, React.CSSProperties>),
    },

    Modal: {
      defaultProps: {
        centered: true,
        radius: "lg",
        shadow: "lg",
      } as { centered: boolean; radius: string; shadow: string },
      styles: (theme: any) =>
        ({
          content: {
            borderRadius: theme.radius.lg,
            backgroundColor: "var(--mantine-color-body)",
            border: "1px solid var(--mantine-color-default-border)",
            boxShadow: "0 8px 16px -4px rgb(168 87 125 / 0.15)",
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
            overflow: "hidden",
          },
          thead: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[8] : theme.colors.burgundy[0],
          },
          th: {
            padding: "1rem",
            fontSize: "0.875rem",
            fontWeight: "600",
            color: theme.colorScheme === "dark" ? theme.colors.burgundy[2] : theme.colors.burgundy[7],
            borderBottom: "1px solid var(--mantine-color-default-border)",
            letterSpacing: "0.3px",
            "&:not(:last-child)": {
              borderRight: "1px solid var(--mantine-color-default-border)",
            },
          },
          td: {
            padding: "1rem",
            fontSize: "0.875rem",
            borderBottom: "1px solid var(--mantine-color-default-border)",
            "&:not(:last-child)": {
              borderRight: "1px solid var(--mantine-color-default-border)",
            },
          },
          tr: {
            transition: "all 0.2s ease",
            "&:hover": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[8] : theme.colors.burgundy[0],
            },
          },
        } as Record<string, React.CSSProperties>),
    },

    Progress: {
      styles: (theme: any) =>
        ({
          root: {
            backgroundColor: theme.colors.burgundy[1],
            borderRadius: "9999px",
            height: "0.5rem",
          },
          bar: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[4] : theme.colors.burgundy[6],
            borderRadius: "9999px",
            transition: "all 0.4s cubic-bezier(0.35, 0.1, 0.25, 1)",
          },
        } as Record<string, React.CSSProperties>),
    },

    Tabs: {
      styles: (theme: any) =>
        ({
          tabsList: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[8] : theme.colors.burgundy[0],
            padding: "0.375rem",
            borderRadius: theme.radius.lg,
            gap: "0.25rem",
          },
          tab: {
            borderRadius: theme.radius.md,
            fontSize: "0.875rem",
            fontWeight: "500",
            padding: "0.625rem 1.25rem",
            color: theme.colors.burgundy[4],
            transition: "all 0.25s cubic-bezier(0.35, 0.1, 0.25, 1)",
            "&[data-active]": {
              backgroundColor: "var(--mantine-color-body)",
              color: "var(--mantine-color-text)",
              boxShadow: "0 2px 4px 0 rgb(168 87 125 / 0.08)",
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
            padding: "0.375rem",
            boxShadow: "0 4px 8px -2px rgb(168 87 125 / 0.12)",
          },
          item: {
            borderRadius: theme.radius.md,
            fontSize: "0.875rem",
            padding: "0.625rem 1rem",
            transition: "all 0.15s ease",
            "&[data-hovered]": {
              backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[7] : theme.colors.burgundy[1],
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
            boxShadow: "0 4px 8px -2px rgb(168 87 125 / 0.12)",
          },
        } as Record<string, React.CSSProperties>),
    },

    Tooltip: {
      styles: (theme: any) =>
        ({
          tooltip: {
            backgroundColor: theme.colorScheme === "dark" ? theme.colors.burgundy[2] : theme.colors.burgundy[7],
            color: theme.colorScheme === "dark" ? theme.colors.burgundy[8] : theme.colors.burgundy[0],
            borderRadius: theme.radius.md,
            fontSize: "0.75rem",
            padding: "0.625rem 0.875rem",
            border: "none",
            boxShadow: "0 2px 4px 0 rgb(168 87 125 / 0.15)",
            fontWeight: "500",
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

export default mantineArtisan;

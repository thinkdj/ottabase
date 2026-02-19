import type { MantineThemeOverride } from '@mantine/core';

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
 * A comprehensive Mantine theme with a luminous aurora palette:
 * - Signature violet/blue gradient accent colors
 * - Clean, professional forms optimized for finance and business
 * - Sophisticated color palette with excellent contrast
 * - Modern typography with Inter font
 * - Subtle gradients and premium feel
 * - Comprehensive component overrides for polished applications
 */
export const mantineAurora: MantineThemeOverride = {
    primaryColor: 'violet',
    primaryShade: 6,
    fontFamily:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    headings: {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontWeight: '600',
        sizes: {
            h1: { fontSize: '3rem', lineHeight: '1.2' },
            h2: { fontSize: '2.25rem', lineHeight: '1.3' },
            h3: { fontSize: '1.875rem', lineHeight: '1.4' },
            h4: { fontSize: '1.5rem', lineHeight: '1.5' },
            h5: { fontSize: '1.25rem', lineHeight: '1.5' },
            h6: { fontSize: '1.125rem', lineHeight: '1.5' },
        },
    },

    // Aurora color system
    colors: {
        // Violet (Primary)
        violet: [
            '#f8f7ff',
            '#f1efff',
            '#e9e6ff',
            '#d4ceff',
            '#b8acff',
            '#9b8aff',
            '#7c6bff',
            '#6b5dff',
            '#5a52d5',
            '#4c44b0',
        ],
        // Blue (Secondary)
        blue: [
            '#f0f9ff',
            '#e0f3ff',
            '#bae6ff',
            '#7dd3fc',
            '#38bdf8',
            '#0ea5e9',
            '#0284c7',
            '#0369a1',
            '#075985',
            '#0c4a6e',
        ],
        // Success Green
        green: [
            '#f0fdf4',
            '#dcfce7',
            '#bbf7d0',
            '#86efac',
            '#4ade80',
            '#22c55e',
            '#16a34a',
            '#15803d',
            '#166534',
            '#14532d',
        ],
        // Warning/Error Red
        red: [
            '#fef2f2',
            '#fee2e2',
            '#fecaca',
            '#fca5a5',
            '#f87171',
            '#ef4444',
            '#dc2626',
            '#b91c1c',
            '#991b1b',
            '#7f1d1d',
        ],
        // Neutral Gray
        gray: [
            '#ffffff',
            '#f9fafb',
            '#f3f4f6',
            '#e5e7eb',
            '#d1d5db',
            '#9ca3af',
            '#6b7280',
            '#4b5563',
            '#374151',
            '#1f2937',
        ],
        // Keep as 'dark' for Mantine compatibility
        dark: [
            '#ffffff',
            '#f9fafb',
            '#f3f4f6',
            '#e5e7eb',
            '#d1d5db',
            '#9ca3af',
            '#6b7280',
            '#4b5563',
            '#374151',
            '#1f2937',
        ],
    },

    // Modern spacing and radius system
    defaultRadius: 'md',
    radius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
    },
    spacing: {
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
    },

    // Typography scale
    fontSizes: {
        xs: '0.75rem', // 12px
        sm: '0.875rem', // 14px
        md: '1rem', // 16px
        lg: '1.125rem', // 18px
        xl: '1.25rem', // 20px
    },

    lineHeights: {
        xs: '1.4',
        sm: '1.5',
        md: '1.6',
        lg: '1.65',
        xl: '1.7',
    },

    // Sophisticated shadow system
    shadows: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    },

    // Comprehensive component overrides for the aurora aesthetic
    components: {
        Button: {
            defaultProps: {
                radius: 'md',
                size: 'md',
            } as { radius: string; size: string },
            styles: (theme: any) =>
                ({
                    root: {
                        fontWeight: '500',
                        fontSize: '0.875rem',
                        lineHeight: '1.25rem',
                        height: '2.5rem',
                        paddingLeft: '1rem',
                        paddingRight: '1rem',
                        borderRadius: theme.radius.md,
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                        border: '1px solid transparent',
                        '&:focus': {
                            outline: 'none',
                            boxShadow: '0 0 0 3px rgba(99, 91, 255, 0.1)',
                        },
                    },
                    filled: {
                        background: `linear-gradient(180deg, ${theme.colors.violet[6]} 0%, ${theme.colors.violet[7]} 100%)`,
                        color: '#ffffff',
                        boxShadow: `0 4px 6px -1px ${rgba(theme.colors.violet[7], 0.4)}`,
                        '&:hover': {
                            background: `linear-gradient(180deg, ${theme.colors.violet[5]} 0%, ${theme.colors.violet[6]} 100%)`,
                            transform: 'translateY(-1px)',
                            boxShadow: `0 6px 12px -1px ${rgba(theme.colors.violet[7], 0.4)}`,
                        },
                        '&:active': {
                            background: `linear-gradient(180deg, ${theme.colors.violet[7]} 0%, ${theme.colors.violet[8]} 100%)`,
                            transform: 'translateY(0)',
                        },
                    },
                    outline: {
                        backgroundColor: 'var(--mantine-color-body)',
                        border: '1.5px solid var(--mantine-color-default-border)',
                        color: 'var(--mantine-color-text)',
                        '&:hover': {
                            backgroundColor: 'var(--mantine-color-gray-light-hover)',
                            borderColor: 'var(--mantine-color-default-border)',
                        },
                        '&:active': {
                            backgroundColor: 'var(--mantine-color-gray-light)',
                            borderColor: '#9ca3af',
                        },
                    },
                    light: {
                        backgroundColor: rgba(theme.colors.violet[7], 0.08),
                        color: theme.colors.violet[7],
                        border: `1px solid ${rgba(theme.colors.violet[7], 0.2)}`,
                        '&:hover': {
                            backgroundColor: rgba(theme.colors.violet[7], 0.12),
                            borderColor: rgba(theme.colors.violet[7], 0.3),
                        },
                    },
                    subtle: {
                        backgroundColor: 'transparent',
                        color: 'var(--mantine-color-text)',
                        '&:hover': {
                            backgroundColor: 'var(--mantine-color-gray-light-hover)',
                        },
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Card: {
            defaultProps: {
                radius: 'lg',
                padding: 'xl',
                shadow: 'lg',
            } as { radius: string; padding: string; shadow: string },
            styles: (theme: any) =>
                ({
                    root: {
                        backgroundColor: 'var(--mantine-color-body)',
                        border: '1px solid var(--mantine-color-default-border)',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            borderColor: 'var(--mantine-color-default-border)',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                        },
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Paper: {
            styles: (theme: any) =>
                ({
                    root: {
                        backgroundColor: 'var(--mantine-color-body)',
                        border: '1px solid var(--mantine-color-default-border)',
                        borderRadius: '12px',
                        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                    },
                }) as Record<string, React.CSSProperties>,
        },

        TextInput: {
            defaultProps: {
                size: 'md',
                radius: 'md',
            } as { size: string; radius: string },
            styles: (theme: any) =>
                ({
                    input: {
                        height: '2.75rem',
                        padding: '0 0.875rem',
                        fontSize: '0.875rem',
                        borderRadius: theme.radius.md,
                        border: '1.5px solid #e5e7eb',
                        backgroundColor: 'var(--mantine-color-body)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            borderColor: 'var(--mantine-color-default-border)',
                        },
                        '&:focus': {
                            borderColor: theme.colors.violet[7],
                            boxShadow: `0 0 0 3px ${rgba(theme.colors.violet[7], 0.1)}`,
                            outline: 'none',
                        },
                        '&::placeholder': {
                            color: '#9ca3af',
                            fontSize: '0.875rem',
                        },
                    },
                    label: {
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: 'var(--mantine-color-text)',
                        marginBottom: '0.5rem',
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Select: {
            defaultProps: {
                size: 'md',
                radius: 'md',
            } as { size: string; radius: string },
            styles: (theme: any) =>
                ({
                    input: {
                        height: '2.75rem',
                        padding: '0 0.875rem',
                        fontSize: '0.875rem',
                        borderRadius: theme.radius.md,
                        border: '1.5px solid #e5e7eb',
                        backgroundColor: 'var(--mantine-color-body)',
                        '&:hover': {
                            borderColor: 'var(--mantine-color-default-border)',
                        },
                        '&:focus': {
                            borderColor: theme.colors.violet[7],
                            boxShadow: `0 0 0 3px ${rgba(theme.colors.violet[7], 0.1)}`,
                        },
                    },
                    dropdown: {
                        border: '1px solid var(--mantine-color-default-border)',
                        borderRadius: theme.radius.lg,
                        backgroundColor: 'var(--mantine-color-body)',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                        padding: '0.25rem',
                    },
                    item: {
                        fontSize: '0.875rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: theme.radius.md,
                        '&[data-hovered]': {
                            backgroundColor: 'var(--mantine-color-gray-light-hover)',
                        },
                        '&[data-selected]': {
                            backgroundColor: rgba(theme.colors.violet[7], 0.1),
                            color: theme.colors.violet[7],
                            fontWeight: '500',
                        },
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Textarea: {
            styles: (theme: any) =>
                ({
                    input: {
                        padding: '0.875rem',
                        fontSize: '0.875rem',
                        borderRadius: theme.radius.md,
                        border: '1.5px solid #e5e7eb',
                        backgroundColor: 'var(--mantine-color-body)',
                        minHeight: '6rem',
                        resize: 'vertical',
                        '&:hover': {
                            borderColor: 'var(--mantine-color-default-border)',
                        },
                        '&:focus': {
                            borderColor: theme.colors.violet[7],
                            boxShadow: `0 0 0 3px ${rgba(theme.colors.violet[7], 0.1)}`,
                        },
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Badge: {
            defaultProps: {
                radius: 'lg',
                variant: 'light',
            } as { radius: string; variant: string },
            styles: (theme: any) =>
                ({
                    root: {
                        background: `linear-gradient(135deg, ${rgba(theme.colors.violet[7], 0.1)} 0%, ${rgba(theme.colors.violet[6], 0.1)} 100%)`,
                        color: theme.colors.violet[7],
                        border: `1px solid ${rgba(theme.colors.violet[7], 0.2)}`,
                        fontWeight: '500',
                        fontSize: '0.75rem',
                        height: '1.5rem',
                        padding: '0 0.75rem',
                        borderRadius: theme.radius.lg,
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Radio: {
            styles: (theme: any) =>
                ({
                    radio: {
                        width: '1.125rem',
                        height: '1.125rem',
                        border: '1.5px solid #e5e7eb',
                        backgroundColor: 'var(--mantine-color-body)',
                        '&:checked': {
                            backgroundColor: 'var(--mantine-color-body)',
                            borderColor: theme.colors.violet[7],
                            '&::before': {
                                backgroundColor: theme.colors.violet[7],
                                width: '0.5rem',
                                height: '0.5rem',
                                borderRadius: '50%',
                                content: '""',
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                            },
                        },
                        '&:hover': {
                            borderColor: 'var(--mantine-color-default-border)',
                        },
                        '&:focus': {
                            boxShadow: `0 0 0 3px ${rgba(theme.colors.violet[7], 0.1)}`,
                            outline: 'none',
                        },
                    },
                    label: {
                        fontSize: '0.875rem',
                        fontWeight: '400',
                        color: 'var(--mantine-color-text)',
                        marginLeft: '0.5rem',
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Checkbox: {
            styles: (theme: any) =>
                ({
                    input: {
                        width: '1.125rem',
                        height: '1.125rem',
                        borderRadius: theme.radius.sm,
                        border: '1.5px solid #e5e7eb',
                        backgroundColor: 'var(--mantine-color-body)',
                        '&:checked': {
                            backgroundColor: theme.colors.violet[7],
                            borderColor: theme.colors.violet[7],
                        },
                        '&:hover': {
                            borderColor: 'var(--mantine-color-default-border)',
                        },
                        '&:focus': {
                            boxShadow: `0 0 0 3px ${rgba(theme.colors.violet[7], 0.1)}`,
                        },
                    },
                    label: {
                        fontSize: '0.875rem',
                        fontWeight: '400',
                        color: 'var(--mantine-color-text)',
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Switch: {
            styles: (theme: any) =>
                ({
                    track: {
                        backgroundColor: '#d1d5db',
                        border: 'none',
                        width: '3rem',
                        height: '1.5rem',
                        '&[dataChecked]': {
                            background: `linear-gradient(135deg, ${theme.colors.violet[6]} 0%, ${theme.colors.violet[7]} 100%)`,
                        },
                    },
                    thumb: {
                        backgroundColor: 'var(--mantine-color-body)',
                        border: 'none',
                        width: '1.25rem',
                        height: '1.25rem',
                        boxShadow: '0 2px 4px 0 rgb(0 0 0 / 0.2)',
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Modal: {
            defaultProps: {
                centered: true,
                radius: 'lg',
                shadow: 'xl',
            } as { centered: boolean; radius: string; shadow: string },
            styles: (theme: any) =>
                ({
                    content: {
                        borderRadius: '16px',
                        backgroundColor: 'var(--mantine-color-body)',
                        border: '1px solid var(--mantine-color-default-border)',
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                    },
                    header: {
                        backgroundColor: 'var(--mantine-color-body)',
                        borderBottom: '1px solid var(--mantine-color-default-border)',
                        padding: '1.5rem 2rem',
                        borderTopLeftRadius: '16px',
                        borderTopRightRadius: '16px',
                    },
                    body: {
                        padding: '2rem',
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Table: {
            styles: (theme: any) =>
                ({
                    table: {
                        borderCollapse: 'separate',
                        borderSpacing: '0',
                        width: '100%',
                        backgroundColor: 'var(--mantine-color-body)',
                        border: '1px solid var(--mantine-color-default-border)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                    },
                    thead: {
                        backgroundColor: 'var(--mantine-color-gray-light)',
                    },
                    th: {
                        padding: '1rem 1.5rem',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: 'var(--mantine-color-dimmed)',
                        borderBottom: '1px solid var(--mantine-color-default-border)',
                        '&:not(:last-child)': {
                            borderRight: '1px solid var(--mantine-color-default-border)',
                        },
                    },
                    td: {
                        padding: '1rem 1.5rem',
                        fontSize: '0.875rem',
                        color: 'var(--mantine-color-text)',
                        borderBottom: '1px solid var(--mantine-color-default-border)',
                        '&:not(:last-child)': {
                            borderRight: '1px solid var(--mantine-color-default-border)',
                        },
                    },
                    tr: {
                        '&:hover': {
                            backgroundColor: 'var(--mantine-color-gray-light-hover)',
                        },
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Progress: {
            styles: (theme: any) =>
                ({
                    root: {
                        backgroundColor: 'var(--mantine-color-gray-light)',
                        borderRadius: '9999px',
                        height: '0.5rem',
                    },
                    bar: {
                        background: `linear-gradient(90deg, ${theme.colors.violet[6]} 0%, ${theme.colors.violet[7]} 100%)`,
                        borderRadius: '9999px',
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Tabs: {
            styles: (theme: any) =>
                ({
                    tabsList: {
                        backgroundColor: 'var(--mantine-color-gray-light)',
                        padding: '0.25rem',
                        borderRadius: theme.radius.lg,
                        border: '1px solid var(--mantine-color-default-border)',
                    },
                    tab: {
                        borderRadius: theme.radius.md,
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        padding: '0.5rem 1rem',
                        color: 'var(--mantine-color-dimmed)',
                        transition: 'all 0.2s ease',
                        '&[data-active]': {
                            backgroundColor: 'var(--mantine-color-body)',
                            color: theme.colors.violet[7],
                            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                        },
                        '&:hover:not([data-active])': {
                            color: 'var(--mantine-color-text)',
                        },
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Menu: {
            styles: (theme: any) =>
                ({
                    dropdown: {
                        border: '1px solid var(--mantine-color-default-border)',
                        borderRadius: theme.radius.lg,
                        backgroundColor: 'var(--mantine-color-body)',
                        padding: '0.5rem',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                    },
                    item: {
                        borderRadius: theme.radius.md,
                        fontSize: '0.875rem',
                        padding: '0.5rem 0.75rem',
                        color: 'var(--mantine-color-text)',
                        '&[data-hovered]': {
                            backgroundColor: 'var(--mantine-color-gray-light-hover)',
                        },
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Popover: {
            styles: (theme: any) =>
                ({
                    dropdown: {
                        border: '1px solid var(--mantine-color-default-border)',
                        borderRadius: theme.radius.lg,
                        backgroundColor: 'var(--mantine-color-body)',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Tooltip: {
            styles: (theme: any) =>
                ({
                    tooltip: {
                        backgroundColor: '#1f2937',
                        color: '#ffffff',
                        borderRadius: theme.radius.md,
                        fontSize: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        border: 'none',
                        fontWeight: '500',
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Alert: {
            styles: (theme: any) =>
                ({
                    root: {
                        backgroundColor: 'var(--mantine-color-body)',
                        border: '1px solid var(--mantine-color-default-border)',
                        borderRadius: theme.radius.lg,
                        padding: '1rem 1.5rem',
                    },
                }) as Record<string, React.CSSProperties>,
        },

        Notification: {
            styles: (theme: any) =>
                ({
                    root: {
                        backgroundColor: 'var(--mantine-color-body)',
                        border: '1px solid var(--mantine-color-default-border)',
                        borderRadius: theme.radius.lg,
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                    },
                }) as Record<string, React.CSSProperties>,
        },
    },
};

export default mantineAurora;

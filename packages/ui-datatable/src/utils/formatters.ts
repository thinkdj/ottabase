// ============================================================
// @ottabase/ui-datatable - Cell Formatters
// ============================================================
// Utility functions for formatting cell values
// ============================================================

import React from 'react';

/**
 * Format a cell value based on a named format.
 * Returns a React node for rendering.
 */
export function formatCellValue(
    value: unknown,
    format: 'date' | 'datetime' | 'boolean' | 'currency' | 'percentage' | 'image' | 'link' | 'badge',
): React.ReactNode {
    if (value === null || value === undefined) {
        return React.createElement('span', { className: 'text-muted-foreground' }, '—');
    }

    switch (format) {
        case 'date':
            return new Date(value as string).toLocaleDateString();

        case 'datetime':
            return new Date(value as string).toLocaleString();

        case 'boolean':
            return value
                ? React.createElement(
                      'span',
                      {
                          className:
                              'inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary',
                      },
                      'Yes',
                  )
                : React.createElement(
                      'span',
                      {
                          className:
                              'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
                      },
                      'No',
                  );

        case 'currency':
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
            }).format(Number(value));

        case 'percentage':
            return `${Number(value).toFixed(1)}%`;

        case 'image':
            return React.createElement('img', {
                src: String(value),
                alt: '',
                className: 'h-8 w-8 rounded-full object-cover',
            });

        case 'link':
            return React.createElement(
                'a',
                {
                    href: String(value),
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className: 'text-primary hover:underline',
                    onClick: (e: React.MouseEvent) => e.stopPropagation(),
                },
                String(value),
            );

        case 'badge':
            return React.createElement(
                'span',
                {
                    className:
                        'inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary',
                },
                String(value),
            );

        default:
            return String(value);
    }
}

/**
 * Truncate a string to a max length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '…';
}

// ============================================================
// @ottabase/forms - ModelDetail Component
// ============================================================
// Auto-generated detail view from model metadata
// ============================================================

import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { ArrowLeft, Edit2, Trash2, Check, X, ExternalLink, Image as ImageIcon } from 'lucide-react';
import type { ModelDetailProps, ModelFieldDescriptor } from '../types';

// Re-export for backwards compatibility
export type { ModelDetailProps } from '../types';

interface FieldEntry {
    key: string;
    field: ModelFieldDescriptor;
    order: number;
}

/**
 * ModelDetail - Auto-generated detail view for a model record
 * Displays all fields in a key/value table format
 */
export function ModelDetail<T extends Record<string, unknown>>({
    config,
    data,
    onEdit,
    onDelete,
    onBack,
    isLoading = false,
    className,
}: ModelDetailProps<T>) {
    // Get all displayable fields sorted by order
    const fields = useMemo(() => {
        const entries: FieldEntry[] = [];

        for (const [key, field] of Object.entries(config.fields)) {
            // Include all fields in detail view (unless explicitly hidden)
            if (field.formConfig?.fieldType === 'hidden') continue;

            entries.push({
                key,
                field,
                order: field.tableConfig?.order ?? field.formConfig?.order ?? 999,
            });
        }

        return entries.sort((a, b) => a.order - b.order);
    }, [config.fields]);

    const primaryKey = config.primaryKey || 'id';
    const displayName = config.displayName || capitalize(singularize(config.entity));
    const recordId = data[primaryKey];

    if (isLoading) {
        return (
            <div className={clsx('animate-pulse space-y-4', className)}>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                <div className="space-y-3">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={clsx('space-y-6', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            {displayName} Details
                        </h2>
                        {recordId != null && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">ID: {String(recordId)}</p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                {(onEdit || onDelete) && (
                    <div className="flex items-center gap-2">
                        {onEdit && (
                            <button
                                onClick={onEdit}
                                className={clsx(
                                    'px-4 py-2 rounded-lg font-medium transition-colors',
                                    'bg-blue-600 hover:bg-blue-700 text-white',
                                    'flex items-center gap-2',
                                )}
                            >
                                <Edit2 className="w-4 h-4" />
                                Edit
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={onDelete}
                                className={clsx(
                                    'px-4 py-2 rounded-lg font-medium transition-colors',
                                    'bg-red-600 hover:bg-red-700 text-white',
                                    'flex items-center gap-2',
                                )}
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Detail Table */}
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full">
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {fields.map(({ key, field }) => (
                            <tr key={key} className="bg-white dark:bg-gray-900">
                                {/* Label */}
                                <td className="px-4 py-3 w-1/4 bg-gray-50 dark:bg-gray-800">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {field.uiConfig?.label || capitalize(key)}
                                    </span>
                                    {field.uiConfig?.description && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            {field.uiConfig.description}
                                        </p>
                                    )}
                                </td>

                                {/* Value */}
                                <td className="px-4 py-3">
                                    <DetailValue value={data[key]} field={field} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ============================================================
// Detail Value Component
// ============================================================

interface DetailValueProps {
    value: unknown;
    field: ModelFieldDescriptor;
}

function DetailValue({ value, field }: DetailValueProps) {
    const format = field.tableConfig?.format;

    // Handle null/undefined
    if (value === null || value === undefined) {
        return <span className="text-gray-400 dark:text-gray-500 italic">Not set</span>;
    }

    // Handle specific formats
    if (format) {
        switch (format) {
            case 'date':
                return (
                    <span className="text-gray-900 dark:text-gray-100">
                        {new Date(value as string).toLocaleDateString(undefined, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </span>
                );
            case 'datetime':
                return (
                    <span className="text-gray-900 dark:text-gray-100">
                        {new Date(value as string).toLocaleString()}
                    </span>
                );
            case 'boolean':
                return value ? (
                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                        <Check className="w-4 h-4" />
                        Yes
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <X className="w-4 h-4" />
                        No
                    </span>
                );
            case 'currency':
                return (
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                        }).format(Number(value))}
                    </span>
                );
            case 'percentage':
                return <span className="text-gray-900 dark:text-gray-100">{Number(value).toFixed(1)}%</span>;
            case 'image':
                return (
                    <div className="flex items-center gap-3">
                        <img
                            src={String(value)}
                            alt=""
                            className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                        />
                        <a
                            href={String(value)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                            View full size
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                );
            case 'link':
                return (
                    <a
                        href={String(value)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                        {String(value)}
                        <ExternalLink className="w-3 h-3" />
                    </a>
                );
        }
    }

    // Handle by field type
    switch (field.type) {
        case 'boolean':
            return value ? (
                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                    <Check className="w-4 h-4" />
                    Yes
                </span>
            ) : (
                <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <X className="w-4 h-4" />
                    No
                </span>
            );

        case 'date':
            return (
                <span className="text-gray-900 dark:text-gray-100">
                    {new Date(value as string).toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}
                </span>
            );

        case 'datetime':
            return (
                <span className="text-gray-900 dark:text-gray-100">{new Date(value as string).toLocaleString()}</span>
            );

        case 'json':
            return (
                <pre className="text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto max-h-48">
                    <code className="text-gray-800 dark:text-gray-200">{JSON.stringify(value, null, 2)}</code>
                </pre>
            );

        case 'array':
            if (Array.isArray(value)) {
                if (value.length === 0) {
                    return <span className="text-gray-400 italic">Empty</span>;
                }
                return (
                    <div className="flex flex-wrap gap-1">
                        {value.map((item, index) => (
                            <span
                                key={index}
                                className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded"
                            >
                                {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                            </span>
                        ))}
                    </div>
                );
            }
            return <span className="text-gray-900 dark:text-gray-100">{String(value)}</span>;

        case 'id':
            return (
                <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                    {String(value)}
                </code>
            );

        default:
            // Check if it looks like a URL
            if (typeof value === 'string' && isUrl(value)) {
                return (
                    <a
                        href={value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                        {value}
                        <ExternalLink className="w-3 h-3" />
                    </a>
                );
            }

            // Check if it looks like an image URL
            if (typeof value === 'string' && isImageUrl(value)) {
                return (
                    <div className="flex items-center gap-3">
                        <img
                            src={value}
                            alt=""
                            className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                        <a
                            href={value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                            View image
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                );
            }

            // Long text - show in a textarea-like box
            const stringValue = String(value);
            if (stringValue.length > 200 || stringValue.includes('\n')) {
                return (
                    <div className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded-lg max-h-48 overflow-y-auto">
                        {stringValue}
                    </div>
                );
            }

            return <span className="text-gray-900 dark:text-gray-100">{stringValue}</span>;
    }
}

// ============================================================
// Utility Functions
// ============================================================

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function singularize(str: string): string {
    if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (str.endsWith('s')) return str.slice(0, -1);
    return str;
}

function isUrl(str: string): boolean {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
}

function isImageUrl(str: string): boolean {
    if (!isUrl(str)) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const lowerStr = str.toLowerCase();
    return imageExtensions.some((ext) => lowerStr.includes(ext));
}

export default ModelDetail;

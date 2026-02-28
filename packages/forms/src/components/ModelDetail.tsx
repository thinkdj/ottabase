// ============================================================
// @ottabase/forms - ModelDetail Component
// ============================================================
// Auto-generated detail view from model metadata
// ============================================================

import { clsx } from 'clsx';
import { ArrowLeft, Check, Edit2, ExternalLink, Trash2, X } from 'lucide-react';
import { useMemo } from 'react';
import type { ModelDetailProps, ModelFieldDescriptor } from '../types';

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
                <div className="h-8 bg-muted rounded w-1/3" />
                <div className="space-y-3">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-12 bg-muted/60 rounded" />
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
                            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div>
                        <h2 className="text-xl font-semibold text-foreground">{displayName} Details</h2>
                        {recordId != null && <p className="text-sm text-muted-foreground">ID: {String(recordId)}</p>}
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
                                    'bg-primary hover:bg-primary/90 text-primary-foreground',
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
                                    'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
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
            <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full">
                    <tbody className="divide-y divide-border">
                        {fields.map(({ key, field }) => (
                            <tr key={key} className="bg-background">
                                {/* Label */}
                                <td className="px-4 py-3 w-1/4 bg-muted/50">
                                    <span className="text-sm font-medium text-foreground">
                                        {field.uiConfig?.label || capitalize(key)}
                                    </span>
                                    {field.uiConfig?.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
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
        return <span className="text-muted-foreground italic">Not set</span>;
    }

    // Handle specific formats
    if (format) {
        switch (format) {
            case 'date':
                return (
                    <span className="text-foreground">
                        {new Date(value as string).toLocaleDateString(undefined, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </span>
                );
            case 'datetime':
                return <span className="text-foreground">{new Date(value as string).toLocaleString()}</span>;
            case 'boolean':
                return value ? (
                    <span className="inline-flex items-center gap-1 text-primary">
                        <Check className="w-4 h-4" />
                        Yes
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <X className="w-4 h-4" />
                        No
                    </span>
                );
            case 'currency':
                return (
                    <span className="text-foreground font-medium">
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                        }).format(Number(value))}
                    </span>
                );
            case 'percentage':
                return <span className="text-foreground">{Number(value).toFixed(1)}%</span>;
            case 'image':
                return (
                    <div className="flex items-center gap-3">
                        <img
                            src={String(value)}
                            alt=""
                            className="w-16 h-16 rounded-lg object-cover border border-border"
                        />
                        <a
                            href={String(value)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
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
                        className="text-primary hover:underline flex items-center gap-1"
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
                <span className="inline-flex items-center gap-1 text-primary">
                    <Check className="w-4 h-4" />
                    Yes
                </span>
            ) : (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <X className="w-4 h-4" />
                    No
                </span>
            );

        case 'date':
            return (
                <span className="text-foreground">
                    {new Date(value as string).toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}
                </span>
            );

        case 'datetime':
            return <span className="text-foreground">{new Date(value as string).toLocaleString()}</span>;

        case 'json':
            return (
                <pre className="text-sm bg-muted p-3 rounded-lg overflow-x-auto max-h-48">
                    <code className="text-foreground">{JSON.stringify(value, null, 2)}</code>
                </pre>
            );

        case 'array':
            if (Array.isArray(value)) {
                if (value.length === 0) {
                    return <span className="text-muted-foreground italic">Empty</span>;
                }
                return (
                    <div className="flex flex-wrap gap-1">
                        {value.map((item, index) => (
                            <span key={index} className="px-2 py-1 text-sm bg-muted text-foreground rounded">
                                {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                            </span>
                        ))}
                    </div>
                );
            }
            return <span className="text-foreground">{String(value)}</span>;

        case 'id':
            return <code className="text-sm bg-muted px-2 py-1 rounded text-foreground">{String(value)}</code>;

        default:
            // Check if it looks like a URL
            if (typeof value === 'string' && isUrl(value)) {
                return (
                    <a
                        href={value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
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
                            className="w-16 h-16 rounded-lg object-cover border border-border"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                        <a
                            href={value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
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
                    <div className="text-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-lg max-h-48 overflow-y-auto">
                        {stringValue}
                    </div>
                );
            }

            return <span className="text-foreground">{stringValue}</span>;
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

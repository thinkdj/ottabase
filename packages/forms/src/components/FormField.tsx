// ============================================================
// @ottabase/forms - FormField Component
// ============================================================
// Auto-renders the correct input based on model field metadata
// ============================================================

import { OttaSelect, type OttaSelectItem } from '@ottabase/ottaselect';
import { JsonEditor } from 'json-edit-react';
import { clsx } from 'clsx';
import { AlertCircle, Calendar, Check, Eye, EyeOff, Upload, X } from 'lucide-react';
import React, { useCallback } from 'react';
import type { FormFieldProps, ModelFieldDescriptor } from '../types';

export type { FormFieldProps };

/**
 * FormField - Renders the appropriate input based on field type
 */
export function FormField({
    name,
    label,
    value,
    onChange,
    field,
    error,
    disabled = false,
    className,
    apiBasePath = '/api/ottaorm',
    onBlur,
}: FormFieldProps) {
    const formConfig = field.formConfig || {};
    const uiConfig = field.uiConfig || {};
    const fieldType = formConfig.fieldType || inferFieldType(field);

    const placeholder = formConfig.placeholder || uiConfig.placeholder || `Enter ${label.toLowerCase()}`;
    const helpText = formConfig.helpText || uiConfig.hint;

    const baseInputClasses = clsx(
        'w-full px-3 py-2 rounded-lg border transition-colors duration-150',
        'bg-white dark:bg-gray-800',
        'text-gray-900 dark:text-gray-100',
        'placeholder:text-gray-400 dark:placeholder:text-gray-500',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent',
        error
            ? 'border-red-500 dark:border-red-400'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
        disabled && 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900',
    );

    // Check if value is an object (not null, not array, not Date, not primitive)
    const isObjectValue = React.useMemo(() => {
        if (value === null || value === undefined) return false;
        if (Array.isArray(value)) return false;
        if (value instanceof Date) return false;
        return typeof value === 'object' && value.constructor === Object;
    }, [value]);

    // Use JSON editor when field is explicitly 'json' or when value is an object
    const useJsonEditor = fieldType === 'json' || (isObjectValue && fieldType !== 'readonly');

    const renderField = () => {
        if (useJsonEditor) {
            return (
                <JsonField
                    name={name}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    placeholder={placeholder || '{}'}
                    rows={formConfig.rows || 6}
                    className={clsx(baseInputClasses, 'font-mono text-sm resize-y min-h-[150px]')}
                />
            );
        }

        switch (fieldType) {
            case 'editor':
                return (
                    <JsonField
                        name={name}
                        value={value}
                        onChange={onChange}
                        disabled={disabled}
                        placeholder={placeholder || '{}'}
                        rows={formConfig.rows || 10}
                        className={clsx(baseInputClasses, 'font-mono text-sm resize-y min-h-[220px]')}
                    />
                );
            case 'textarea':
                return (
                    <textarea
                        id={name}
                        name={name}
                        value={(value as string) || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        disabled={disabled}
                        rows={formConfig.rows || 4}
                        className={clsx(baseInputClasses, 'resize-y min-h-[100px]')}
                    />
                );

            case 'number':
                return (
                    <input
                        type="number"
                        id={name}
                        name={name}
                        value={value !== undefined && value !== null ? String(value) : ''}
                        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
                        placeholder={placeholder}
                        disabled={disabled}
                        min={formConfig.min}
                        max={formConfig.max}
                        step={formConfig.step}
                        className={baseInputClasses}
                    />
                );

            case 'email':
                return (
                    <input
                        type="email"
                        id={name}
                        name={name}
                        value={(value as string) || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        disabled={disabled}
                        className={baseInputClasses}
                    />
                );

            case 'password':
                return (
                    <PasswordField
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        disabled={disabled}
                        name={name}
                        className={baseInputClasses}
                        showHints={field.formConfig?.showPasswordHints}
                        minLength={field.formConfig?.min}
                    />
                );

            case 'url':
                return (
                    <input
                        type="url"
                        id={name}
                        name={name}
                        value={(value as string) || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder || 'https://'}
                        disabled={disabled}
                        className={baseInputClasses}
                    />
                );

            case 'tel':
                return (
                    <input
                        type="tel"
                        id={name}
                        name={name}
                        value={(value as string) || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        disabled={disabled}
                        className={baseInputClasses}
                    />
                );

            case 'date':
                return (
                    <div className="relative">
                        <input
                            type="date"
                            id={name}
                            name={name}
                            value={formatDateValue(value)}
                            onChange={(e) => {
                                if (!e.target.value) {
                                    onChange(null);
                                    return;
                                }
                                const [year, month, day] = e.target.value.split('-').map((v) => Number(v));
                                const utcMillis = Date.UTC(year, (month || 1) - 1, day || 1);
                                onChange(new Date(utcMillis));
                            }}
                            disabled={disabled}
                            className={baseInputClasses}
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                );

            case 'datetime':
                return (
                    <input
                        type="datetime-local"
                        id={name}
                        name={name}
                        value={formatDateTimeValue(value)}
                        onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
                        disabled={disabled}
                        className={baseInputClasses}
                    />
                );

            case 'time':
                return (
                    <input
                        type="time"
                        id={name}
                        name={name}
                        value={(value as string) || ''}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={disabled}
                        className={baseInputClasses}
                    />
                );

            case 'boolean':
                return (
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            id={name}
                            name={name}
                            checked={Boolean(value)}
                            onChange={(e) => onChange(e.target.checked)}
                            disabled={disabled}
                            className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{uiConfig.description || label}</span>
                    </label>
                );

            case 'select':
                return (
                    <SelectField
                        value={value}
                        onChange={onChange}
                        field={field}
                        disabled={disabled}
                        placeholder={placeholder}
                        apiBasePath={apiBasePath}
                        mode="single"
                    />
                );

            case 'multiselect':
                return (
                    <SelectField
                        value={value}
                        onChange={onChange}
                        field={field}
                        disabled={disabled}
                        placeholder={placeholder}
                        apiBasePath={apiBasePath}
                        mode="multiple"
                    />
                );

            case 'file':
            case 'image':
                return (
                    <FileField
                        name={name}
                        value={value}
                        onChange={onChange}
                        disabled={disabled}
                        accept={formConfig.accept || (fieldType === 'image' ? 'image/*' : undefined)}
                        maxSize={formConfig.maxSize}
                        isImage={fieldType === 'image'}
                        uploadEndpoint={formConfig.uploadEndpoint}
                    />
                );

            case 'hidden':
                return <input type="hidden" name={name} value={String(value || '')} />;

            case 'readonly':
                return (
                    <div className={clsx(baseInputClasses, 'bg-gray-50 dark:bg-gray-900 cursor-not-allowed')}>
                        {formatDisplayValue(value, field)}
                    </div>
                );

            case 'input':
            default:
                return (
                    <input
                        type="text"
                        id={name}
                        name={name}
                        value={(value as string) || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        disabled={disabled}
                        className={baseInputClasses}
                    />
                );
        }
    };

    // Hidden fields don't need labels
    if (fieldType === 'hidden') {
        return renderField();
    }

    return (
        <div className={clsx('space-y-1.5', className)} onBlur={onBlur}>
            {/* Label */}
            {fieldType !== 'boolean' && (
                <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {label}
                    {field.validation?.rules?.includes('required') && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* Field */}
            {renderField()}

            {/* Help text */}
            {helpText && !error && <p className="text-sm text-gray-500 dark:text-gray-400">{helpText}</p>}

            {/* Error */}
            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        </div>
    );
}

// ============================================================
// Helper Components
// ============================================================

/**
 * JSON field: Edit (textarea) + Tree view (@uiw/react-json-view).
 * Used for fieldType 'json' and for object values (instead of [Object]).
 * Tree view gives collapsible nodes, copy, and light/dark theme.
 */
function JsonField({
    name,
    value,
    onChange,
    disabled,
    placeholder,
    rows,
    className,
}: {
    name: string;
    value: unknown;
    onChange: (value: unknown) => void;
    disabled: boolean;
    placeholder: string;
    rows: number;
    className: string;
}) {
    const fromProps =
        typeof value === 'string' ? value : value === null || value === undefined ? '' : JSON.stringify(value, null, 2);
    const [localText, setLocalText] = React.useState<string | null>(null);
    const [parseError, setParseError] = React.useState<string | null>(null);
    const [tab, setTab] = React.useState<'edit' | 'view'>('view');
    const displayValue = localText !== null ? localText : fromProps;

    // Resolve tree value: object or array for JsonEditor (editable tree)
    const treeValue = React.useMemo(() => {
        if (value === null || value === undefined) return {};
        if (typeof value === 'object' && (value.constructor === Object || Array.isArray(value))) return value;
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return typeof parsed === 'object' && parsed !== null ? parsed : { value: parsed };
            } catch {
                return null;
            }
        }
        return { value };
    }, [value]);

    const canShowTree = treeValue !== null;

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const raw = e.target.value;
            setLocalText(raw);
            if (raw.trim() === '') {
                setParseError(null);
                onChange(null);
                return;
            }
            try {
                const parsed = JSON.parse(raw);
                setParseError(null);
                setLocalText(null);
                onChange(parsed);
            } catch {
                setParseError('Invalid JSON');
            }
        },
        [onChange],
    );

    React.useEffect(() => {
        setLocalText(null);
        if (typeof value === 'string' && value.trim() !== '') {
            try {
                JSON.parse(value);
                setParseError(null);
            } catch {
                setParseError('Invalid JSON');
            }
        } else {
            setParseError(null);
        }
    }, [value]);

    const handleSetData = useCallback(
        (newData: unknown) => {
            onChange(newData);
        },
        [onChange],
    );

    return (
        <div className="space-y-2">
            <div className="flex gap-1 border-b border-gray-200 dark:border-gray-600">
                <button
                    type="button"
                    onClick={() => setTab('edit')}
                    className={clsx(
                        'px-3 py-1.5 text-sm font-medium rounded-t transition-colors',
                        tab === 'edit'
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-b-0 border-gray-200 dark:border-gray-600'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200',
                    )}
                >
                    Edit
                </button>
                <button
                    type="button"
                    onClick={() => setTab('view')}
                    className={clsx(
                        'px-3 py-1.5 text-sm font-medium rounded-t transition-colors',
                        tab === 'view'
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-b-0 border-gray-200 dark:border-gray-600'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200',
                    )}
                >
                    Tree view
                </button>
            </div>

            {tab === 'edit' && (
                <div className="space-y-1">
                    <textarea
                        id={name}
                        name={name}
                        value={displayValue}
                        onChange={handleChange}
                        placeholder={placeholder}
                        disabled={disabled}
                        rows={rows}
                        className={className}
                        spellCheck={false}
                    />
                    {parseError && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {parseError}
                        </p>
                    )}
                </div>
            )}

            {tab === 'view' && (
                <div
                    className={clsx(
                        'rounded-lg border overflow-auto min-h-[120px] max-h-[400px] p-2',
                        'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800',
                    )}
                >
                    {canShowTree ? (
                        <JsonEditor
                            data={treeValue as object}
                            setData={handleSetData}
                            viewOnly={disabled}
                            rootName=""
                            collapse={2}
                            enableClipboard
                        />
                    ) : parseError ? (
                        <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            Invalid JSON — fix in Edit tab
                        </p>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Empty — edit to add JSON</p>
                    )}
                </div>
            )}
        </div>
    );
}

function PasswordField({
    value,
    onChange,
    placeholder,
    disabled,
    name,
    className,
    showHints = false,
    minLength,
}: {
    value: unknown;
    onChange: (value: unknown) => void;
    placeholder: string;
    disabled: boolean;
    name: string;
    className: string;
    showHints?: boolean;
    minLength?: number;
}) {
    const [showPassword, setShowPassword] = React.useState(false);
    const password = (value as string) || '';

    // Password strength indicators
    const hasMinLength = password.length >= (minLength || 8);
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return (
        <div className="space-y-2">
            <div className="relative">
                <input
                    type={showPassword ? 'text' : 'password'}
                    id={name}
                    name={name}
                    value={password}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={clsx(className, 'pr-10')}
                    autoComplete="new-password"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
            {showHints && password.length > 0 && (
                <div className="text-xs space-y-1">
                    <PasswordHint passed={hasMinLength} text={`At least ${minLength || 8} characters`} />
                    <PasswordHint passed={hasUppercase} text="One uppercase letter" />
                    <PasswordHint passed={hasLowercase} text="One lowercase letter" />
                    <PasswordHint passed={hasNumber} text="One number" />
                    <PasswordHint passed={hasSpecial} text="One special character" />
                </div>
            )}
        </div>
    );
}

function PasswordHint({ passed, text }: { passed: boolean; text: string }) {
    return (
        <div
            className={clsx('flex items-center gap-1', passed ? 'text-green-600 dark:text-green-400' : 'text-gray-400')}
        >
            {passed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            <span>{text}</span>
        </div>
    );
}

function SelectField({
    value,
    onChange,
    field,
    disabled,
    placeholder,
    apiBasePath,
    mode,
}: {
    value: unknown;
    onChange: (value: unknown) => void;
    field: ModelFieldDescriptor;
    disabled: boolean;
    placeholder: string;
    apiBasePath: string;
    mode: 'single' | 'multiple';
}) {
    const formConfig = field.formConfig || {};
    const relationship = formConfig.relationship;
    const staticOptions = formConfig.options;
    const [fetchError, setFetchError] = React.useState<string | null>(null);

    // Convert value to OttaSelectItem format
    const normalizedValue = React.useMemo(() => {
        if (!value) return null;

        if (mode === 'single') {
            if (typeof value === 'object' && value !== null) {
                return value as OttaSelectItem;
            }
            // If just an ID, we need to find the full item or create a placeholder
            return { id: String(value), name: String(value) };
        }

        if (Array.isArray(value)) {
            return value.map((v) => {
                if (typeof v === 'object' && v !== null) return v as OttaSelectItem;
                return { id: String(v), name: String(v) };
            });
        }

        return null;
    }, [value, mode]);

    // Create fetch function for relationship fields with error handling
    const fetchCollection = useCallback(
        async (searchQuery: string) => {
            if (!relationship) return [];

            // Clear previous error
            setFetchError(null);

            const endpoint = relationship.endpoint || `${apiBasePath}/${relationship.entity}`;
            const params = new URLSearchParams();

            if (searchQuery) {
                params.set('search', searchQuery);
            }

            if (relationship.where) {
                params.set('where', JSON.stringify(relationship.where));
            }

            try {
                const url = params.toString() ? `${endpoint}?${params}` : endpoint;
                const response = await fetch(url);

                if (!response.ok) {
                    const errorMsg = `Failed to load ${relationship.entity} (${response.status})`;
                    setFetchError(errorMsg);
                    console.error(`[OttaForms] ${errorMsg}:`, await response.text().catch(() => ''));
                    return [];
                }

                const data = await response.json();
                const items = data[relationship.entity] || data.data || data;

                if (!Array.isArray(items)) {
                    setFetchError(`Invalid response format for ${relationship.entity}`);
                    return [];
                }

                // Map to OttaSelectItem format
                return items.map((item: Record<string, unknown>) => ({
                    id: String(item[relationship.valueField || 'id']),
                    name: String(item[relationship.labelField || 'name'] || item.label || item.title || item.id),
                    ...item,
                }));
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Network error';
                setFetchError(`Failed to load options: ${errorMsg}`);
                console.error(`[OttaForms] Fetch error for ${relationship.entity}:`, error);
                return [];
            }
        },
        [relationship, apiBasePath],
    );

    const handleChange = useCallback(
        (selected: OttaSelectItem | OttaSelectItem[] | null) => {
            if (mode === 'single') {
                // Return just the ID for single select (or full object if needed)
                onChange(selected ? (selected as OttaSelectItem).id : null);
            } else {
                // Return array of IDs for multiselect
                onChange(selected ? (selected as OttaSelectItem[]).map((s) => s.id) : []);
            }
        },
        [mode, onChange],
    );

    return (
        <div className="space-y-1">
            <OttaSelect
                mode={mode}
                value={normalizedValue}
                onChange={handleChange}
                items={staticOptions}
                fetchCollection={relationship ? fetchCollection : undefined}
                placeholder={placeholder}
                disabled={disabled}
                searchable={true}
            />
            {fetchError && (
                <div className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    <span>{fetchError}</span>
                </div>
            )}
        </div>
    );
}

function FileField({
    name,
    value,
    onChange,
    disabled,
    accept,
    maxSize,
    isImage,
    uploadEndpoint,
}: {
    name: string;
    value: unknown;
    onChange: (value: unknown) => void;
    disabled: boolean;
    accept?: string;
    maxSize?: number;
    isImage: boolean;
    /** Custom upload endpoint (e.g., /api/upload or /api/cloudflare/r2) */
    uploadEndpoint?: string;
}) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [preview, setPreview] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [uploading, setUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState(0);

    React.useEffect(() => {
        if (isImage && typeof value === 'string' && value) {
            setPreview(value);
        }
    }, [value, isImage]);

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);

        if (maxSize && file.size > maxSize) {
            setError(`File size exceeds ${formatFileSize(maxSize)}`);
            return;
        }

        // Show preview for images
        if (isImage) {
            const reader = new FileReader();
            reader.onload = () => setPreview(reader.result as string);
            reader.readAsDataURL(file);
        }

        // If upload endpoint is provided, upload the file
        if (uploadEndpoint) {
            setUploading(true);
            setUploadProgress(0);

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('name', file.name);

                const response = await fetch(uploadEndpoint, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Upload failed (${response.status})`);
                }

                const result = await response.json();
                // Expect response to contain { url: string } or { key: string }
                const fileUrl = result.url || result.key || result.path;
                onChange(fileUrl);
                setUploadProgress(100);
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Upload failed';
                setError(errorMsg);
                console.error('[OttaForms] File upload error:', err);
                setPreview(null);
            } finally {
                setUploading(false);
            }
        } else {
            // No upload endpoint - just pass the File object
            onChange(file);
        }
    };

    return (
        <div className="space-y-2">
            <div
                className={clsx(
                    'flex items-center justify-center w-full',
                    'border-2 border-dashed rounded-lg',
                    'border-gray-300 dark:border-gray-600',
                    'hover:border-gray-400 dark:hover:border-gray-500',
                    'transition-colors cursor-pointer',
                    (disabled || uploading) && 'opacity-50 cursor-not-allowed',
                )}
                onClick={() => !disabled && !uploading && inputRef.current?.click()}
            >
                {uploading ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4">
                        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Uploading... {uploadProgress > 0 && `${uploadProgress}%`}
                        </p>
                    </div>
                ) : isImage && preview ? (
                    <div className="relative w-full p-2">
                        <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded" />
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setPreview(null);
                                onChange(null);
                                if (inputRef.current) inputRef.current.value = '';
                            }}
                            className="absolute top-4 right-4 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                            ×
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 px-4">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Click to upload {isImage ? 'an image' : 'a file'}
                        </p>
                        {accept && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Accepted: {accept}</p>}
                        {uploadEndpoint && (
                            <p className="text-xs text-blue-400 dark:text-blue-500 mt-1">
                                Files will be uploaded automatically
                            </p>
                        )}
                    </div>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                name={name}
                onChange={handleChange}
                accept={accept}
                disabled={disabled || uploading}
                className="hidden"
            />

            {error && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Infer field type from model field descriptor
 */
function inferFieldType(field: ModelFieldDescriptor): string {
    // Use explicit formConfig.fieldType if provided
    if (field.formConfig?.fieldType) {
        return field.formConfig.fieldType;
    }

    // Infer from base type
    switch (field.type) {
        case 'boolean':
            return 'boolean';
        case 'number':
        case 'integer':
        case 'float':
            return 'number';
        case 'date':
            return 'date';
        case 'datetime':
            return 'datetime';
        case 'json':
            return 'json';
        case 'array':
            return 'multiselect';
        case 'id':
            return field.primaryKey ? 'readonly' : 'input';
        default:
            return 'input';
    }
}

/**
 * Format date value for input[type="date"]
 */
function formatDateValue(value: unknown): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value as string);
    if (isNaN(date.getTime())) return '';
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format datetime value for input[type="datetime-local"]
 */
function formatDateTimeValue(value: unknown): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value as string);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Format value for display in readonly fields
 */
function formatDisplayValue(value: unknown, field: ModelFieldDescriptor): string {
    if (value === null || value === undefined) return '-';

    switch (field.type) {
        case 'boolean':
            return value ? 'Yes' : 'No';
        case 'date':
            return new Date(value as string).toLocaleDateString();
        case 'datetime':
            return new Date(value as string).toLocaleString();
        case 'json':
            return JSON.stringify(value, null, 2);
        case 'array':
            return Array.isArray(value) ? value.join(', ') : String(value);
        default:
            return String(value);
    }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default FormField;

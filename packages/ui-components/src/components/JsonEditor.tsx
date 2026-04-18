'use client';

/**
 * JsonEditor
 *
 * A clean, minimal, dual-mode JSON editor:
 * - Tree mode: inline edit keys/values/types, add/remove nodes, collapsible
 * - Raw mode: textarea with live validation, format + minify
 *
 * Controlled component. Pass `value` (any JSON-serializable) + `onChange`.
 *
 * Design goals:
 * - No modals, no popups; all editing happens inline on the node row
 * - Keyboard-first: Enter = commit, Esc = cancel, Tab = next field
 * - Tailwind-only styling, dark-mode friendly, no external JSON editor deps
 */
import { cn } from '@ottabase/ui-shadcn';
import { IconBraces, IconBrackets, IconChevronDown, IconChevronRight, IconPlus, IconTrash } from '@tabler/icons-react';
import * as React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject {
    [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

type JsonType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';

export interface JsonEditorProps {
    /** Current JSON value. Must be serializable (no functions/undefined). */
    value: JsonValue;
    /** Called with the new value whenever the user edits. */
    onChange?: (value: JsonValue) => void;
    /** Disable all editing. Still allows expand/collapse. */
    readOnly?: boolean;
    /** Which mode to start in. Defaults to 'tree'. */
    defaultMode?: 'tree' | 'raw';
    /** Depth to auto-collapse at (0 = collapse all). Default: expand everything. */
    collapseAtDepth?: number;
    /** Root label shown in the tree (e.g. "meta"). Optional. */
    rootLabel?: string;
    /** Extra className on the outer wrapper. */
    className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getType(v: JsonValue): JsonType {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v as JsonType;
}

/** Coerce a value to a new type, preserving data where sensible. */
function coerceToType(v: JsonValue, target: JsonType): JsonValue {
    switch (target) {
        case 'string':
            if (v === null) return '';
            if (typeof v === 'object') return JSON.stringify(v);
            return String(v);
        case 'number': {
            const n = typeof v === 'number' ? v : Number(v);
            return Number.isFinite(n) ? n : 0;
        }
        case 'boolean':
            return Boolean(v);
        case 'null':
            return null;
        case 'object':
            return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as JsonObject) : {};
        case 'array':
            return Array.isArray(v) ? v : [];
    }
}

/** Immutable update at a path. Path is an array of keys/indexes from root. */
function setAtPath(root: JsonValue, path: (string | number)[], next: JsonValue): JsonValue {
    if (path.length === 0) return next;
    const [head, ...rest] = path;
    if (Array.isArray(root)) {
        const copy = root.slice();
        const idx = typeof head === 'number' ? head : Number(head);
        copy[idx] = setAtPath(copy[idx] ?? null, rest, next);
        return copy;
    }
    if (root && typeof root === 'object') {
        const copy = { ...(root as JsonObject) };
        const key = String(head);
        copy[key] = setAtPath(copy[key] ?? null, rest, next);
        return copy;
    }
    // Should not hit: updating into a primitive. Return next.
    return next;
}

/** Immutable remove at a path. */
function removeAtPath(root: JsonValue, path: (string | number)[]): JsonValue {
    if (path.length === 0) return root;
    const [head, ...rest] = path;
    if (rest.length === 0) {
        if (Array.isArray(root)) {
            const copy = root.slice();
            copy.splice(Number(head), 1);
            return copy;
        }
        if (root && typeof root === 'object') {
            const copy = { ...(root as JsonObject) };
            delete copy[String(head)];
            return copy;
        }
        return root;
    }
    if (Array.isArray(root)) {
        const copy = root.slice();
        const idx = Number(head);
        copy[idx] = removeAtPath(copy[idx] ?? null, rest);
        return copy;
    }
    if (root && typeof root === 'object') {
        const copy = { ...(root as JsonObject) };
        const key = String(head);
        copy[key] = removeAtPath(copy[key] ?? null, rest);
        return copy;
    }
    return root;
}

/** Immutable rename of a key at a path pointing to the parent object. */
function renameKeyAtPath(root: JsonValue, parentPath: (string | number)[], oldKey: string, newKey: string): JsonValue {
    if (oldKey === newKey) return root;
    const parent = getAtPath(root, parentPath);
    if (!parent || typeof parent !== 'object' || Array.isArray(parent)) return root;
    // Preserve insertion order; replace key in-place
    const entries = Object.entries(parent as JsonObject).map(([k, v]) => (k === oldKey ? [newKey, v] : [k, v]));
    const nextParent: JsonObject = {};
    for (const [k, v] of entries) nextParent[k as string] = v as JsonValue;
    return setAtPath(root, parentPath, nextParent);
}

function getAtPath(root: JsonValue, path: (string | number)[]): JsonValue {
    let cur: JsonValue = root;
    for (const seg of path) {
        if (cur === null || typeof cur !== 'object') return null;
        cur = (cur as JsonObject | JsonArray)[seg as never] as JsonValue;
    }
    return cur ?? null;
}

/** Default value for a new child of the given parent. */
function defaultValueFor(_parent: JsonValue): JsonValue {
    return '';
}

/** Find a non-colliding new key for an object. */
function nextNewKey(obj: JsonObject): string {
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(obj, `key${i}`)) i++;
    return `key${i}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function JsonEditor({
    value,
    onChange,
    readOnly = false,
    defaultMode = 'tree',
    collapseAtDepth,
    rootLabel,
    className,
}: JsonEditorProps) {
    const [mode, setMode] = React.useState<'tree' | 'raw'>(defaultMode);
    const emit = React.useCallback(
        (next: JsonValue) => {
            if (readOnly) return;
            onChange?.(next);
        },
        [onChange, readOnly],
    );

    return (
        <div
            className={cn(
                'rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm',
                className,
            )}
        >
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setMode('tree')}
                        className={cn(
                            'px-2.5 py-1 text-xs font-medium transition-colors',
                            mode === 'tree'
                                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                                : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
                        )}
                    >
                        Tree
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('raw')}
                        className={cn(
                            'px-2.5 py-1 text-xs font-medium transition-colors border-l border-gray-200 dark:border-gray-700',
                            mode === 'raw'
                                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                                : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
                        )}
                    >
                        Raw
                    </button>
                </div>
                <JsonSummary value={value} />
            </div>

            {mode === 'tree' ? (
                <div className="p-2 font-mono text-[13px] leading-7 overflow-auto">
                    <TreeNode
                        nodeKey={rootLabel}
                        value={value}
                        path={[]}
                        depth={0}
                        isRoot
                        readOnly={readOnly}
                        collapseAtDepth={collapseAtDepth}
                        onChangeValue={(next) => emit(setAtPath(value, [], next))}
                        onRemove={() => {
                            // Cannot remove root; clear to empty object instead
                            emit({});
                        }}
                        onRenameKey={() => {
                            /* root has no key */
                        }}
                        onSetAtPath={(p, next) => emit(setAtPath(value, p, next))}
                        onRemoveAtPath={(p) => emit(removeAtPath(value, p))}
                        onRenameKeyAtPath={(parentPath, oldKey, newKey) =>
                            emit(renameKeyAtPath(value, parentPath, oldKey, newKey))
                        }
                    />
                </div>
            ) : (
                <RawEditor value={value} onChange={emit} readOnly={readOnly} />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function JsonSummary({ value }: { value: JsonValue }) {
    const t = getType(value);
    let label: string;
    if (t === 'object') label = `${Object.keys(value as JsonObject).length} keys`;
    else if (t === 'array') label = `${(value as JsonArray).length} items`;
    else label = t;
    return <span className="text-[11px] text-gray-500 dark:text-gray-400 px-1">{label}</span>;
}

// ---------------------------------------------------------------------------
// Tree node (recursive)
// ---------------------------------------------------------------------------

interface TreeNodeProps {
    nodeKey?: string | number;
    value: JsonValue;
    path: (string | number)[];
    depth: number;
    isRoot?: boolean;
    readOnly: boolean;
    collapseAtDepth?: number;
    onChangeValue: (next: JsonValue) => void;
    onRemove: () => void;
    onRenameKey: (newKey: string) => void;
    onSetAtPath: (path: (string | number)[], next: JsonValue) => void;
    onRemoveAtPath: (path: (string | number)[]) => void;
    onRenameKeyAtPath: (parentPath: (string | number)[], oldKey: string, newKey: string) => void;
}

function TreeNode({
    nodeKey,
    value,
    path,
    depth,
    isRoot,
    readOnly,
    collapseAtDepth,
    onChangeValue,
    onRemove,
    onRenameKey,
    onSetAtPath,
    onRemoveAtPath,
    onRenameKeyAtPath,
}: TreeNodeProps) {
    const type = getType(value);
    const isContainer = type === 'object' || type === 'array';
    const shouldCollapseInitially = collapseAtDepth !== undefined && depth >= collapseAtDepth;
    const [collapsed, setCollapsed] = React.useState(shouldCollapseInitially);
    const parentIsArray = typeof nodeKey === 'number';

    return (
        <div className="group/node">
            <div
                className={cn(
                    'flex items-start gap-1 px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800/60',
                    'transition-colors',
                )}
                // eslint-disable-next-line react/forbid-dom-props
                style={{ paddingLeft: `${depth * 14}px` }}
            >
                {/* Chevron (containers) or spacer */}
                {isContainer ? (
                    <button
                        type="button"
                        aria-label={collapsed ? 'Expand' : 'Collapse'}
                        onClick={() => setCollapsed((c) => !c)}
                        className="mt-0.5 shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                        {collapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
                    </button>
                ) : (
                    <span className="w-3.5 shrink-0" />
                )}

                {/* Key */}
                {!isRoot ? (
                    parentIsArray ? (
                        <span className="text-gray-400 dark:text-gray-500 select-none">{nodeKey}:</span>
                    ) : (
                        <KeyInput
                            value={String(nodeKey ?? '')}
                            onCommit={(next) => onRenameKey(next)}
                            readOnly={readOnly}
                        />
                    )
                ) : nodeKey ? (
                    <span className="text-gray-500 dark:text-gray-400 select-none">{nodeKey}:</span>
                ) : null}

                {/* Value (or container summary) */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                    {isContainer ? (
                        <ContainerSummary type={type} value={value} collapsed={collapsed} />
                    ) : (
                        <ValueInput value={value} onCommit={onChangeValue} readOnly={readOnly} />
                    )}

                    {/* Type picker (not on root to prevent data loss) */}
                    {!readOnly && !isRoot && (
                        <TypeSelector type={type} onChange={(t) => onChangeValue(coerceToType(value, t))} />
                    )}
                </div>

                {/* Row actions */}
                {!readOnly && (
                    <div className="opacity-0 group-hover/node:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                        {isContainer && (
                            <button
                                type="button"
                                title={type === 'object' ? 'Add key' : 'Add item'}
                                onClick={() => {
                                    if (type === 'object') {
                                        const obj = value as JsonObject;
                                        const key = nextNewKey(obj);
                                        onSetAtPath([...path, key], defaultValueFor(value));
                                        setCollapsed(false);
                                    } else {
                                        const arr = value as JsonArray;
                                        onSetAtPath([...path, arr.length], defaultValueFor(value));
                                        setCollapsed(false);
                                    }
                                }}
                                className="p-1 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                            >
                                <IconPlus size={14} />
                            </button>
                        )}
                        {!isRoot && (
                            <button
                                type="button"
                                title="Remove"
                                onClick={onRemove}
                                className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                            >
                                <IconTrash size={14} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Children */}
            {isContainer && !collapsed && (
                <div>
                    {type === 'object'
                        ? Object.entries(value as JsonObject).map(([k, v]) => (
                              <TreeNode
                                  key={`o:${k}`}
                                  nodeKey={k}
                                  value={v}
                                  path={[...path, k]}
                                  depth={depth + 1}
                                  readOnly={readOnly}
                                  collapseAtDepth={collapseAtDepth}
                                  onChangeValue={(next) => onSetAtPath([...path, k], next)}
                                  onRemove={() => onRemoveAtPath([...path, k])}
                                  onRenameKey={(newKey) => onRenameKeyAtPath(path, k, newKey)}
                                  onSetAtPath={onSetAtPath}
                                  onRemoveAtPath={onRemoveAtPath}
                                  onRenameKeyAtPath={onRenameKeyAtPath}
                              />
                          ))
                        : (value as JsonArray).map((v, i) => (
                              <TreeNode
                                  key={`a:${i}`}
                                  nodeKey={i}
                                  value={v}
                                  path={[...path, i]}
                                  depth={depth + 1}
                                  readOnly={readOnly}
                                  collapseAtDepth={collapseAtDepth}
                                  onChangeValue={(next) => onSetAtPath([...path, i], next)}
                                  onRemove={() => onRemoveAtPath([...path, i])}
                                  onRenameKey={() => {
                                      /* array indexes aren't renameable */
                                  }}
                                  onSetAtPath={onSetAtPath}
                                  onRemoveAtPath={onRemoveAtPath}
                                  onRenameKeyAtPath={onRenameKeyAtPath}
                              />
                          ))}
                </div>
            )}
        </div>
    );
}

function ContainerSummary({ type, value, collapsed }: { type: JsonType; value: JsonValue; collapsed: boolean }) {
    const icon =
        type === 'object' ? (
            <IconBraces size={12} className="text-gray-400" />
        ) : (
            <IconBrackets size={12} className="text-gray-400" />
        );
    const count = type === 'object' ? Object.keys(value as JsonObject).length : (value as JsonArray).length;
    const open = type === 'object' ? '{' : '[';
    const close = type === 'object' ? '}' : ']';
    if (!collapsed) {
        return (
            <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500 select-none">
                {icon}
                <span>{open}</span>
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 select-none">
            {icon}
            <span>{open}</span>
            <span className="text-[11px]">{count}</span>
            <span>{close}</span>
        </span>
    );
}

// ---------------------------------------------------------------------------
// Key input (inline edit)
// ---------------------------------------------------------------------------

function KeyInput({
    value,
    onCommit,
    readOnly,
}: {
    value: string;
    onCommit: (next: string) => void;
    readOnly: boolean;
}) {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(value);
    React.useEffect(() => {
        if (!editing) setDraft(value);
    }, [value, editing]);

    if (readOnly || !editing) {
        return (
            <button
                type="button"
                onClick={() => !readOnly && setEditing(true)}
                className={cn(
                    'text-left text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded px-1 -mx-0.5',
                    readOnly && 'cursor-default hover:bg-transparent',
                )}
            >
                <span>"{value}"</span>
                <span className="text-gray-400 dark:text-gray-500">:</span>
            </button>
        );
    }

    const commit = () => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== value) onCommit(trimmed);
        setEditing(false);
    };
    const cancel = () => {
        setDraft(value);
        setEditing(false);
    };

    return (
        <span className="inline-flex items-center">
            <span className="text-gray-400 dark:text-gray-500">"</span>
            <input
                aria-label="Edit key"
                title="Edit key"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commit();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancel();
                    }
                }}
                className="bg-transparent border-b border-sky-400 focus:outline-none text-sky-700 dark:text-sky-300 min-w-[2ch] px-0.5 h-6 leading-6 py-0 box-border"
                // eslint-disable-next-line react/forbid-dom-props
                style={{ width: `${Math.max(draft.length, 2) + 1}ch` }}
                spellCheck={false}
            />
            <span className="text-gray-400 dark:text-gray-500">":</span>
        </span>
    );
}

// ---------------------------------------------------------------------------
// Value input (inline edit, type-aware)
// ---------------------------------------------------------------------------

function ValueInput({
    value,
    onCommit,
    readOnly,
}: {
    value: JsonValue;
    onCommit: (next: JsonValue) => void;
    readOnly: boolean;
}) {
    const type = getType(value);
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState<string>(() => displayValue(value));

    React.useEffect(() => {
        if (!editing) setDraft(displayValue(value));
    }, [value, editing]);

    if (type === 'null') {
        return (
            <button
                type="button"
                onClick={() => !readOnly && onCommit('')}
                className="italic text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 px-1 rounded"
                disabled={readOnly}
            >
                null
            </button>
        );
    }

    if (type === 'boolean') {
        const v = value as boolean;
        return (
            <button
                type="button"
                onClick={() => !readOnly && onCommit(!v)}
                className={cn(
                    'px-1.5 py-0.5 rounded text-xs font-medium',
                    v
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
                )}
                disabled={readOnly}
            >
                {v ? 'true' : 'false'}
            </button>
        );
    }

    if (!editing) {
        return (
            <button
                type="button"
                onClick={() => !readOnly && setEditing(true)}
                className={cn(
                    'text-left rounded px-1 -mx-0.5 truncate max-w-full',
                    type === 'string' && 'text-emerald-700 dark:text-emerald-300',
                    type === 'number' && 'text-indigo-700 dark:text-indigo-300',
                    !readOnly && 'hover:bg-gray-100 dark:hover:bg-gray-800',
                    readOnly && 'cursor-default',
                )}
                title={String(value)}
            >
                {type === 'string' ? `"${value}"` : String(value)}
            </button>
        );
    }

    const commit = () => {
        let next: JsonValue = draft;
        if (type === 'number') {
            const n = Number(draft);
            next = Number.isFinite(n) ? n : 0;
        }
        onCommit(next);
        setEditing(false);
    };
    const cancel = () => {
        setDraft(displayValue(value));
        setEditing(false);
    };

    return (
        <input
            aria-label="Edit value"
            title="Edit value"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancel();
                }
            }}
            className={cn(
                'bg-transparent border-b focus:outline-none px-0.5 min-w-[4ch] h-6 leading-6 py-0 box-border',
                type === 'string' && 'text-emerald-700 dark:text-emerald-300 border-emerald-400',
                type === 'number' && 'text-indigo-700 dark:text-indigo-300 border-indigo-400',
            )}
            // eslint-disable-next-line react/forbid-dom-props
            style={{ width: `${Math.max(draft.length, 4) + 1}ch` }}
            spellCheck={false}
            inputMode={type === 'number' ? 'decimal' : undefined}
        />
    );
}

function displayValue(v: JsonValue): string {
    if (v === null) return '';
    if (typeof v === 'string') return v;
    return String(v);
}

// ---------------------------------------------------------------------------
// Type selector
// ---------------------------------------------------------------------------

const TYPE_OPTIONS: JsonType[] = ['string', 'number', 'boolean', 'null', 'object', 'array'];
const TYPE_LABELS: Record<JsonType, string> = {
    string: 'str',
    number: 'num',
    boolean: 'bool',
    null: 'null',
    object: 'obj',
    array: 'arr',
};

function TypeSelector({ type, onChange }: { type: JsonType; onChange: (t: JsonType) => void }) {
    return (
        <select
            value={type}
            onChange={(e) => onChange(e.target.value as JsonType)}
            className={cn(
                'text-[10px] uppercase tracking-wide rounded px-1 py-0 border bg-gray-50 dark:bg-gray-800',
                'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400',
                'focus:outline-none focus:ring-1 focus:ring-sky-400',
                // Hidden until row hover for a cleaner default view
                'opacity-0 group-hover/node:opacity-100 focus:opacity-100 transition-opacity',
            )}
            title="Change type"
            aria-label="Value type"
        >
            {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                </option>
            ))}
        </select>
    );
}

// ---------------------------------------------------------------------------
// Raw editor
// ---------------------------------------------------------------------------

function RawEditor({
    value,
    onChange,
    readOnly,
}: {
    value: JsonValue;
    onChange: (next: JsonValue) => void;
    readOnly: boolean;
}) {
    // Keep local text state so users can type invalid intermediate states freely
    const [text, setText] = React.useState(() => JSON.stringify(value, null, 2));
    const [error, setError] = React.useState<string | null>(null);
    const lastValueRef = React.useRef(value);

    // Sync when external value changes (and differs from our current parse)
    React.useEffect(() => {
        if (value === lastValueRef.current) return;
        lastValueRef.current = value;
        try {
            const current = JSON.parse(text);
            if (JSON.stringify(current) !== JSON.stringify(value)) {
                setText(JSON.stringify(value, null, 2));
                setError(null);
            }
        } catch {
            setText(JSON.stringify(value, null, 2));
            setError(null);
        }
    }, [value, text]);

    const parseAndEmit = React.useCallback(
        (raw: string) => {
            try {
                const parsed = JSON.parse(raw) as JsonValue;
                setError(null);
                lastValueRef.current = parsed;
                onChange(parsed);
                return parsed;
            } catch (e) {
                setError((e as Error).message);
                return undefined;
            }
        },
        [onChange],
    );

    const format = () => {
        const parsed = parseAndEmit(text);
        if (parsed !== undefined) setText(JSON.stringify(parsed, null, 2));
    };
    const minify = () => {
        const parsed = parseAndEmit(text);
        if (parsed !== undefined) setText(JSON.stringify(parsed));
    };

    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-2 py-1">
                <button
                    type="button"
                    onClick={format}
                    disabled={readOnly}
                    className="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                    Format
                </button>
                <button
                    type="button"
                    onClick={minify}
                    disabled={readOnly}
                    className="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                    Minify
                </button>
                <div className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">
                    {error ? <span className="text-red-600 dark:text-red-400">Invalid JSON</span> : 'Valid JSON'}
                </div>
            </div>
            <textarea
                aria-label="Raw JSON"
                title="Raw JSON"
                value={text}
                readOnly={readOnly}
                spellCheck={false}
                onChange={(e) => {
                    const next = e.target.value;
                    setText(next);
                    // Live validate; emit only when valid
                    try {
                        const parsed = JSON.parse(next) as JsonValue;
                        setError(null);
                        lastValueRef.current = parsed;
                        onChange(parsed);
                    } catch (err) {
                        setError((err as Error).message);
                    }
                }}
                onKeyDown={(e) => {
                    // Ctrl/Cmd+S = format
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                        e.preventDefault();
                        format();
                    }
                }}
                className={cn(
                    'font-mono text-[13px] leading-5 p-3 w-full resize-y min-h-[180px]',
                    'bg-transparent text-gray-800 dark:text-gray-100 focus:outline-none',
                    error && 'text-gray-800 dark:text-gray-100',
                )}
            />
            {error && (
                <div className="px-3 py-1.5 border-t border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300 font-mono">
                    {error}
                </div>
            )}
        </div>
    );
}

export default JsonEditor;

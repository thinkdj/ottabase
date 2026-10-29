// ============================================================
// @ottabase/forms - CrudHub cell renderer
// ============================================================
// One renderer for list cells and detail values. Priority:
//   1. a client renderer registered for `entity.field`
//   2. the title field links to details (+ pencil to edit)
//   3. by type/format (id, boolean, date, json, url, code, array/object)
//   4. typed empties: an admin must tell null from '' from [].
// ============================================================

import type { ModelFieldDescriptor } from '@ottabase/ottaorm';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { formatDateForUser } from '@ottabase/utils/timezone';
import { clsx } from 'clsx';
import { Check, ExternalLink, Pencil, X } from 'lucide-react';
import React, { useState } from 'react';

export type CrudHubRenderer = (value: unknown, row: Record<string, unknown>, mode: CrudHubCellMode) => React.ReactNode;
export type CrudHubCellMode = 'table' | 'details';

const renderers = new Map<string, CrudHubRenderer>();

/**
 * Register a client renderer for one field: `registerCrudHubRenderer('posts.status', (v) => <Badge>{v}</Badge>)`.
 * Server `valueRenderer` functions cannot travel to the browser; this is the client-side counterpart.
 */
export function registerCrudHubRenderer(key: `${string}.${string}`, renderer: CrudHubRenderer): void {
    renderers.set(key, renderer);
}

export function getCrudHubRenderer(entity: string, field: string): CrudHubRenderer | undefined {
    return renderers.get(`${entity}.${field}`);
}

const EMPTY_CLASS = 'italic text-muted-foreground/70';
const MUTED = 'text-muted-foreground';

/** `null`, `—` (undefined), `''`, `[]`, `{}` as visible, typed empties. Returns null when the value is not empty. */
export function emptyLabel(value: unknown): string | null {
    if (value === null) return 'null';
    if (value === undefined) return '—';
    if (value === '') return "''";
    if (Array.isArray(value) && value.length === 0) return '[]';
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) return '{}';
    return null;
}

/** `abcd…wxyz` for long ids in tables; the full id in details and in the tooltip. */
export function shortId(value: string, mode: CrudHubCellMode): string {
    if (mode === 'details' || value.length <= 12) return value;
    return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function middleTruncate(text: string, max = 48): string {
    if (text.length <= max) return text;
    const half = Math.floor((max - 1) / 2);
    return `${text.slice(0, half)}…${text.slice(-half)}`;
}

function isHttpUrl(value: string): boolean {
    return /^https?:\/\/\S+$/i.test(value);
}

export interface CrudHubCellProps {
    entity: string;
    fieldKey: string;
    field: ModelFieldDescriptor | undefined;
    value: unknown;
    row: Record<string, unknown>;
    mode?: CrudHubCellMode;
    /** When set, the title field renders as this link (details) plus a pencil to `editHref`. */
    titleHref?: string;
    editHref?: string;
    onNavigate?: (path: string) => void;
    onCopy?: (text: string) => void;
}

export function CrudHubCell({
    entity,
    fieldKey,
    field,
    value,
    row,
    mode = 'table',
    titleHref,
    editHref,
    onNavigate,
    onCopy,
}: CrudHubCellProps) {
    const custom = getCrudHubRenderer(entity, fieldKey);
    if (custom) return <>{custom(value, row, mode)}</>;

    const empty = emptyLabel(value);
    if (empty !== null) return <span className={EMPTY_CLASS}>{empty}</span>;

    const go = (path: string) => (e: React.MouseEvent) => {
        if (!onNavigate) return;
        e.preventDefault();
        e.stopPropagation();
        onNavigate(path);
    };

    if (titleHref && mode === 'table') {
        return (
            <span className="inline-flex items-center gap-1.5">
                <a href={titleHref} onClick={go(titleHref)} className="font-medium text-foreground hover:underline">
                    {String(value)}
                </a>
                {editHref && (
                    <a
                        href={editHref}
                        onClick={go(editHref)}
                        aria-label="Edit"
                        className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/row:opacity-100 focus-visible:opacity-100"
                    >
                        <Pencil className="h-3 w-3" />
                    </a>
                )}
            </span>
        );
    }

    const format = field?.tableConfig?.format;
    const type = field?.type;

    if (type === 'id' || (format === undefined && fieldKey === 'id')) {
        const full = String(value);
        return (
            <button
                type="button"
                title={full}
                onClick={(e) => {
                    e.stopPropagation();
                    onCopy?.(full);
                }}
                className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground ring-1 ring-border hover:bg-muted"
            >
                {shortId(full, mode)}
            </button>
        );
    }

    if (type === 'boolean' || format === 'boolean' || typeof value === 'boolean') {
        return value ? (
            <span className="inline-flex items-center gap-1 text-success">
                <Check className="h-3.5 w-3.5" /> Yes
            </span>
        ) : (
            <span className={clsx('inline-flex items-center gap-1', MUTED)}>
                <X className="h-3.5 w-3.5" /> No
            </span>
        );
    }

    if (type === 'date' || type === 'datetime' || format === 'date' || format === 'datetime') {
        const style = type === 'date' || format === 'date' ? 'date' : mode === 'details' ? 'long' : 'datetime';
        const raw = value instanceof Date ? value.toISOString() : String(value);
        return <span title={raw}>{formatDateForUser(value as string | number | Date, style) || raw}</span>;
    }

    if (type === 'json' || (typeof value === 'object' && value !== null)) {
        return <JsonValue value={value} mode={mode} />;
    }

    if (format === 'image' && typeof value === 'string') {
        return <img src={sanitizeUrl(value)} alt="" className="h-8 w-8 rounded object-cover ring-1 ring-border" />;
    }

    if (typeof value === 'string' && (format === 'link' || isHttpUrl(value))) {
        return (
            <a
                href={sanitizeUrl(value)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-primary hover:underline"
                title={value}
            >
                {mode === 'details' ? value : middleTruncate(value)}
                <ExternalLink className="h-3 w-3" />
            </a>
        );
    }

    if (format === 'currency' || format === 'percentage') {
        const number = Number(value);
        return <span>{format === 'currency' ? number.toFixed(2) : `${number.toFixed(1)}%`}</span>;
    }

    const text = String(value);
    if (mode === 'details' && (text.length > 200 || text.includes('\n'))) {
        return <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3">{text}</div>;
    }
    if (mode === 'table' && text.length > 80) {
        return <span title={text}>{`${text.slice(0, 77)}…`}</span>;
    }
    return <span>{text}</span>;
}

/** Arrays and objects: compact inline in tables with a popover viewer; full pretty JSON in details. */
function JsonValue({ value, mode }: { value: unknown; mode: CrudHubCellMode }) {
    const [open, setOpen] = useState(false);
    const pretty = JSON.stringify(value, null, 2);
    if (mode === 'details') {
        return (
            <pre className="max-h-72 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
                <code>{pretty}</code>
            </pre>
        );
    }
    const preview = inlinePreview(value);
    return (
        <span className="relative inline-block">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen((o) => !o);
                }}
                title={pretty.length > 400 ? `${pretty.slice(0, 400)}…` : pretty}
                className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs ring-1 ring-border hover:bg-muted"
            >
                {preview}
            </button>
            {open && (
                <div
                    className="absolute left-0 top-full z-50 mt-1 max-h-72 w-[22rem] overflow-auto rounded-lg border border-border/60 bg-popover p-3 text-left shadow-md"
                    onClick={(e) => e.stopPropagation()}
                >
                    <pre className="text-xs">
                        <code>{pretty}</code>
                    </pre>
                </div>
            )}
        </span>
    );
}

function inlinePreview(value: unknown): React.ReactNode {
    const punct = (s: string) => <span className={MUTED}>{s}</span>;
    const scalar = (v: unknown) =>
        typeof v === 'object' && v !== null ? (Array.isArray(v) ? '[…]' : '{…}') : String(v);
    if (Array.isArray(value)) {
        const shown = value.slice(0, 3).map(scalar).join(', ');
        return (
            <>
                {punct('[')}
                {shown}
                {value.length > 3 ? punct(`, +${value.length - 3}`) : null}
                {punct(']')}
            </>
        );
    }
    const entries = Object.entries(value as Record<string, unknown>);
    const shown = entries
        .slice(0, 2)
        .map(([k, v]) => `${k}: ${scalar(v)}`)
        .join(', ');
    return (
        <>
            {punct('{')}
            {shown}
            {entries.length > 2 ? punct(`, +${entries.length - 2}`) : null}
            {punct('}')}
        </>
    );
}

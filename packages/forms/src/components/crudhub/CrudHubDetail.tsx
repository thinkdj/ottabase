// ============================================================
// @ottabase/forms - CrudHub details page body
// ============================================================

import type { CrudHubModelDescriptor, CrudHubRelation } from '@ottabase/ottaorm';
import { getStableQuerySignal } from '@ottabase/ottaorm/client';
import { ConfirmDialog, toast } from '@ottabase/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Copy, Edit2, Play, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useFormRequest } from '../../hooks/useFormRequest';
import { CrudHubCell } from './CrudHubCell';
import { crudHubAbilities } from './CrudHubList';
import { CRUDHUB_API, CRUDHUB_PATH, crudHubPaths, fillRouteTokens, rowTitle, type CrudHubNavigate } from './useCrudHub';

export interface CrudHubDetailProps {
    model: CrudHubModelDescriptor;
    id: string;
    onNavigate: CrudHubNavigate;
    canWrite?: boolean;
    /** Every hub model the caller may open, so related rows can link to their own details page. */
    models?: CrudHubModelDescriptor[];
    basePath?: string;
    apiBasePath?: string;
    className?: string;
}

/** The text a related row shows: its model's title field, else name, title, slug, content, id. */
export function relatedLabel(item: Record<string, unknown>, related?: CrudHubModelDescriptor): string {
    const candidates = [related?.titleField, 'name', 'title', 'slug', 'content', related?.primaryKey ?? 'id'];
    for (const key of candidates) {
        const value = key ? item[key] : undefined;
        if (value !== null && value !== undefined && value !== '') {
            const text = String(value);
            return text.length > 60 ? `${text.slice(0, 57)}\u2026` : text;
        }
    }
    return '\u2014';
}

function humanize(name: string): string {
    const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const BTN =
    'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-normal focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring';

export function CrudHubDetail({
    model,
    id,
    onNavigate,
    canWrite = true,
    models,
    basePath = CRUDHUB_PATH,
    apiBasePath = CRUDHUB_API,
    className,
}: CrudHubDetailProps) {
    const request = useFormRequest();
    const queryClient = useQueryClient();
    const paths = crudHubPaths(model.entity, basePath);
    const apiPath = `${apiBasePath}/${encodeURIComponent(model.entity)}/${encodeURIComponent(id)}`;
    const can = crudHubAbilities(model, canWrite);
    const [confirm, setConfirm] = useState<'delete' | string | null>(null);

    const record = useQuery<Record<string, unknown>>({
        queryKey: ['crudhub', model.entity, 'detail', id],
        queryFn: async (context) => request(apiPath, { signal: await getStableQuerySignal(context) }),
    });

    const remove = useMutation({
        meta: { errorPresentation: 'local' },
        mutationFn: () => request(apiPath, { method: 'DELETE' }),
        onSuccess: () => {
            toast.success(`${model.displayName} deleted`);
            queryClient.invalidateQueries({ queryKey: ['crudhub', model.entity] });
            onNavigate(paths.list, { replace: true });
        },
        onError: (error: Error) => toast.error(error.message || 'Delete failed'),
    });

    const runAction = useMutation({
        meta: { errorPresentation: 'local' },
        mutationFn: (key: string) => request(`${apiPath}/actions/${key}`, { method: 'POST' }),
        onSuccess: (_, key) => {
            toast.success(model.actions.find((a) => a.key === key)?.title ?? key);
            queryClient.invalidateQueries({ queryKey: ['crudhub', model.entity] });
        },
        onError: (error: Error) => toast.error(error.message || 'Action failed'),
    });

    if (record.isPending) {
        return (
            <div className={clsx('space-y-3', className)} aria-busy="true">
                <span className="sr-only">Loading…</span>
                <div className="h-8 w-1/3 animate-pulse rounded-xl bg-muted/40" />
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/40" />
                ))}
            </div>
        );
    }
    if (record.isError || !record.data) {
        return (
            <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
                {(record.error as Error | null)?.message || 'Record not found'}
            </div>
        );
    }

    const row = record.data;
    const editPath = (model.routes?.edit && fillRouteTokens(model.routes.edit, row)) || paths.edit(id);
    const relations = Array.isArray(row.__relations) ? (row.__relations as CrudHubRelation[]) : [];
    const fieldKeys = [
        ...Object.keys(model.fields).sort(
            (a, b) =>
                (model.fields[a].tableConfig?.order ?? model.fields[a].formConfig?.order ?? 999) -
                (model.fields[b].tableConfig?.order ?? model.fields[b].formConfig?.order ?? 999),
        ),
        ...Object.keys(row).filter((k) => !(k in model.fields) && !k.startsWith('__')),
    ];
    const copyId = async () => {
        try {
            await navigator.clipboard.writeText(`${model.entity}:${id}`);
            toast.success(`Copied ${model.entity}:${id}`);
        } catch {
            toast.error('Clipboard is not available');
        }
    };

    return (
        <div className={clsx('space-y-6', className)}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-foreground">{rowTitle(model, row)}</h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {model.displayName} · <code className="font-mono">{id}</code>
                        <button
                            type="button"
                            onClick={copyId}
                            aria-label="Copy ID"
                            className="rounded p-0.5 hover:text-foreground"
                        >
                            <Copy className="h-3 w-3" />
                        </button>
                    </p>
                </div>
                {(can.actions || can.edit || can.remove) && (
                    <div className="flex flex-wrap items-center gap-2">
                        {can.actions &&
                            model.actions.map((action) => (
                                <button
                                    key={action.key}
                                    type="button"
                                    onClick={() =>
                                        action.confirm || action.destructive
                                            ? setConfirm(action.key)
                                            : runAction.mutate(action.key)
                                    }
                                    className={clsx(
                                        BTN,
                                        'bg-background text-foreground ring-1 ring-border hover:bg-muted/70',
                                    )}
                                >
                                    <Play className="h-4 w-4" /> {action.title}
                                </button>
                            ))}
                        {can.edit && (
                            <button
                                type="button"
                                onClick={() => onNavigate(editPath)}
                                className={clsx(BTN, 'bg-primary text-primary-foreground hover:bg-primary/90')}
                            >
                                <Edit2 className="h-4 w-4" /> Edit
                            </button>
                        )}
                        {can.remove && (
                            <button
                                type="button"
                                onClick={() => setConfirm('delete')}
                                className={clsx(
                                    BTN,
                                    'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                                )}
                            >
                                <Trash2 className="h-4 w-4" /> Delete
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full">
                    <tbody className="divide-y divide-border/60">
                        {fieldKeys.map((key) => (
                            <tr key={key} className="bg-background hover:bg-muted/40">
                                <td className="w-1/4 bg-muted/40 px-4 py-3 align-top">
                                    <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        {model.fields[key]?.uiConfig?.label ?? key}
                                    </span>
                                    {model.fields[key]?.uiConfig?.description && (
                                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                            {model.fields[key].uiConfig?.description}
                                        </p>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    <CrudHubCell
                                        entity={model.entity}
                                        fieldKey={key}
                                        field={model.fields[key]}
                                        value={row[key]}
                                        row={row}
                                        mode="details"
                                        onCopy={copyId}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {relations.length > 0 && (
                <section className="space-y-2" aria-label="Related records">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        Related
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-border/60">
                        <table className="w-full">
                            <tbody className="divide-y divide-border/60">
                                {relations.map((relation) => {
                                    const related = models?.find((m) => m.entity === relation.entity);
                                    return (
                                        <tr key={relation.name} className="bg-background">
                                            <td className="w-1/4 bg-muted/40 px-4 py-3 align-top">
                                                <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                    {humanize(relation.name)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {relation.items.length === 0 ? (
                                                    <span className="italic text-muted-foreground/70">
                                                        {relation.many ? 'none' : 'null'}
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {relation.items.map((item, index) => {
                                                            const itemId = item[related?.primaryKey ?? 'id'];
                                                            const label = relatedLabel(item, related);
                                                            const chip =
                                                                'inline-flex max-w-xs items-center truncate rounded-full bg-background px-2.5 py-0.5 text-xs font-medium ring-1 ring-border';
                                                            if (!related || itemId === null || itemId === undefined) {
                                                                return (
                                                                    <span
                                                                        key={index}
                                                                        className={clsx(chip, 'text-muted-foreground')}
                                                                    >
                                                                        {label}
                                                                    </span>
                                                                );
                                                            }
                                                            const href = crudHubPaths(related.entity, basePath).view(
                                                                String(itemId),
                                                            );
                                                            return (
                                                                <a
                                                                    key={index}
                                                                    href={href}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        onNavigate(href);
                                                                    }}
                                                                    className={clsx(
                                                                        chip,
                                                                        'text-foreground hover:bg-muted/70',
                                                                    )}
                                                                >
                                                                    {label}
                                                                </a>
                                                            );
                                                        })}
                                                        {relation.truncated && (
                                                            <span className="text-xs text-muted-foreground">
                                                                showing the first {relation.items.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            <ConfirmDialog
                open={confirm === 'delete'}
                onOpenChange={(open) => !open && setConfirm(null)}
                tone="destructive"
                title={`Delete ${model.displayName.toLowerCase()}?`}
                description="This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => {
                    setConfirm(null);
                    remove.mutate();
                }}
            />
            <ConfirmDialog
                open={confirm !== null && confirm !== 'delete'}
                onOpenChange={(open) => !open && setConfirm(null)}
                tone={model.actions.find((a) => a.key === confirm)?.destructive ? 'destructive' : 'default'}
                title={model.actions.find((a) => a.key === confirm)?.title}
                description={model.actions.find((a) => a.key === confirm)?.confirm ?? 'Run this action?'}
                confirmLabel="Run"
                onConfirm={() => {
                    if (confirm && confirm !== 'delete') runAction.mutate(confirm);
                    setConfirm(null);
                }}
            />
        </div>
    );
}

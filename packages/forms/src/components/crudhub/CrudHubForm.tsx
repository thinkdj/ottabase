// ============================================================
// @ottabase/forms - CrudHub create / edit page body
// ============================================================
// ModelForm from the server descriptor. Save is dirty-gated. After a
// create the host is told to replace the URL with the edit page; the new
// row is primed in the query cache, so the edit form appears without a
// reload or a refetch flash. Leaving dirty asks first: through the host
// (onDirtyChange + a router blocker) or, without one, on Cancel only.
// ============================================================

import type { CrudHubModelDescriptor } from '@ottabase/ottaorm';
import { getStableQuerySignal } from '@ottabase/ottaorm/client';
import { ConfirmDialog, toast } from '@ottabase/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getServerErrorData, useFormRequest } from '../../hooks/useFormRequest';
import { ModelForm } from '../ModelForm';
import { CRUDHUB_API, CRUDHUB_PATH, crudHubPaths, useCrudHubModelConfig, type CrudHubNavigate } from './useCrudHub';

export interface CrudHubFormProps {
    model: CrudHubModelDescriptor;
    /** Undefined = create. */
    id?: string;
    onNavigate: CrudHubNavigate;
    /** Where "Cancel" and a confirmed discard go. */
    backPath?: string;
    basePath?: string;
    apiBasePath?: string;
    className?: string;
    /**
     * The host guards navigation itself (a router blocker covering links, Back and reload). When
     * set, the built-in Cancel confirm is skipped, and the form reports clean right before its own
     * post-create navigation so the blocker lets it through.
     */
    onDirtyChange?: (dirty: boolean) => void;
}

export function CrudHubForm({
    model,
    id,
    onNavigate,
    backPath,
    basePath = CRUDHUB_PATH,
    apiBasePath = CRUDHUB_API,
    className,
    onDirtyChange,
}: CrudHubFormProps) {
    const request = useFormRequest();
    const queryClient = useQueryClient();
    const paths = crudHubPaths(model.entity, basePath);
    const config = useCrudHubModelConfig(model, apiBasePath)!;
    const apiPath = `${apiBasePath}/${encodeURIComponent(model.entity)}`;
    const pk = model.primaryKey;

    // After a create the component keeps rendering the same form in edit mode for the new id.
    const [recordId, setRecordId] = useState<string | undefined>(id);
    useEffect(() => setRecordId(id), [id]);
    const [cleanKey, setCleanKey] = useState(0);
    const [dirty, setDirty] = useState(false);
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
    const [leaveTo, setLeaveTo] = useState<string | null>(null);
    const createdRef = useRef<Record<string, unknown> | null>(null);

    const record = useQuery<Record<string, unknown>>({
        queryKey: ['crudhub', model.entity, 'detail', recordId],
        queryFn: async (context) =>
            request(`${apiPath}/${encodeURIComponent(recordId!)}`, { signal: await getStableQuerySignal(context) }),
        enabled: Boolean(recordId) && !createdRef.current,
    });

    const parseErrors = (error: unknown) => {
        const body = getServerErrorData(error);
        const fieldErrors = (body.errors || body.fieldErrors) as Record<string, unknown> | undefined;
        if (fieldErrors && typeof fieldErrors === 'object') {
            const parsed: Record<string, string> = {};
            for (const [k, v] of Object.entries(fieldErrors)) parsed[k] = Array.isArray(v) ? String(v[0]) : String(v);
            setServerErrors(parsed);
        }
    };

    const save = useMutation<Record<string, unknown>, Error, Record<string, unknown>>({
        meta: { errorPresentation: 'local' },
        mutationFn: async (data) => {
            setServerErrors({});
            try {
                return recordId
                    ? await request(`${apiPath}/${encodeURIComponent(recordId)}`, { method: 'PATCH', body: data })
                    : await request(apiPath, { method: 'POST', body: data });
            } catch (error) {
                parseErrors(error);
                throw error;
            }
        },
        onSuccess: (saved) => {
            queryClient.invalidateQueries({ queryKey: ['crudhub', model.entity] });
            setCleanKey((k) => k + 1);
            if (!recordId) {
                const newId = String(saved[pk]);
                createdRef.current = saved;
                setRecordId(newId);
                queryClient.setQueryData(['crudhub', model.entity, 'detail', newId], saved);
                // Silent URL switch to the edit page; further saves are updates.
                onDirtyChange?.(false);
                onNavigate(paths.edit(newId), { replace: true });
                toast.success(`${model.displayName} created`);
            } else {
                toast.success('Saved');
            }
        },
    });

    const guardedNavigate = useCallback(
        (path: string) => {
            if (dirty && !onDirtyChange) setLeaveTo(path);
            else onNavigate(path);
        },
        [dirty, onDirtyChange, onNavigate],
    );

    const target = backPath ?? (recordId ? paths.view(recordId) : paths.list);
    const initialData = recordId ? (createdRef.current ?? record.data) : undefined;

    if (recordId && !initialData && record.isPending) {
        return (
            <div className={clsx('space-y-3', className)} aria-busy="true">
                <span className="sr-only">Loading…</span>
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/40" />
                ))}
            </div>
        );
    }
    if (recordId && !initialData) {
        return (
            <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
                {(record.error as Error | null)?.message || 'Record not found'}
            </div>
        );
    }

    return (
        <div className={className}>
            <ModelForm
                // Remount when switching from create to edit so initial values take effect.
                key={recordId ?? 'new'}
                config={config}
                mode={recordId ? 'edit' : 'create'}
                initialData={initialData}
                apiBasePath={apiBasePath}
                onSubmit={async (data) => {
                    await save.mutateAsync(data as Record<string, unknown>);
                }}
                onCancel={() => guardedNavigate(target)}
                isLoading={save.isPending}
                serverErrors={serverErrors}
                onServerErrorClear={(field) =>
                    setServerErrors((prev) => {
                        const { [field]: _omit, ...rest } = prev;
                        return rest;
                    })
                }
                onDirtyChange={(next) => {
                    setDirty(next);
                    onDirtyChange?.(next);
                }}
                disableUntilDirty
                submitLabel={recordId ? 'Save changes' : `Create ${model.displayName.toLowerCase()}`}
                hideHeader
                cleanKey={cleanKey}
            />
            <ConfirmDialog
                open={leaveTo !== null}
                onOpenChange={(open) => !open && setLeaveTo(null)}
                tone="unsaved-changes"
                title="Discard changes?"
                description="You have unsaved changes. Leaving now will lose them."
                onConfirm={() => {
                    const path = leaveTo;
                    setLeaveTo(null);
                    if (path) onNavigate(path);
                }}
            />
        </div>
    );
}

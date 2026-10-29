// ============================================================
// @ottabase/forms - CrudHub data hooks and helpers
// ============================================================

import type { CrudHubModelDescriptor } from '@ottabase/ottaorm';
import { getStableQuerySignal } from '@ottabase/ottaorm/client';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useFormRequest } from '../../hooks/useFormRequest';
import type { ModelConfig } from '../../types';
import { defineModelConfig } from '../../utils/modelConfig';

export const CRUDHUB_API = '/api/admin/crudhub';
export const CRUDHUB_PATH = '/admin/crudhub';

export type CrudHubNavigate = (path: string, options?: { replace?: boolean }) => void;

/** Paths of the hub pages for one model. */
export function crudHubPaths(entity: string, basePath = CRUDHUB_PATH) {
    const root = `${basePath}/${encodeURIComponent(entity)}`;
    return {
        list: root,
        create: `${root}/new`,
        view: (id: string | number) => `${root}/${encodeURIComponent(String(id))}`,
        edit: (id: string | number) => `${root}/${encodeURIComponent(String(id))}/edit`,
    };
}

/** Fill `:field` tokens of a custom model route from a row; null when a token has no value. */
export function fillRouteTokens(template: string, row: Record<string, unknown>): string | null {
    let missing = false;
    const path = template.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, field: string) => {
        const value = row[field];
        if (value === null || value === undefined || value === '') {
            missing = true;
            return '';
        }
        return encodeURIComponent(String(value));
    });
    return missing ? null : path;
}

/** The directory listing: every model the caller may open. */
export function useCrudHubModels(apiBasePath = CRUDHUB_API) {
    const request = useFormRequest();
    return useQuery<{ models: CrudHubModelDescriptor[]; total: number }>({
        queryKey: ['crudhub', 'models'],
        queryFn: async (context) => request(apiBasePath, { signal: await getStableQuerySignal(context) }),
        staleTime: 60_000,
    });
}

/** One model's descriptor (served from the directory cache when present). */
export function useCrudHubModel(entity: string, apiBasePath = CRUDHUB_API) {
    const request = useFormRequest();
    return useQuery<CrudHubModelDescriptor>({
        queryKey: ['crudhub', 'model', entity],
        queryFn: async (context) =>
            request(`${apiBasePath}/${encodeURIComponent(entity)}/_meta`, {
                signal: await getStableQuerySignal(context),
            }),
        staleTime: 60_000,
    });
}

/** Turn a server descriptor into the ModelConfig the forms components render from. */
export function crudHubModelConfig(model: CrudHubModelDescriptor, apiBasePath = CRUDHUB_API): ModelConfig {
    return defineModelConfig({
        entity: model.entity,
        primaryKey: model.primaryKey,
        fields: model.fields,
        defaults: model.defaults,
        displayName: model.displayName,
        displayNamePlural: model.displayNamePlural,
        defaultSort: model.defaultSort,
        defaultSortDirection: model.defaultSortDirection,
        apiPath: `${apiBasePath}/${encodeURIComponent(model.entity)}`,
        searchFields: model.searchField ? [model.searchField] : undefined,
    });
}

export function useCrudHubModelConfig(model: CrudHubModelDescriptor | undefined, apiBasePath = CRUDHUB_API) {
    return useMemo(() => (model ? crudHubModelConfig(model, apiBasePath) : null), [model, apiBasePath]);
}

/** The value of a row's title field, falling back to its id. */
export function rowTitle(model: CrudHubModelDescriptor, row: Record<string, unknown>): string {
    const title = model.titleField ? row[model.titleField] : undefined;
    if (title !== null && title !== undefined && title !== '') return String(title);
    return String(row[model.primaryKey] ?? '');
}

const STORAGE_PREFIX = 'ottabase.crudhub.';

export interface RememberedListState {
    perPage?: number;
    sort?: { column: string; direction: 'asc' | 'desc' } | null;
    columns?: Record<string, boolean>;
}

/** Per-model list preferences in localStorage, wrapped so a blocked storage never breaks the page. */
export function readRemembered(entity: string): RememberedListState {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + entity);
        return raw ? (JSON.parse(raw) as RememberedListState) : {};
    } catch {
        return {};
    }
}

export function writeRemembered(entity: string, patch: RememberedListState): void {
    try {
        localStorage.setItem(STORAGE_PREFIX + entity, JSON.stringify({ ...readRemembered(entity), ...patch }));
    } catch {
        // Private mode or blocked storage: preferences simply do not persist.
    }
}

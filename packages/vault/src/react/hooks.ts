'use client';

// ============================================================
// @ottabase/vault/react — query hooks
// ============================================================
// Through the framework client (`useApiQuery` / `useApiMutation`), never `fetch()`: the
// app's one API client attaches the session and tenant headers, and every mutation
// invalidates the whole `vault_backups` namespace.
// ============================================================

import { useApiMutation, useApiQuery } from '@ottabase/ottaorm/client';
import { VAULT_BASE_PATH } from '../constants';
import type { BackupManifest, RestoreResult } from '../types';

/** Entity namespace for query keys and mutation invalidation. */
export const VAULT_ENTITY = 'vault_backups';

export const vaultQueryKeys = {
    all: () => [VAULT_ENTITY] as const,
    list: () => [VAULT_ENTITY, 'list'] as const,
};

type Envelope<T> = { data: T };

export function useVaultBackups() {
    const invalidateEntities = [VAULT_ENTITY];

    const query = useApiQuery<Envelope<BackupManifest[]>, BackupManifest[]>({
        entity: VAULT_ENTITY,
        queryKey: ['list'],
        endpoint: `${VAULT_BASE_PATH}/backups?limit=100`,
        select: (response) => response.data,
        queryOptions: { staleTime: 15_000 },
    });

    const create = useApiMutation<Envelope<BackupManifest>, { label?: string }>({
        endpoint: `${VAULT_BASE_PATH}/backups`,
        invalidateEntities,
    });

    // The route refuses a restore unless the body names the backup it replaces the live rows with.
    const restore = useApiMutation<Envelope<RestoreResult>, { id: string; confirm: string; tables?: string[] }>({
        endpoint: ({ id }) => `${VAULT_BASE_PATH}/backups/${encodeURIComponent(id)}/restore`,
        invalidateEntities,
    });

    const remove = useApiMutation<Envelope<{ id: string; removed: boolean }>, string>({
        endpoint: (id) => `${VAULT_BASE_PATH}/backups/${encodeURIComponent(id)}`,
        method: 'DELETE',
        invalidateEntities,
    });

    return { ...query, backups: query.data ?? [], create, restore, remove };
}

/**
 * The app's API client, adapted to `@ottabase/premium`'s request seam.
 *
 * PASSING THE APP CLIENT MATTERS: it attaches `X-Org-Id` and `X-App-Id`, and those
 * headers select the tenancy scope the server resolves against. The package's bare-fetch
 * default would silently resolve in the session's DEFAULT org — so a user who switched
 * workspace would see another workspace's entitlements and data.
 *
 * The same adapter serves both the `/api/premium` control plane and any paid package's
 * own namespace (`/api/webhooks/...`), because the provider exposes one transport for
 * both. Two clients would be two sets of headers, and the gate could answer for a
 * different tenant than the data it guards.
 */

import { api } from '@/lib/api';

export const premiumRequest = async <T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
    // The api client returns undefined for a 204 or a non-JSON 2xx, so this must not
    // assume an envelope is present — otherwise a legitimate empty success becomes a
    // TypeError inside a query.
    const response = await api<{ data: T } | undefined>(path, { method: init?.method ?? 'GET', body: init?.body });
    return response?.data as T;
};

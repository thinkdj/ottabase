/**
 * Personal AI provider keys, on the user's own settings page.
 *
 * Same package component as the admin page, with the organization scope switched off:
 * a personal key applies only to this user, and under the default `user-then-org`
 * strategy it OUTRANKS the workspace key.
 */

import { api } from '@/lib/api';
import { AiProviderSettings, AiProvisioningProvider } from '@ottabase/ottaai/react';

/**
 * The app's API client, adapted to the package's request seam.
 *
 * PASSING THE APP CLIENT MATTERS: it attaches `X-Org-Id` and `X-App-Id`, and those headers
 * select the tenancy scope the server resolves against. The package's bare-fetch default
 * would silently resolve in the session's DEFAULT org rather than the active one.
 */
const aiRequest = async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
    // The api client returns undefined for a 204 or a non-JSON 2xx, so this must not assume
    // an envelope is present — otherwise a legitimate empty success becomes a TypeError.
    const response = await api<{ data: T } | undefined>(path, { method: init?.method ?? 'GET', body: init?.body });
    return response?.data as T;
};

export function AiPersonalProviders() {
    return (
        <AiProvisioningProvider basePath="/api/ai" request={aiRequest}>
            <AiProviderSettings
                allowOrgScope={false}
                title="AI provider"
                description="Bring your own key to run AI features on your own provider account, with your own model. Your key pays for your usage."
            />
        </AiProvisioningProvider>
    );
}

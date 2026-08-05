// ============================================================
// @ottabase/premium-webhooks — public types
// ============================================================

import type { PremiumRegistry } from '@ottabase/premium';

/** Which tenant's endpoints an operation applies to. Always derived server-side. */
export interface WebhookTenant {
    organizationId: string | null;
    appId: string | null;
    userId?: string | null;
}

/**
 * The caller, as resolved by the HOST app.
 *
 * This package deliberately has no idea how the host authenticates. It receives an
 * already-verified caller and trusts nothing from the request beyond it — in particular
 * it never reads `organizationId` from a header, because a header is a request, not an
 * answer.
 */
export interface WebhookCaller extends WebhookTenant {
    userId: string | null;
    /** Whether the caller may create, edit and delete this tenant's endpoints. */
    canManage: boolean;
}

export interface WebhooksRouterConfig<Env> {
    /** The premium registry the host built. Used for the entitlement gates. */
    registry: PremiumRegistry<Env>;
    /**
     * Resolve the caller from the request. Return `null` to refuse with 401 — that is the
     * host's session check, not this package's.
     */
    resolveCaller: (request: Request, env: Env) => Promise<WebhookCaller | null>;
    /**
     * The catalog of event names offered in the UI. Purely descriptive: an endpoint may
     * subscribe to `'*'`, and the dispatcher matches on exact names, so an event missing
     * from this list still delivers.
     */
    events?: string[];
}

/** Request body accepted when creating or updating an endpoint. */
export interface WebhookEndpointInput {
    url?: string;
    description?: string | null;
    events?: string[];
    enabled?: boolean;
}

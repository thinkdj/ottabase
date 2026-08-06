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

/** A short-lived, server-side slot reservation for an endpoint create. */
export interface WebhookEndpointReservation {
    /** Confirm that the endpoint row was created, releasing the temporary reservation. */
    commit: () => Promise<void>;
    /** Release a reservation when the create did not finish. Safe to call more than once. */
    release: () => Promise<void>;
}

export interface WebhookEndpointQuotaInput {
    /** Authoritative endpoint count read by the route immediately before reserving. */
    current: number;
    /** Effective plan ceiling. This callback is only called for finite limits. */
    limit: number;
}

export interface WebhookEndpointQuota<Env> {
    reserve: (
        env: Env,
        caller: WebhookCaller,
        input: WebhookEndpointQuotaInput,
    ) => Promise<WebhookEndpointReservation | null>;
    /** Reconcile a successful delete with the coordinator's committed count. */
    synchronize: (env: Env, caller: WebhookCaller, current: number) => Promise<void>;
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
    /**
     * Optional distributed quota coordinator. Hosts that promise a globally strict limit
     * should provide one (for example, a Durable Object scoped to the resolved tenant).
     * Without it, the package serializes creates only within the current Worker isolate.
     */
    endpointQuota?: WebhookEndpointQuota<Env>;
}

/** Request body accepted when creating or updating an endpoint. */
export interface WebhookEndpointInput {
    url?: string;
    description?: string | null;
    events?: string[];
    enabled?: boolean;
}

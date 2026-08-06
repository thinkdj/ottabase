// ============================================================
// @ottabase/premium-webhooks — RLS policies
// ============================================================
// These protect future secure-CRUD or model consumers as defense in depth. The
// package routes still derive and apply their own verified caller scope because
// they do not run through the generic CRUD security-context path.

import type { ModelRLSConfig, SecurityContext } from '@ottabase/ottaorm';

function webhookFilter(context: SecurityContext): Record<string, unknown> | null {
    if (!context.appId || !context.userId) return null;

    const organizationId = context.organizationId ?? null;
    if (organizationId === null) {
        return { appId: context.appId, organizationId: null, userId: context.userId };
    }

    // `organizationId` is only usable after upstream membership verification. An
    // unavailable membership list must never widen a tenant filter.
    if (context.platformAdmin !== true) {
        if (!Array.isArray(context.memberOrganizationIds) || !context.memberOrganizationIds.includes(organizationId)) {
            return null;
        }
    }

    return { appId: context.appId, organizationId };
}

export const webhookPolicies: ModelRLSConfig[] = [
    {
        model: 'premium_webhook_endpoints',
        policy: { level: 'custom', filter: webhookFilter },
        contextFields: ['organizationId', 'appId', 'userId'],
        auditEnabled: true,
    },
    {
        model: 'premium_webhook_deliveries',
        policy: { level: 'custom', filter: webhookFilter, readOnly: true },
        contextFields: ['organizationId', 'appId', 'userId'],
        auditEnabled: false,
    },
];

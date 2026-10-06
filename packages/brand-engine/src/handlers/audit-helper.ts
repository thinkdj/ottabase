// ---------------------------------------------------------------------------
// Brand Engine, Optional audit logging
// Integrates with @ottabase/audit when available. Failures are swallowed.
// ---------------------------------------------------------------------------

import { logAudit, extractRequestContext } from '@ottabase/audit';

/** The acting user behind a brand mutation, as resolved by the app's admin guard. */
export interface BrandAuditUser {
    userId?: string;
    userEmail?: string;
    /** Org the actor was authorized in; recorded so tenant-scoped audit views can see the row. */
    organizationId?: string;
}

/**
 * Log brand-related action to audit. Non-blocking, failures are caught.
 * Pass the logged-in actor; omit when unauthenticated (stores NULL, avoids FK violation).
 * `appId` scopes the row to the app the brand kit belongs to (null = system default kit).
 */
export async function logBrandAudit(
    action: 'brand.update' | 'brand.apply' | 'brand.logo.upload' | 'brand.kit.update' | 'brand.kit.logo.upload',
    request: Request,
    metadata: { appId: string | null } & Record<string, unknown>,
    actor?: BrandAuditUser,
): Promise<void> {
    try {
        const ctx = extractRequestContext(request, actor?.userId, actor?.userEmail);
        await logAudit({
            userId: ctx.userId,
            userEmail: ctx.userEmail,
            organizationId: actor?.organizationId,
            appId: metadata.appId ?? undefined,
            action,
            resourceType: 'brand',
            metadata: {
                ...metadata,
                url: ctx.url,
                method: ctx.method,
            },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            status: 'success',
        });
    } catch {
        // Audit failure must not break the main flow
    }
}

// ---------------------------------------------------------------------------
// Brand Engine – Optional audit logging
// Integrates with @ottabase/audit when available. Failures are swallowed.
// ---------------------------------------------------------------------------

import { logAudit, extractRequestContext } from '@ottabase/audit';

/**
 * Log brand-related action to audit. Non-blocking – failures are caught.
 * Pass userId/userEmail from the logged-in user; omit when unauthenticated (stores NULL, avoids FK violation).
 */
export async function logBrandAudit(
    action: 'brand.update' | 'brand.apply' | 'brand.logo.upload' | 'brand.kit.update' | 'brand.kit.logo.upload',
    request: Request,
    metadata: Record<string, unknown>,
    userId?: string,
    userEmail?: string,
): Promise<void> {
    try {
        const ctx = extractRequestContext(request, userId, userEmail);
        await logAudit({
            userId: ctx.userId,
            userEmail: ctx.userEmail,
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

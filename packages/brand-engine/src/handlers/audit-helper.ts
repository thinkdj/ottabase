// ---------------------------------------------------------------------------
// Brand Engine – Optional audit logging
// Integrates with @ottabase/audit when available. Failures are swallowed.
// ---------------------------------------------------------------------------

import { logAudit, extractRequestContext } from '@ottabase/audit';

/**
 * Log brand-related action to audit. Non-blocking – failures are caught.
 */
export async function logBrandAudit(
    action: 'brand.update' | 'brand.apply' | 'brand.logo.upload' | 'brand.kit.update' | 'brand.kit.logo.upload',
    request: Request,
    metadata: Record<string, unknown>,
): Promise<void> {
    try {
        const ctx = extractRequestContext(request);
        await logAudit({
            userId: ctx.userId ?? 'system',
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

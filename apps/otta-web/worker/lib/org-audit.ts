import { AuditLog } from '@ottabase/ottaorm/models';

export async function auditOrganizationAction(
    request: Request,
    opts: {
        userId?: string;
        userEmail?: string | null;
        organizationId: string;
        action: string;
        resourceType: string;
        resourceId?: string;
        changes?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
    },
): Promise<void> {
    try {
        await AuditLog.log({
            userId: opts.userId,
            userEmail: opts.userEmail ?? undefined,
            organizationId: opts.organizationId,
            action: opts.action,
            resourceType: opts.resourceType,
            resourceId: opts.resourceId,
            changes: opts.changes,
            metadata: opts.metadata,
            ipAddress: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || undefined,
            userAgent: request.headers.get('user-agent') || undefined,
            status: 'success',
        });
    } catch {
        // Auditing must not break primary flows
    }
}

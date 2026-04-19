// ============================================================
// Shared helpers for organization-route handlers.
// Keeps validation + owner-creation in one place so tenant and
// platform endpoints stay consistent (Fat Model boundary only
// lives here; model does the real work).
// ============================================================

import { Organization } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { auditOrganizationAction } from '../../lib/org-audit';
import { syncMembershipRoleToTenantRBAC } from '../../lib/organization-admin';
import type { ApiRouteContext } from '../router';

export async function parseJsonBody<T>(context: ApiRouteContext): Promise<T | Response> {
    try {
        return (await context.request.json()) as T;
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'BAD_REQUEST' });
    }
}

export async function createOrganizationWithOwner(
    context: ApiRouteContext,
    body: unknown,
    owner: { userId: string; userEmail: string | null; userName: string | null },
): Promise<Response> {
    const input = (body ?? {}) as Record<string, unknown>;
    const validated = Organization.validateCreateInput(input);
    if (!validated.ok) {
        return errorResponse(validated.message, 400, {
            code: validated.code,
            fieldErrors: validated.fieldErrors,
        });
    }

    try {
        const created = await Organization.createWithOwner({
            name: validated.payload.name,
            slug: validated.payload.slug,
            ownerId: owner.userId,
            plan: validated.payload.plan,
            status: validated.payload.status,
            settings: (input.settings as Record<string, unknown>) ?? {},
            metadata: (input.metadata as Record<string, unknown>) ?? {},
            membershipRole: 'owner',
            membershipStatus: 'active',
            joinedAt: Date.now(),
        });

        const organizationId = String(created.get('id'));
        await syncMembershipRoleToTenantRBAC({
            userId: owner.userId,
            organizationId,
            membershipRole: 'owner',
            membershipStatus: 'active',
            assignedBy: owner.userId,
        });

        await auditOrganizationAction(context.request, {
            userId: owner.userId,
            userEmail: owner.userEmail,
            organizationId,
            action: 'create',
            resourceType: 'organization',
            resourceId: organizationId,
            metadata: { name: validated.payload.name, slug: validated.payload.slug, source: context.route },
        });

        return jsonResponse({ data: created.toJson() }, 201);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (/slug/i.test(message) && /exist|taken/i.test(message)) {
            return errorResponse('Slug already taken', 409, { code: 'ORG_SLUG_TAKEN' });
        }
        if (/name/i.test(message) && /exist|taken/i.test(message)) {
            return errorResponse('Organization name already exists', 409, { code: 'ORG_NAME_TAKEN' });
        }
        return errorResponse('Failed to create organization', 500, {
            code: 'ORG_CREATE_FAILED',
            details: message,
        });
    }
}

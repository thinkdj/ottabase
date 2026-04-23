// ============================================================
// Current-organization (tenant-scoped) route handlers.
// These operate on whatever organization is resolved from the
// authenticated admin context, not on an org id in the URL.
// ============================================================

import { Organization } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminAccess, resolveCurrentOrgForAdmin, resolveTenantOrganizationId } from '../lib/admin-guard';
import { auditOrganizationAction } from '../lib/org-audit';
import type { ApiRouteContext } from './router';
import { parseJsonBody } from './shared/organization-validation';

export async function handleCurrentOrganizationGet(context: ApiRouteContext): Promise<Response> {
    const organizationId = await resolveCurrentOrgForAdmin(context);
    if (organizationId instanceof Response) return organizationId;

    const organization = await Organization.find(organizationId);
    if (!organization) {
        return errorResponse('Organization not found', 404, { code: 'NOT_FOUND' });
    }

    return jsonResponse({ data: organization.toJson() });
}

export async function handleCurrentOrganizationUpdate(context: ApiRouteContext): Promise<Response> {
    // We need the auth context for audit trail, so we call requireAdminAccess
    // directly rather than going through resolveCurrentOrgForAdmin.
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const organizationId = resolveTenantOrganizationId(auth);
    if (!organizationId) {
        return errorResponse('Select an organization to manage first', 400, { code: 'ORG_CONTEXT_REQUIRED' });
    }

    const body = await parseJsonBody<Record<string, unknown>>(context);
    if (body instanceof Response) return body;

    const validated = Organization.validateTenantUpdateInput(body);
    if (!validated.ok) {
        return errorResponse(validated.message, validated.code === 'FORBIDDEN' ? 403 : 400, {
            code: validated.code,
            fieldErrors: validated.fieldErrors,
        });
    }

    try {
        const updated = await Organization.update(organizationId, validated.patch);
        await auditOrganizationAction(context.request, {
            userId: auth.user?.id,
            userEmail: auth.user?.email ?? null,
            organizationId,
            action: 'update',
            resourceType: 'organization',
            resourceId: organizationId,
            changes: validated.patch,
        });
        return jsonResponse({ data: updated.toJson() });
    } catch (error) {
        return errorResponse('Failed to update organization', 500, {
            code: 'ORG_UPDATE_FAILED',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

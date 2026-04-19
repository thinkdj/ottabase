import { Organization } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminAccess } from '../lib/admin-guard';
import { auditOrganizationAction } from '../lib/org-audit';
import type { ApiRouteContext } from './router';

export async function handlePlatformOrganizationAvailability(context: ApiRouteContext): Promise<Response> {
    /** Global uniqueness checks are an enumeration surface for org admins; restrict to system scope. */
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const url = new URL(context.request.url);
    const slug = (url.searchParams.get('slug') || '').trim().toLowerCase();
    const name = (url.searchParams.get('name') || '').trim();
    const excludeId = (url.searchParams.get('excludeId') || '').trim() || undefined;

    if (!slug && !name) {
        return errorResponse('Provide slug and/or name query parameter', 400, { code: 'BAD_REQUEST' });
    }

    try {
        const slugTaken = slug ? await Organization.isSlugTaken(slug, excludeId) : false;
        const nameTaken = name ? await Organization.isNameTaken(name, excludeId) : false;

        return jsonResponse({
            data: {
                slugAvailable: slug ? !slugTaken : true,
                nameAvailable: name ? !nameTaken : true,
                slugTaken,
                nameTaken,
            },
        });
    } catch (err) {
        return errorResponse('Availability check failed', 500, {
            code: 'ORG_AVAILABILITY_FAILED',
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

/**
 * Basic offboarding: mark organization as cancelled (soft). System admin only.
 */
export async function handlePlatformOrganizationOffboard(
    context: ApiRouteContext,
    organizationId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const org = await Organization.find(organizationId);
    if (!org) {
        return errorResponse('Organization not found', 404, { code: 'NOT_FOUND' });
    }

    const prevStatus = String(org.get('status') ?? '');

    try {
        const updated = await Organization.updateStatus(organizationId, 'cancelled');
        await auditOrganizationAction(context.request, {
            userId: auth.user?.id,
            userEmail: auth.user?.email ?? null,
            organizationId,
            action: 'offboard',
            resourceType: 'organization',
            resourceId: organizationId,
            changes: { status: { from: prevStatus, to: 'cancelled' } },
        });
        return jsonResponse({ data: updated.toJson() });
    } catch (err) {
        return errorResponse('Failed to offboard organization', 500, {
            code: 'ORG_OFFBOARD_FAILED',
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

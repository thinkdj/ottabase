// ============================================================
// Platform-admin (system-scope) organization handlers.
// These operate on arbitrary org ids and are restricted to
// users with system-level admin access.
// ============================================================

import { Organization, organizationsTable } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { desc } from 'drizzle-orm';
import { requireAdminAccess } from '../lib/admin-guard';
import { auditOrganizationAction } from '../lib/org-audit';
import type { ApiRouteContext } from './router';
import { createOrganizationWithOwner, parseJsonBody } from './shared/organization-validation';

export async function handlePlatformOrganizationsList(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const rows = await Organization.getDriver()
        .getDb()
        .select()
        .from(organizationsTable)
        .orderBy(desc(organizationsTable.createdAt));
    return jsonResponse({ data: rows });
}

export async function handlePlatformOrganizationGet(
    context: ApiRouteContext,
    organizationId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const organization = await Organization.find(organizationId);
    if (!organization) {
        return errorResponse('Organization not found', 404, { code: 'NOT_FOUND' });
    }

    return jsonResponse({ data: organization.toJson() });
}

export async function handlePlatformOrganizationCreate(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const body = await parseJsonBody<Record<string, unknown>>(context);
    if (body instanceof Response) return body;

    return createOrganizationWithOwner(context, body, {
        userId: String(auth.user?.id || ''),
        userEmail: auth.user?.email ?? null,
        userName: auth.user?.name ?? null,
    });
}

export async function handlePlatformOrganizationUpdate(
    context: ApiRouteContext,
    organizationId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const existing = await Organization.find(organizationId);
    if (!existing) {
        return errorResponse('Organization not found', 404, { code: 'NOT_FOUND' });
    }

    const body = await parseJsonBody<Record<string, unknown>>(context);
    if (body instanceof Response) return body;

    const validated = Organization.validatePlatformUpdateInput(body);
    if (!validated.ok) {
        return errorResponse(validated.message, 400, {
            code: validated.code,
            fieldErrors: validated.fieldErrors,
        });
    }

    const { patch } = validated;
    const nextName = typeof patch.name === 'string' ? patch.name : String(existing.get('name') || '');
    const nextSlug = typeof patch.slug === 'string' ? patch.slug : String(existing.get('slug') || '');

    if (patch.name !== undefined && (await Organization.isNameTaken(nextName, organizationId))) {
        return errorResponse('Organization name already exists', 409, { code: 'ORG_NAME_TAKEN' });
    }

    if (patch.slug !== undefined && (await Organization.isSlugTaken(nextSlug, organizationId))) {
        return errorResponse('Slug already taken', 409, { code: 'ORG_SLUG_TAKEN' });
    }

    try {
        const updated = await Organization.update(organizationId, patch);
        await auditOrganizationAction(context.request, {
            userId: auth.user?.id,
            userEmail: auth.user?.email ?? null,
            organizationId,
            action: 'update',
            resourceType: 'organization',
            resourceId: organizationId,
            changes: patch,
        });
        return jsonResponse({ data: updated.toJson() });
    } catch (error) {
        return errorResponse('Failed to update organization', 500, {
            code: 'ORG_UPDATE_FAILED',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

export async function handlePlatformOrganizationDelete(
    context: ApiRouteContext,
    organizationId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const existing = await Organization.find(organizationId);
    if (!existing) {
        return errorResponse('Organization not found', 404, { code: 'NOT_FOUND' });
    }

    try {
        await Organization.delete(organizationId);
        await auditOrganizationAction(context.request, {
            userId: auth.user?.id,
            userEmail: auth.user?.email ?? null,
            organizationId,
            action: 'delete',
            resourceType: 'organization',
            resourceId: organizationId,
        });
        return jsonResponse({ ok: true });
    } catch (error) {
        return errorResponse('Failed to delete organization', 500, {
            code: 'ORG_DELETE_FAILED',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

/**
 * Global uniqueness checks are an enumeration surface for org admins;
 * restrict to system scope.
 */
export async function handlePlatformOrganizationAvailability(context: ApiRouteContext): Promise<Response> {
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

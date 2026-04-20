import { Role } from '@ottabase/ottaorm/models';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { ApiRouteContext } from './router';

/**
 * List all available roles (system + custom) with their permissions.
 * Consumed by /admin/access/rbac/roles and /admin-platform/users role assignment.
 */
export async function handleRBACRolesList(context: ApiRouteContext): Promise<Response> {
    try {
        const roles = await Role.all();

        return jsonResponse({
            data: roles.map((role) => ({
                id: role.get('id'),
                name: role.get('name'),
                description: role.get('description'),
                permissions: role.getPermissions(),
                isSystem: role.get('isSystem'),
                createdAt: role.get('createdAt'),
                updatedAt: role.get('updatedAt'),
            })),
        });
    } catch (err) {
        return new Response(
            JSON.stringify({
                error: 'Failed to load roles',
                details: err instanceof Error ? err.message : 'Unknown error',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
}

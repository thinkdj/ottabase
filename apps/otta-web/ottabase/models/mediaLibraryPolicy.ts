import type { ModelRLSConfig, SecurityContext } from '@ottabase/ottaorm';
import { hasGrantedPermission } from '@ottabase/utils/permissions';

function hasManageAllAccess(context: SecurityContext): boolean {
    return hasGrantedPermission(context.permissions, 'media:manage');
}

export function buildMediaLibraryAccessFilter(context: SecurityContext): Record<string, unknown> | null {
    if (!context.appId) {
        return null;
    }

    const baseFilter: Record<string, unknown> = {
        appId: context.appId,
    };

    if (context.organizationId !== undefined) {
        baseFilter.organizationId = context.organizationId;
    }

    if (hasManageAllAccess(context)) {
        return baseFilter;
    }

    if (!context.userId) {
        return null;
    }

    return {
        ...baseFilter,
        userId: context.userId,
    };
}

export const mediaLibraryPolicy: ModelRLSConfig = {
    model: 'media',
    policy: {
        level: 'custom',
        filter: buildMediaLibraryAccessFilter,
    },
    contextFields: ['organizationId', 'appId', 'userId'],
    auditEnabled: true,
};

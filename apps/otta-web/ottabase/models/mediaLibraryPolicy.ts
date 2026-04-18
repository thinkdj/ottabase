import type { ModelRLSConfig, SecurityContext } from '@ottabase/ottaorm';

function hasManageAllAccess(context: SecurityContext): boolean {
    if (context.roles?.includes('admin') || context.roles?.includes('owner')) {
        return true;
    }

    return (
        context.permissions?.includes('*:*') ||
        context.permissions?.includes('media:*') ||
        context.permissions?.includes('media:manage') ||
        false
    );
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

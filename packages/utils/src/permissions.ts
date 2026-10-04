/**
 * Match one granted permission against one required permission.
 *
 * Permissions use exactly two non-empty segments: `resource:action`. Exact
 * strings always match, while `*` is interpreted only in the granted
 * permission. Malformed and multi-segment values never gain wildcard powers.
 */
export function permissionMatches(granted: string, required: string): boolean {
    if (granted === required) return true;

    const grantedParts = granted.split(':');
    const requiredParts = required.split(':');
    if (
        grantedParts.length !== 2 ||
        requiredParts.length !== 2 ||
        grantedParts.some((part) => part.length === 0) ||
        requiredParts.some((part) => part.length === 0)
    ) {
        return false;
    }

    const [grantedResource, grantedAction] = grantedParts;
    const [requiredResource, requiredAction] = requiredParts;

    return (
        (grantedResource === '*' || grantedResource === requiredResource) &&
        (grantedAction === '*' || grantedAction === requiredAction)
    );
}

/** Return whether any granted permission satisfies the required permission. */
export function hasGrantedPermission(
    grantedPermissions: Iterable<string> | null | undefined,
    required: string,
): boolean {
    if (!grantedPermissions) return false;
    for (const granted of grantedPermissions) {
        if (permissionMatches(granted, required)) return true;
    }
    return false;
}

/** One permission the server enforces, with copy for admin screens */
export interface PermissionDefinition {
    /** `resource:action`, exactly as checked on the server */
    id: string;
    /** Short human label ("Publish posts") */
    label: string;
    /** One sentence on what it unlocks */
    description: string;
    /** Section heading for grouping in UIs */
    group: string;
}

/**
 * Every permission the server actually checks. Admin UIs offer these and only
 * these, so a toggle always changes what a role can do. When you add a new
 * `hasGrantedPermission(..., 'x:y')` check on the server, add it here too.
 *
 * Wildcards (`*:*`, `*:read`, `posts:*`) are grants, not entries: use
 * `findGrantingPermission` to show what a wildcard already covers.
 */
export const PERMISSION_CATALOG: readonly PermissionDefinition[] = [
    {
        id: 'platform:admin',
        label: 'Platform admin',
        description: 'Run the whole platform. Only honoured on system-scoped grants.',
        group: 'Platform',
    },
    {
        id: 'org:admin',
        label: 'Organization admin',
        description: 'Manage this organization: members, roles, settings and all of its content.',
        group: 'Organization',
    },
    { id: 'posts:create', label: 'Write posts', description: 'Create new posts and drafts.', group: 'Content' },
    { id: 'posts:update', label: 'Edit posts', description: 'Edit their own posts.', group: 'Content' },
    {
        id: 'posts:publish',
        label: 'Publish posts',
        description: 'Publish, schedule and unpublish posts.',
        group: 'Content',
    },
    {
        id: 'posts:manage',
        label: "Manage everyone's posts",
        description: 'Edit, publish and delete posts written by others.',
        group: 'Content',
    },
    {
        id: 'taxonomy:manage',
        label: 'Manage tags and categories',
        description: 'Create, rename and delete tags, categories and series.',
        group: 'Content',
    },
    {
        id: 'comments:moderate',
        label: 'Moderate comments',
        description: 'Hide, restore and remove comments.',
        group: 'Content',
    },
    {
        id: 'brand:edit',
        label: 'Edit appearance',
        description: 'Change brand kits, menus and layouts.',
        group: 'Appearance',
    },
    { id: 'ai:manage', label: 'Manage AI providers', description: 'Connect and configure AI providers.', group: 'AI' },
];

/**
 * The grant that satisfies `required`, preferring an exact match, or null.
 * Lets UIs say "Included in *:read" instead of showing a wildcard-covered
 * permission as missing.
 */
export function findGrantingPermission(
    grantedPermissions: Iterable<string> | null | undefined,
    required: string,
): string | null {
    if (!grantedPermissions) return null;
    let wildcard: string | null = null;
    for (const granted of grantedPermissions) {
        if (granted === required) return granted;
        if (!wildcard && permissionMatches(granted, required)) wildcard = granted;
    }
    return wildcard;
}

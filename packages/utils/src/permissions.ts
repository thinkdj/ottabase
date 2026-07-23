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

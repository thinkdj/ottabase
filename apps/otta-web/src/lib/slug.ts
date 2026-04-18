/**
 * Generate URL-friendly slug from organization (or similar) name.
 * Matches backend expectations: lowercase, a-z0-9 and hyphens only, trim edges.
 * Use for organization slug in forms and registration.
 */
export function slugFromName(name: string): string {
    if (!name || typeof name !== 'string') return '';
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

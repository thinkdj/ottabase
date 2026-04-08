/**
 * Redirects /admin/changelog/:entryId/edit to /admin/blog/:postId/edit
 *
 * Used for backward compatibility after unifying changelogs with ottablog.
 */
import { Navigate, useParams } from '@tanstack/react-router';

export function ChangelogEditRedirect() {
    const params = useParams({ strict: false });
    const entryId = (params as { entryId?: string }).entryId ?? '';
    return <Navigate to="/admin/blog/$postId/edit" params={{ postId: entryId }} />;
}

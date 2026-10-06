import { isPlatformAdmin, useSession } from '@/lib/auth';
import { Alert } from '@ottabase/ui-shadcn';

/** Whether the viewer can call the admin-only demo endpoints: a confirmed session for a platform admin */
export function useDemoAdmin() {
    const { user, isInitialized, isLoading } = useSession();
    return isInitialized && !isLoading && isPlatformAdmin(user);
}

/** Shown in place of requests that would only come back 401 or 403 */
export function DemoAdminNotice() {
    return (
        <Alert variant="warning">
            This page talks to the real binding, so its endpoints answer a signed-in platform admin only. Sign in as the
            platform owner to try it.
        </Alert>
    );
}

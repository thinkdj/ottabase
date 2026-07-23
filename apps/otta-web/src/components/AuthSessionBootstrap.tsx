import { useSessionBootstrap } from '@/lib/auth';

/**
 * Starts the one application-wide session sync.
 *
 * Render components consume `useSession()` without side effects. Keeping the one
 * initialization request here prevents route remounts from retriggering it.
 */
export function AuthSessionBootstrap() {
    useSessionBootstrap();
    return null;
}

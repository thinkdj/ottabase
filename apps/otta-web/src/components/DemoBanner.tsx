import { useDemoMode } from '@/hooks/useDemoMode';
import { useSession } from '@/lib/auth';
import { rememberReturnPath } from '@/lib/auth-redirect';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { useState } from 'react';

/**
 * The strip across the top of a public demo (`DEMO_MODE`): it says the data is a sandbox, invites
 * anonymous visitors to sign up, and carries the deploy's call to action. Renders nothing on a
 * normal deploy. Hidden for the rest of the visit once dismissed.
 */
export function DemoBanner() {
    const demo = useDemoMode();
    const { isAuthenticated } = useSession();
    const [hidden, setHidden] = useState(false);
    if (!demo.enabled || hidden) return null;

    return (
        <div
            role="region"
            aria-label="Demo notice"
            className="relative flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-foreground px-10 py-1.5 text-center text-xs text-background"
        >
            <span>This is a live public demo. Treat what you store here as temporary.</span>
            {!isAuthenticated ? (
                <Link
                    to="/register"
                    onClick={() => rememberReturnPath()}
                    className="font-medium underline underline-offset-2"
                >
                    Sign up free to try realtime, screenshots and AI
                </Link>
            ) : null}
            {demo.ctaUrl && demo.ctaLabel ? (
                <a
                    href={sanitizeUrl(demo.ctaUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-2"
                >
                    {demo.ctaLabel} →
                </a>
            ) : null}
            <button
                type="button"
                aria-label="Hide the demo notice"
                onClick={() => setHidden(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-background/15"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

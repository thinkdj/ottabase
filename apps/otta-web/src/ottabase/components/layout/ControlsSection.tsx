import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NotificationBell } from '@/components/NotificationBell';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { appConfig } from '@/ottabase/config';
import { i18nConfig } from '@/ottabase/config/i18n.config';
import { organizationIdAtom } from '@/ottabase/state/appState';
import { PLATFORM_ORG_SENTINEL } from '@ottabase/config';
import { SpotlightContext } from '@ottabase/spotlight';
import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';
import { Search } from 'lucide-react';
import { useSetAtom } from 'jotai';
import { useContext } from 'react';

function useOrganizationSelection() {
    const [currentOrgId, setCurrentOrgId] = useLocalStorage<string>('ottabase.current-org-id');
    const setOrganizationId = useSetAtom(organizationIdAtom);
    const { refreshSession } = useSession();

    const setOrganization = (orgId: string) => {
        // Apply locally for instant UI feedback... (the sentinel makes the api
        // client send x-org-id: platform, which the worker honors for platform
        // admins as explicit NULL-org scope, the platform's own blog etc.)
        setCurrentOrgId(orgId);
        setOrganizationId(orgId);
        // ...and persist server-side (membership-validated) so a REAL org choice survives
        // across sessions and devices. Platform scope maps to CLEARING the active org, the
        // sentinel is not an organization and would fail membership validation, which also
        // means it has no cross-device persistence; useSession's sync effect (lib/auth.ts,
        // resolveEffectiveOrgId) keeps it sticky client-side instead, using the localStorage
        // value set above, so the session's post-clear fallback org (the earliest membership)
        // does not immediately overwrite the selection once refreshSession() re-reads it.
        // Once the server has accepted the switch, refresh the cached session snapshot:
        // org-dependent UI (e.g. the Admin link, rendered from session permissions)
        // must track the new org without requiring a /admin visit or reload.
        const activeOrganizationId = orgId === PLATFORM_ORG_SENTINEL ? null : orgId;
        void api('/api/users/me', { method: 'PATCH', body: { activeOrganizationId } })
            .then(() => refreshSession())
            .catch(() => {});
    };

    return { currentOrgId, setOrganization };
}

/** Opens the command palette; the only way in on touch devices, and a visible hint of the shortcut */
function SearchButton() {
    // Read the context directly: the header may render where no palette is mounted
    const spotlight = useContext(SpotlightContext);
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
    const shortcut = isMac ? '⌘K' : 'Ctrl K';
    if (!spotlight) return null;
    return (
        <button
            type="button"
            onClick={() => spotlight?.setOpen(true)}
            aria-label={`Search (${shortcut})`}
            className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:border md:border-border md:pr-1.5"
        >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">Search</span>
            <kbd className="hidden rounded border border-border bg-muted px-1.5 font-mono text-[0.6875rem] md:inline">
                {shortcut}
            </kbd>
        </button>
    );
}

export function ControlsSection() {
    const { isAuthenticated } = useSession();
    const { currentOrgId, setOrganization } = useOrganizationSelection();

    return (
        <div className="flex items-center gap-1">
            {appConfig.features.spotlight.enabled && <SearchButton />}
            <DarkModeToggle type="button" title="Toggle dark/light mode" />
            {/* Only once there is a choice; the least urgent control, so it yields first on narrow headers */}
            {i18nConfig.enabledLanguages.length > 1 && (
                <span className="hidden sm:inline-flex">
                    <LanguageSwitcher languages={i18nConfig.enabledLanguages} showLabel={false} />
                </span>
            )}
            {isAuthenticated && <NotificationBell />}
            {isAuthenticated && <OrganizationSwitcher currentOrgId={currentOrgId} onOrgChange={setOrganization} />}
        </div>
    );
}

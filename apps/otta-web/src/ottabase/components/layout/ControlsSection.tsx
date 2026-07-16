import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { i18nConfig } from '@/ottabase/config/i18n.config';
import { organizationIdAtom } from '@/ottabase/state/appState';
import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';
import { useSetAtom } from 'jotai';

function useOrganizationSelection() {
    const [currentOrgId, setCurrentOrgId] = useLocalStorage<string>('ottabase.current-org-id');
    const setOrganizationId = useSetAtom(organizationIdAtom);
    const { refreshSession } = useSession();

    const setOrganization = (orgId: string) => {
        // Apply locally for instant UI feedback...
        setCurrentOrgId(orgId);
        setOrganizationId(orgId);
        // ...and persist server-side (membership-validated) so the choice survives across
        // sessions and devices. Once the server has accepted the switch, refresh the cached
        // session snapshot: org-dependent UI (e.g. the Admin link, rendered from session
        // permissions) must track the new org without requiring a /admin visit or reload.
        void api('/api/users/me', { method: 'PATCH', body: { activeOrganizationId: orgId } })
            .then(() => refreshSession())
            .catch(() => {});
    };

    return { currentOrgId, setOrganization };
}

export function ControlsSection() {
    const { isAuthenticated } = useSession();
    const { currentOrgId, setOrganization } = useOrganizationSelection();

    return (
        <div className="flex items-center gap-1">
            <DarkModeToggle type="button" title="Toggle dark/light mode" />
            <LanguageSwitcher languages={i18nConfig.enabledLanguages} showLabel={false} />
            {isAuthenticated && <OrganizationSwitcher currentOrgId={currentOrgId} onOrgChange={setOrganization} />}
        </div>
    );
}

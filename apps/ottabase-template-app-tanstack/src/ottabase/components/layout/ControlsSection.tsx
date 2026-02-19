import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useSession } from '@/lib/auth';
import { i18nConfig } from '@/ottabase/config/i18n.config';
import { organizationIdAtom } from '@/ottabase/state/appState';
import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';
import { useSetAtom } from 'jotai';

function useOrganizationSelection() {
    const [currentOrgId, setCurrentOrgId] = useLocalStorage<string>('ottabase.current-org-id');
    const setOrganizationId = useSetAtom(organizationIdAtom);

    const setOrganization = (orgId: string) => {
        setCurrentOrgId(orgId);
        setOrganizationId(orgId);
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

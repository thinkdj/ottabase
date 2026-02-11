import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useSession } from '@/lib/auth';
import { i18nConfig } from '@/ottabase/config/i18n.config';
import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';

export function ControlsSection() {
    const { isAuthenticated } = useSession();
    const [currentOrgId, setCurrentOrgId] = useLocalStorage<string>('currentOrgId');

    return (
        <div className="flex items-center gap-1">
            <DarkModeToggle type="button" title="Toggle dark/light mode" />
            <LanguageSwitcher languages={i18nConfig.enabledLanguages} showLabel={false} />
            {isAuthenticated && <OrganizationSwitcher currentOrgId={currentOrgId} onOrgChange={setCurrentOrgId} />}
        </div>
    );
}

import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { i18nConfig } from '@/ottabase/config/i18n.config';
import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';

export function ControlsSection() {
    return (
        <div className="flex items-center gap-1">
            <DarkModeToggle type="button" title="Toggle dark/light mode" />
            <LanguageSwitcher languages={i18nConfig.enabledLanguages} showLabel={false} />
        </div>
    );
}

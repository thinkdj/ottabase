import { languageNames, supportedLanguages, useTranslation, type SupportedLanguage } from '@ottabase/i18n/react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@ottabase/ui-shadcn';
import { Check, Languages } from 'lucide-react';

export interface LanguageSwitcherProps {
    /** Languages to show in the switcher. If omitted, uses package supportedLanguages. Pass e.g. i18nConfig.enabledLanguages to respect app config. */
    languages?: readonly SupportedLanguage[];
    variant?: 'default' | 'ghost' | 'outline' | 'secondary';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    showIcon?: boolean;
    showLabel?: boolean;
}

/**
 * LanguageSwitcher component for changing the application language
 *
 * @example
 * ```tsx
 * // Basic usage
 * <LanguageSwitcher />
 *
 * // Customized
 * <LanguageSwitcher variant="ghost" size="sm" showLabel={false} />
 * ```
 */
export function LanguageSwitcher({
    languages,
    variant = 'ghost',
    size = 'sm',
    showIcon = true,
    showLabel = true,
}: LanguageSwitcherProps) {
    const { i18n, t } = useTranslation('common');
    const currentLanguage = i18n.language as SupportedLanguage;
    const options = languages?.length ? [...languages] : supportedLanguages;

    const handleLanguageChange = (lang: SupportedLanguage) => {
        i18n.changeLanguage(lang);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant={variant} size={size} className="gap-2">
                    {showIcon && <Languages size={16} />}
                    {showLabel && (languageNames[currentLanguage] || t('language'))}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel>{t('selectLanguage')}</DropdownMenuLabel>
                {options.map((lang) => (
                    <DropdownMenuItem key={lang} onClick={() => handleLanguageChange(lang)} className="cursor-pointer">
                        <div className="flex items-center justify-between w-full">
                            <span>{languageNames[lang]}</span>
                            {currentLanguage === lang && <Check size={16} className="ml-2" />}
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

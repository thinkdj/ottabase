import { Button, Menu } from '@mantine/core';
import { useTranslation } from '@ottabase/i18n/react';
import { supportedLanguages, languageNames, type SupportedLanguage } from '@ottabase/i18n/react';
import { Languages } from 'lucide-react';

export interface LanguageSwitcherProps {
    variant?: 'default' | 'subtle' | 'filled' | 'light' | 'outline';
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
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
 * <LanguageSwitcher variant="subtle" size="sm" showLabel={false} />
 * ```
 */
export function LanguageSwitcher({
    variant = 'subtle',
    size = 'sm',
    showIcon = true,
    showLabel = true,
}: LanguageSwitcherProps) {
    const { i18n, t } = useTranslation('common');
    const currentLanguage = i18n.language as SupportedLanguage;

    const handleLanguageChange = (lang: SupportedLanguage) => {
        i18n.changeLanguage(lang);
    };

    return (
        <Menu shadow="md" width={200}>
            <Menu.Target>
                <Button variant={variant} size={size} leftSection={showIcon ? <Languages size={16} /> : undefined}>
                    {showLabel && (languageNames[currentLanguage] || t('language'))}
                </Button>
            </Menu.Target>

            <Menu.Dropdown>
                <Menu.Label>{t('selectLanguage')}</Menu.Label>
                {supportedLanguages.map((lang) => (
                    <Menu.Item
                        key={lang}
                        onClick={() => handleLanguageChange(lang)}
                        bg={currentLanguage === lang ? 'var(--mantine-color-blue-light)' : undefined}
                    >
                        {languageNames[lang]}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}

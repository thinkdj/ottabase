import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@ottabase/ui-shadcn';
import { Check, Palette } from 'lucide-react';
import { useTheme } from '../providers/ThemeContext';
import { getAvailableThemes } from '../utils/theme.loader';

export function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const themes = getAvailableThemes();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 px-0" title="Switch Theme">
                    <Palette className="h-4 w-4" />
                    <span className="sr-only">Switch Theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {themes.map((t) => (
                    <DropdownMenuItem
                        key={t}
                        className="flex items-center justify-between capitalize"
                        onClick={() => setTheme(t)}
                    >
                        {t}
                        {theme === t && <Check className="ml-2 h-4 w-4" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

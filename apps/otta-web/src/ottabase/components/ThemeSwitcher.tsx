import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';

/**
 * Public theme control.
 *
 * The app-level Brand theme context exposes a compatibility setter, but the supported user-facing
 * theme choice is the next-themes light/dark mode. Keeping this wrapper preserves existing imports
 * while making the control actually update html.dark and all scoped publication tokens.
 */
export function ThemeSwitcher() {
    return (
        <span className="personal-theme-switcher">
            <DarkModeToggle type="button" title="Toggle dark/light mode" />
        </span>
    );
}

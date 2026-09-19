import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeSwitcher } from '../ThemeSwitcher';

vi.mock('@ottabase/ui-components/dark-mode-toggle', () => ({
    DarkModeToggle: ({ title, type }: { title: string; type: string }) => (
        <button type="button" title={title} data-toggle-type={type}>
            Toggle
        </button>
    ),
}));

describe('ThemeSwitcher', () => {
    it('uses the working light/dark mode control', () => {
        render(<ThemeSwitcher />);

        expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('title', 'Toggle dark/light mode');
        expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('data-toggle-type', 'button');
    });
});

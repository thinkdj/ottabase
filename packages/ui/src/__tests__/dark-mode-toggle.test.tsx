import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { DarkModeToggle } from '../../components/ui/dark-mode-toggle';
import { ThemeProvider } from '../../providers/theme-provider';

afterEach(() => {
    document.documentElement.className = '';
    localStorage.clear();
});

describe('DarkModeToggle', () => {
    it('flips the theme and marks <html> so colours ease instead of snapping', async () => {
        render(
            <ThemeProvider>
                <DarkModeToggle type="button" title="Toggle theme" />
            </ThemeProvider>,
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Toggle theme' }));

        expect(document.documentElement).toHaveClass('theming');
        await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
    });

    it('reports its state as a switch', async () => {
        render(
            <ThemeProvider>
                <DarkModeToggle type="toggle-switch" title="Dark mode" />
            </ThemeProvider>,
        );

        const toggle = await screen.findByRole('switch', { name: 'Dark mode' });
        expect(toggle).toHaveAttribute('aria-checked', 'false');

        fireEvent.click(toggle);
        await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    });
});

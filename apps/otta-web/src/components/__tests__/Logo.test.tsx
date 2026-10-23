import { createAppConfig } from '@ottabase/config';
import { ThemeProvider } from '@ottabase/ui';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Logo } from '../Logo';

const config = createAppConfig({
    appName: 'Config App',
    defaults: { meta: { appName: 'Config App', logoUrl: '/config-logo.png' } },
});

describe('Logo', () => {
    it('shows the logo image and the app name', () => {
        render(<Logo appName="Northwind" logoUrl="/nw.png" size={40} />);
        const image = screen.getByRole('img', { name: 'Northwind' });
        expect(image).toHaveAttribute('src', '/nw.png');
        expect(image).toHaveAttribute('height', '40');
        expect(screen.getByRole('heading', { name: 'Northwind' })).toBeInTheDocument();
    });

    it('takes the name and image from the app config when none are passed', () => {
        render(<Logo appConfig={config} />);
        expect(screen.getByRole('img', { name: 'Config App' })).toHaveAttribute('src', '/config-logo.png');
        expect(screen.getByRole('heading', { name: 'Config App' })).toBeInTheDocument();
    });

    it('prefers what it is given over the config', () => {
        render(<Logo appConfig={config} appName="Given" logoUrl="/given.png" />);
        expect(screen.getByRole('img', { name: 'Given' })).toHaveAttribute('src', '/given.png');
        expect(screen.queryByText('Config App')).toBeNull();
    });

    it('wraps the logo in a link only when it has a linkUrl', () => {
        const { unmount } = render(<Logo appName="Northwind" linkUrl="/home" />);
        const link = screen.getByRole('link', { name: 'Northwind' });
        expect(link).toHaveAttribute('href', '/home');
        expect(link).toHaveAttribute('title', 'Northwind');
        unmount();

        render(<Logo appName="Northwind" />);
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('reserves more width for a long name', () => {
        const { container, rerender } = render(<Logo appName="Short" />);
        expect(container.firstElementChild).toHaveClass('min-w-[100px]');

        rerender(<Logo appName="A much longer name" />);
        expect(container.firstElementChild).toHaveClass('min-w-[279px]');
    });

    it('shows the theme switch only when asked', async () => {
        const { unmount } = render(
            <ThemeProvider>
                <Logo appName="Northwind" darkModeSwitcher />
            </ThemeProvider>,
        );
        expect(await screen.findByRole('button', { name: 'Toggle color scheme' })).toBeInTheDocument();
        unmount();

        render(
            <ThemeProvider>
                <Logo appName="Northwind" />
            </ThemeProvider>,
        );
        expect(screen.queryByRole('button')).toBeNull();
    });
});

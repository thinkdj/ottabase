import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock transitive deps that Vite cannot resolve in test environment
vi.mock('@ottabase/ottalayout', () => ({ DEFAULT_LAYOUT: {} }));

// Mock brand-engine: only mock the functions components actually call
vi.mock('@ottabase/brand-engine', () => ({
    applyBrandTheme: vi.fn(),
    registerBuiltInThemes: vi.fn(),
    getThemeByName: vi.fn(() => ({ name: 'default', colors: {} })),
    resolveTheme: vi.fn(() => ({
        colors: { primary: '220 70% 50%', secondary: '260 30% 50%', accent: '180 60% 40%', muted: '220 10% 90%' },
        typography: {
            heading: { fontFamily: 'Inter' },
            body: { fontFamily: 'Inter' },
            handwriting: { fontFamily: 'Caveat' },
        },
        radius: '0.5rem',
    })),
    BUILTIN_THEME_NAMES: ['default', 'neo', 'crisp', 'funky', 'artisan', 'midnight', 'rose', 'verdant'],
    PRESET_MAP: {
        default: {
            colors: {
                light: {
                    primary: '220 70% 50%',
                    secondary: '260 30% 50%',
                    accent: '180 60% 40%',
                    muted: '220 10% 90%',
                },
            },
        },
        neo: {
            colors: {
                light: { primary: '250 80% 60%', secondary: '200 60% 50%', accent: '30 90% 55%', muted: '250 10% 90%' },
            },
        },
    },
    buildCriticalCSS: vi.fn(() => ':root { --primary: 220 70% 50%; }'),
}));

vi.mock('@ottabase/brand-engine-react', () => ({
    BrandProvider: ({ children }: { children: React.ReactNode }) =>
        createElement('div', { 'data-testid': 'brand-provider' }, children),
    useBrand: vi.fn(() => ({
        config: {
            theme: {
                colors: { primary: '220 70% 50%', background: '0 0% 100%', foreground: '220 10% 10%' },
                typography: {
                    heading: { fontFamily: 'Inter' },
                    body: { fontFamily: 'Inter' },
                    handwriting: { fontFamily: 'Caveat' },
                },
                radius: '0.5rem',
            },
            themeBase: 'default',
        },
    })),
}));

vi.mock('@ottabase/ui-shadcn', () => ({
    Button: ({ children, asChild, variant, size, ...props }: any) =>
        createElement('button', { 'data-variant': variant, 'data-size': size, ...props }, children),
    ShadcnProviders: ({ children }: any) => createElement('div', null, children),
}));

vi.mock('@ottabase/ui-components/dark-mode-toggle', () => ({
    DarkModeToggle: (props: any) => createElement('button', { 'data-testid': 'dark-mode-toggle', ...props }, 'Toggle'),
}));

vi.mock('next-themes', () => ({
    ThemeProvider: ({ children }: any) => createElement('div', null, children),
    useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}));

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Navbar', () => {
    let Navbar: any;

    beforeEach(async () => {
        ({ Navbar } = await import('../components/Navbar'));
    });

    it('renders site title', () => {
        render(<Navbar title="TestSite" />);
        expect(screen.getByText('TestSite')).toBeDefined();
    });

    it('renders default nav links', () => {
        render(<Navbar />);
        expect(screen.getByText('Home')).toBeDefined();
        expect(screen.getByText('About')).toBeDefined();
        expect(screen.getByText('Themes')).toBeDefined();
    });

    it('renders custom links', () => {
        const links = [{ href: '/docs', label: 'Docs' }];
        render(<Navbar links={links} />);
        expect(screen.getByText('Docs')).toBeDefined();
    });

    it('renders GitHub link when githubUrl is provided', () => {
        render(<Navbar githubUrl="https://github.com/test/repo" />);
        expect(screen.getByText('GitHub')).toBeDefined();
    });

    it('toggles mobile menu', () => {
        render(<Navbar />);
        const toggle = screen.getByLabelText('Toggle menu');
        // Menu should not be visible initially (mobile links are in a separate div)
        fireEvent.click(toggle);
        // After click, mobile menu appears — links are duplicated for mobile
        const aboutLinks = screen.getAllByText('About');
        expect(aboutLinks.length).toBeGreaterThanOrEqual(2);
    });

    it('renders dark mode toggle', () => {
        render(<Navbar />);
        expect(screen.getByTestId('dark-mode-toggle')).toBeDefined();
    });
});

describe('Footer', () => {
    let Footer: any;

    beforeEach(async () => {
        ({ Footer } = await import('../components/Footer'));
    });

    it('renders site name in copyright', () => {
        render(<Footer siteName="Acme" />);
        expect(screen.getByText(/Acme/)).toBeDefined();
    });

    it('renders tagline when provided', () => {
        render(<Footer tagline="Built with love" />);
        expect(screen.getByText('Built with love')).toBeDefined();
    });

    it('renders footer links', () => {
        const links = [
            { href: '/about', label: 'About' },
            { href: 'https://github.com', label: 'GitHub', external: true },
        ];
        render(<Footer links={links} />);
        expect(screen.getByText('About')).toBeDefined();
        expect(screen.getByText('GitHub')).toBeDefined();
    });

    it('sets target=_blank for external links', () => {
        const links = [{ href: 'https://ext.com', label: 'External', external: true }];
        render(<Footer links={links} />);
        const link = screen.getByText('External');
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
    });

    it('uses default site name when none provided', () => {
        render(<Footer />);
        expect(screen.getByText(/Ottabase/)).toBeDefined();
    });
});

describe('Hero', () => {
    let Hero: any;

    beforeEach(async () => {
        ({ Hero } = await import('../components/Hero'));
    });

    it('renders title', () => {
        render(<Hero title="Welcome" />);
        expect(screen.getByText('Welcome')).toBeDefined();
    });

    it('renders subtitle and body', () => {
        render(<Hero title="Hi" subtitle="Sub text" body="Body text" />);
        expect(screen.getByText('Sub text')).toBeDefined();
        expect(screen.getByText('Body text')).toBeDefined();
    });

    it('renders action buttons', () => {
        render(
            <Hero
                title="T"
                actions={[
                    { href: '/a', label: 'Action A' },
                    { href: '/b', label: 'Action B', variant: 'outline' },
                ]}
            />,
        );
        expect(screen.getByText('Action A')).toBeDefined();
        expect(screen.getByText('Action B')).toBeDefined();
    });

    it('renders external action as anchor with target _blank', () => {
        render(<Hero title="T" actions={[{ href: 'https://ext.com', label: 'Ext', external: true }]} />);
        const link = screen.getByText('Ext');
        expect(link.closest('a')?.getAttribute('target')).toBe('_blank');
    });

    it('renders ReactNode title', () => {
        render(<Hero title={<span data-testid="custom-title">Styled</span>} />);
        expect(screen.getByTestId('custom-title')).toBeDefined();
    });
});

describe('FeatureItem / FeaturesGrid', () => {
    let FeatureItem: any;
    let FeaturesGrid: any;

    beforeEach(async () => {
        ({ FeatureItem, FeaturesGrid } = await import('../components/FeatureCard'));
    });

    it('renders a single feature item', () => {
        render(<FeatureItem title="Fast" description="Blazing fast" />);
        expect(screen.getByText('Fast')).toBeDefined();
        expect(screen.getByText('Blazing fast')).toBeDefined();
    });

    it('renders a grid of features', () => {
        const features = [
            { title: 'A', description: 'Desc A' },
            { title: 'B', description: 'Desc B' },
        ];
        render(<FeaturesGrid features={features} />);
        expect(screen.getByText('A')).toBeDefined();
        expect(screen.getByText('B')).toBeDefined();
    });

    it('renders optional section title', () => {
        render(<FeaturesGrid title="Features" features={[{ title: 'X', description: 'Y' }]} />);
        expect(screen.getByText('Features')).toBeDefined();
    });
});

describe('CTASection', () => {
    let CTASection: any;

    beforeEach(async () => {
        ({ CTASection } = await import('../components/CTASection'));
    });

    it('renders heading and description', () => {
        render(<CTASection title="Get Started" description="Start now." actions={[]} />);
        expect(screen.getByText('Get Started')).toBeDefined();
        expect(screen.getByText('Start now.')).toBeDefined();
    });

    it('renders action buttons', () => {
        render(
            <CTASection
                title="CTA"
                actions={[
                    { href: '/go', label: 'Go' },
                    { href: 'https://ext.com', label: 'External', external: true },
                ]}
            />,
        );
        expect(screen.getByText('Go')).toBeDefined();
        expect(screen.getByText('External')).toBeDefined();
    });
});

describe('ThemePresetSwitcher', () => {
    let ThemePresetSwitcher: any;

    beforeEach(async () => {
        localStorage.clear();
        ({ ThemePresetSwitcher } = await import('../components/ThemePresetSwitcher'));
    });

    it('renders all 8 preset buttons', () => {
        render(<ThemePresetSwitcher />);
        expect(screen.getByText('default')).toBeDefined();
        expect(screen.getByText('neo')).toBeDefined();
        expect(screen.getByText('artisan')).toBeDefined();
        expect(screen.getByText('midnight')).toBeDefined();
    });

    it('calls onSwitch when a preset is selected', async () => {
        const onSwitch = vi.fn();
        render(<ThemePresetSwitcher onSwitch={onSwitch} />);
        fireEvent.click(screen.getByText('neo'));
        expect(onSwitch).toHaveBeenCalledWith(expect.objectContaining({ presetName: 'neo' }));
    });

    it('saves selected preset to localStorage', () => {
        render(<ThemePresetSwitcher />);
        fireEvent.click(screen.getByText('neo'));
        expect(localStorage.getItem('ottabase.homepage.theme-preset')).toBe('neo');
    });

    it('reads initial preset from localStorage', () => {
        localStorage.setItem('ottabase.homepage.theme-preset', 'crisp');
        const { container } = render(<ThemePresetSwitcher />);
        // The crisp button should have the active styling (border-primary class)
        const crispButton = screen.getByText('crisp').closest('button');
        expect(crispButton?.className).toContain('border-primary');
    });

    it('applies and reports initial preset on load', async () => {
        const onSwitch = vi.fn();
        localStorage.setItem('ottabase.homepage.theme-preset', 'crisp');
        render(<ThemePresetSwitcher onSwitch={onSwitch} />);

        await waitFor(() => {
            expect(onSwitch).toHaveBeenCalledWith(expect.objectContaining({ presetName: 'crisp' }));
        });
    });
});

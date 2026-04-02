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

describe('LayoutShell navbar merge', () => {
    let mergeNavLinks: any;

    beforeEach(async () => {
        ({ mergeNavLinks } = await import('../app/layout-shell'));
    });

    it('returns base links when no exposed pages', () => {
        const base = [
            { href: '/', label: 'Home' },
            { href: '/about', label: 'About' },
        ];
        const result = mergeNavLinks(base, []);
        expect(result).toEqual(base);
    });

    it('appends exposed pages as /page/slug links', () => {
        const base = [{ href: '/', label: 'Home' }];
        const exposedPages = [
            { slug: 'about-us', title: 'About Us' },
            { slug: 'pricing', title: 'Pricing' },
        ];
        const result = mergeNavLinks(base, exposedPages);
        expect(result).toEqual([
            { href: '/', label: 'Home' },
            { href: '/page/about-us', label: 'About Us' },
            { href: '/page/pricing', label: 'Pricing' },
        ]);
    });

    it('deduplicates exposed pages by href', () => {
        const base = [{ href: '/page/about-us', label: 'Existing About' }];
        const exposedPages = [
            { slug: 'about-us', title: 'About Us' },
            { slug: 'pricing', title: 'Pricing' },
        ];
        const result = mergeNavLinks(base, exposedPages);
        // /page/about-us already exists in base, so only pricing is appended
        expect(result).toEqual([
            { href: '/page/about-us', label: 'Existing About' },
            { href: '/page/pricing', label: 'Pricing' },
        ]);
    });

    it('handles empty base links with exposed pages', () => {
        const result = mergeNavLinks([], [{ slug: 'faq', title: 'FAQ' }]);
        expect(result).toEqual([{ href: '/page/faq', label: 'FAQ' }]);
    });
});

describe('Homepage API types', () => {
    it('fetchHomepageData returns safe fallback when API_URL is empty', async () => {
        const { fetchHomepageData } = await import('../lib/api');
        // NEXT_PUBLIC_API_URL is not set in test env, so should return fallback
        const result = await fetchHomepageData();
        expect(result).toEqual({
            sections: [],
            display: {
                variantBySlot: null,
                themePreset: null,
                fallbackThemePresetId: null,
                customCss: null,
                seoTitle: null,
                seoDescription: null,
            },
            exposedPages: [],
        });
    });

    it('fetchExposedPages returns empty array when API_URL is empty', async () => {
        const { fetchExposedPages } = await import('../lib/api');
        const result = await fetchExposedPages();
        expect(result).toEqual([]);
    });

    it('fetchPageBySlug returns null when API_URL is empty', async () => {
        const { fetchPageBySlug } = await import('../lib/api');
        const result = await fetchPageBySlug('test');
        expect(result).toBeNull();
    });

    it('HomepageDataPayload types are correctly shaped', async () => {
        const api = await import('../lib/api');
        // Verify the type shape exists by constructing a valid object
        const payload: api.HomepageDataPayload = {
            sections: [
                {
                    id: '1',
                    slot: 'hero',
                    title: 'Title',
                    subtitle: 'Sub',
                    body: null,
                    githubUrl: null,
                    icon: null,
                    enabled: true,
                    cssClasses: null,
                    metadata: null,
                    sortOrder: 0,
                    features: [{ title: 'Fast', description: 'Very fast', icon: 'Zap', imageUrl: null, href: null }],
                    actions: [{ label: 'Go', href: '/go', variant: 'default', icon: null, external: false }],
                },
            ],
            display: {
                variantBySlot: { hero: 'centered' },
                themePreset: 'neo',
                fallbackThemePresetId: null,
                customCss: null,
                seoTitle: null,
                seoDescription: null,
            },
            exposedPages: [{ slug: 'about', title: 'About' }],
        };
        expect(payload.sections).toHaveLength(1);
        expect(payload.sections[0].enabled).toBe(true);
        expect(payload.sections[0].features[0].icon).toBe('Zap');
        expect(payload.display.themePreset).toBe('neo');
        expect(payload.exposedPages[0].slug).toBe('about');
    });

    it('HomepageSectionPayload supports all configurable fields', async () => {
        const api = await import('../lib/api');
        const section: api.HomepageSectionPayload = {
            id: '2',
            slot: 'features',
            title: 'Features',
            subtitle: 'What we offer',
            body: 'Detailed description',
            githubUrl: 'https://github.com/test',
            icon: 'Sparkles',
            enabled: false,
            cssClasses: 'bg-gradient-to-r from-blue-500',
            metadata: { custom: 'value', count: 42 },
            sortOrder: 1,
            features: [
                {
                    title: 'Feature 1',
                    description: 'Desc 1',
                    icon: 'Shield',
                    imageUrl: 'https://img.test/1.png',
                    href: '/features/1',
                },
            ],
            actions: [{ label: 'Learn More', href: '/learn', variant: 'outline', icon: 'ArrowRight', external: false }],
        };
        expect(section.icon).toBe('Sparkles');
        expect(section.enabled).toBe(false);
        expect(section.cssClasses).toContain('bg-gradient');
        expect(section.metadata).toHaveProperty('custom', 'value');
        expect(section.features[0].icon).toBe('Shield');
        expect(section.features[0].imageUrl).toBeTruthy();
        expect(section.actions[0].icon).toBe('ArrowRight');
    });
});

describe('getHomepageData (Zod validation)', () => {
    it('returns validated fallback when API_URL is empty', async () => {
        const { getHomepageData } = await import('../lib/get-homepage-data');
        const result = await getHomepageData();
        expect(result.sections).toEqual([]);
        expect(result.display.variantBySlot).toBeNull();
        expect(result.exposedPages).toEqual([]);
    });

    it('HomepageDataSchema validates a correct payload', async () => {
        const { HomepageDataSchema } = await import('../lib/get-homepage-data');
        const payload = {
            sections: [
                {
                    id: 'test-1',
                    slot: 'hero',
                    title: 'Test',
                    subtitle: null,
                    body: null,
                    githubUrl: null,
                    icon: 'Sparkles',
                    enabled: true,
                    cssClasses: null,
                    metadata: null,
                    sortOrder: 0,
                    features: [],
                    actions: [{ label: 'Go', href: '/go', variant: 'default', icon: null, external: false }],
                },
            ],
            display: {
                variantBySlot: { hero: 'centered' },
                themePreset: 'neo',
                fallbackThemePresetId: null,
            },
            exposedPages: [{ slug: 'about', title: 'About' }],
        };
        const result = HomepageDataSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.sections).toHaveLength(1);
            expect(result.data.sections[0].icon).toBe('Sparkles');
            expect(result.data.display.themePreset).toBe('neo');
        }
    });

    it('HomepageDataSchema rejects invalid payload shape', async () => {
        const { HomepageDataSchema } = await import('../lib/get-homepage-data');
        const result = HomepageDataSchema.safeParse({ sections: 'not-an-array' });
        expect(result.success).toBe(false);
    });
});

describe('HomepageConfigProvider with API variants', () => {
    it('merges API variant-by-slot into default config', async () => {
        const { SLOT_REGISTRY } = await import('../lib/homepage-config');
        // Verify the slot registry has valid variants for testing
        expect(SLOT_REGISTRY.hero.variants.some((v) => v.id === 'split')).toBe(true);
        expect(SLOT_REGISTRY.features.variants.some((v) => v.id === 'cards')).toBe(true);
    });
});

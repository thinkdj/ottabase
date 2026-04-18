import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@ottabase/ottalayout', () => ({ DEFAULT_LAYOUT: {} }));

vi.mock('@ottabase/brand-engine', () => ({
    applyBrandTheme: vi.fn(),
    registerBuiltInThemes: vi.fn(),
    getThemeByName: vi.fn(() => ({ name: 'default', colors: {} })),
    resolveTheme: vi.fn(() => ({
        colors: { primary: '220 70% 50%' },
        typography: {
            heading: { fontFamily: 'Inter' },
            body: { fontFamily: 'Inter' },
            handwriting: { fontFamily: 'Caveat' },
        },
        radius: '0.5rem',
    })),
    BUILTIN_THEME_NAMES: ['default'],
    PRESET_MAP: {},
    buildCriticalCSS: vi.fn(() => ''),
}));

vi.mock('@ottabase/brand-engine-react', () => ({
    BrandProvider: ({ children }: any) => createElement('div', null, children),
    useBrand: vi.fn(() => ({ config: null })),
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

// ── Homepage config unit tests ─────────────────────────────────────────────

describe('Homepage Config', () => {
    let getDefaultConfig: any;
    let loadConfig: any;
    let saveConfig: any;
    let SLOT_NAMES: any;
    let SLOT_REGISTRY: any;
    let HOMEPAGE_CONFIG_KEY: any;

    beforeEach(async () => {
        localStorage.clear();
        ({ getDefaultConfig, loadConfig, saveConfig, SLOT_NAMES, SLOT_REGISTRY, HOMEPAGE_CONFIG_KEY } =
            await import('../lib/homepage-config'));
    });

    it('defines all 6 slot names', () => {
        expect(SLOT_NAMES).toEqual(['navbar', 'hero', 'features', 'cta', 'footer', 'about']);
    });

    it('each slot has at least 2 variants', () => {
        for (const slot of SLOT_NAMES) {
            expect(SLOT_REGISTRY[slot].variants.length).toBeGreaterThanOrEqual(2);
        }
    });

    it('each slot has a valid defaultVariant', () => {
        for (const slot of SLOT_NAMES) {
            const ids = SLOT_REGISTRY[slot].variants.map((v: any) => v.id);
            expect(ids).toContain(SLOT_REGISTRY[slot].defaultVariant);
        }
    });

    it('getDefaultConfig returns one key per slot', () => {
        const config = getDefaultConfig();
        for (const slot of SLOT_NAMES) {
            expect(config[slot]).toBe(SLOT_REGISTRY[slot].defaultVariant);
        }
    });

    it('loadConfig returns defaults when localStorage is empty', () => {
        const config = loadConfig();
        expect(config).toEqual(getDefaultConfig());
    });

    it('saveConfig persists to localStorage', () => {
        const config = getDefaultConfig();
        config.hero = 'split';
        saveConfig(config);
        expect(localStorage.getItem(HOMEPAGE_CONFIG_KEY)).toBe(JSON.stringify(config));
    });

    it('loadConfig reads persisted config', () => {
        const config = getDefaultConfig();
        config.hero = 'minimal';
        config.footer = 'columns';
        saveConfig(config);
        const loaded = loadConfig();
        expect(loaded.hero).toBe('minimal');
        expect(loaded.footer).toBe('columns');
    });

    it('loadConfig merges partial config with defaults', () => {
        // Only save one slot — all others should get defaults
        localStorage.setItem(HOMEPAGE_CONFIG_KEY, JSON.stringify({ hero: 'split' }));
        const loaded = loadConfig();
        expect(loaded.hero).toBe('split');
        expect(loaded.navbar).toBe(SLOT_REGISTRY.navbar.defaultVariant);
    });

    it('loadConfig handles corrupt JSON gracefully', () => {
        localStorage.setItem(HOMEPAGE_CONFIG_KEY, 'not-json');
        const loaded = loadConfig();
        expect(loaded).toEqual(getDefaultConfig());
    });

    it('loadConfig rejects invalid variant IDs and uses defaults', () => {
        // Store a config with an invalid variant ID (one that doesn't exist in SLOT_REGISTRY)
        localStorage.setItem(HOMEPAGE_CONFIG_KEY, JSON.stringify({ hero: 'invalid-variant', footer: 'columns' }));
        const loaded = loadConfig();
        // Invalid variant ID should be replaced with default
        expect(loaded.hero).toBe(SLOT_REGISTRY.hero.defaultVariant);
        // Valid variant ID should be kept
        expect(loaded.footer).toBe('columns');
    });
});

// ── SlotRenderer tests ─────────────────────────────────────────────────────

describe('SlotRenderer', () => {
    let SlotRenderer: any;
    let VARIANT_COMPONENTS: any;
    let HomepageConfigProvider: any;

    beforeEach(async () => {
        localStorage.clear();
        ({ SlotRenderer, VARIANT_COMPONENTS } = await import('../components/SlotRenderer'));
        ({ HomepageConfigProvider } = await import('../lib/homepage-config-context'));
    });

    it('has variant components for every slot', async () => {
        const { SLOT_NAMES } = await import('../lib/homepage-config');
        for (const slot of SLOT_NAMES) {
            expect(VARIANT_COMPONENTS[slot]).toBeDefined();
            expect(Object.keys(VARIANT_COMPONENTS[slot]).length).toBeGreaterThanOrEqual(2);
        }
    });

    it('renders the default hero variant', () => {
        render(
            <HomepageConfigProvider>
                <SlotRenderer slot="hero" data={{ title: 'Test Hero' }} />
            </HomepageConfigProvider>,
        );
        expect(screen.getByText('Test Hero')).toBeDefined();
    });

    it('renders the default features variant', () => {
        render(
            <HomepageConfigProvider>
                <SlotRenderer slot="features" data={{ features: [{ title: 'Feature One', description: 'Desc' }] }} />
            </HomepageConfigProvider>,
        );
        expect(screen.getByText('Feature One')).toBeDefined();
    });

    it('renders the default CTA variant', () => {
        render(
            <HomepageConfigProvider>
                <SlotRenderer slot="cta" data={{ title: 'CTA Title', actions: [] }} />
            </HomepageConfigProvider>,
        );
        expect(screen.getByText('CTA Title')).toBeDefined();
    });

    it('renders the default footer variant', () => {
        render(
            <HomepageConfigProvider>
                <SlotRenderer slot="footer" data={{ siteName: 'TestSite' }} />
            </HomepageConfigProvider>,
        );
        expect(screen.getByText(/TestSite/)).toBeDefined();
    });

    it('renders the default navbar variant', () => {
        render(
            <HomepageConfigProvider>
                <SlotRenderer slot="navbar" data={{ title: 'NavTest' }} />
            </HomepageConfigProvider>,
        );
        expect(screen.getByText('NavTest')).toBeDefined();
    });
});

// ── Hero variant rendering tests ───────────────────────────────────────────

describe('Hero Variants', () => {
    let HeroCentered: any;
    let HeroSplit: any;
    let HeroMinimal: any;

    beforeEach(async () => {
        ({ HeroCentered } = await import('../components/variants/hero/HeroCentered'));
        ({ HeroSplit } = await import('../components/variants/hero/HeroSplit'));
        ({ HeroMinimal } = await import('../components/variants/hero/HeroMinimal'));
    });

    it('HeroCentered renders title and subtitle', () => {
        render(<HeroCentered title="Centered Title" subtitle="Centered Sub" />);
        expect(screen.getByText('Centered Title')).toBeDefined();
        expect(screen.getByText('Centered Sub')).toBeDefined();
    });

    it('HeroSplit renders title and subtitle', () => {
        render(<HeroSplit title="Split Title" subtitle="Split Sub" />);
        expect(screen.getByText('Split Title')).toBeDefined();
        expect(screen.getByText('Split Sub')).toBeDefined();
    });

    it('HeroMinimal renders title', () => {
        render(<HeroMinimal title="Minimal Title" />);
        expect(screen.getByText('Minimal Title')).toBeDefined();
    });

    it('HeroCentered renders action buttons', () => {
        render(<HeroCentered title="T" actions={[{ href: '/a', label: 'Click Me' }]} />);
        expect(screen.getByText('Click Me')).toBeDefined();
    });
});

// ── Features variant rendering tests ───────────────────────────────────────

describe('Features Variants', () => {
    let FeaturesGrid: any;
    let FeaturesCards: any;
    let FeaturesList: any;

    const features = [
        { title: 'Fast', description: 'Blazing fast' },
        { title: 'Secure', description: 'Rock solid' },
    ];

    beforeEach(async () => {
        ({ FeaturesGrid } = await import('../components/variants/features/FeaturesGrid'));
        ({ FeaturesCards } = await import('../components/variants/features/FeaturesCards'));
        ({ FeaturesList } = await import('../components/variants/features/FeaturesList'));
    });

    it('FeaturesGrid renders features', () => {
        render(<FeaturesGrid features={features} />);
        expect(screen.getByText('Fast')).toBeDefined();
        expect(screen.getByText('Secure')).toBeDefined();
    });

    it('FeaturesCards renders features', () => {
        render(<FeaturesCards features={features} />);
        expect(screen.getByText('Fast')).toBeDefined();
        expect(screen.getByText('Secure')).toBeDefined();
    });

    it('FeaturesList renders features', () => {
        render(<FeaturesList features={features} />);
        expect(screen.getByText('Fast')).toBeDefined();
        expect(screen.getByText('Secure')).toBeDefined();
    });

    it('FeaturesGrid renders optional title', () => {
        render(<FeaturesGrid title="Our Features" features={features} />);
        expect(screen.getByText('Our Features')).toBeDefined();
    });
});

// ── CTA variant rendering tests ────────────────────────────────────────────

describe('CTA Variants', () => {
    let CTADefault: any;
    let CTABanner: any;
    let CTAMinimal: any;

    beforeEach(async () => {
        ({ CTADefault } = await import('../components/variants/cta/CTADefault'));
        ({ CTABanner } = await import('../components/variants/cta/CTABanner'));
        ({ CTAMinimal } = await import('../components/variants/cta/CTAMinimal'));
    });

    it('CTADefault renders title and description', () => {
        render(<CTADefault title="Get Started" description="Now." actions={[]} />);
        expect(screen.getByText('Get Started')).toBeDefined();
        expect(screen.getByText('Now.')).toBeDefined();
    });

    it('CTABanner renders title', () => {
        render(<CTABanner title="Banner CTA" actions={[]} />);
        expect(screen.getByText('Banner CTA')).toBeDefined();
    });

    it('CTAMinimal renders title', () => {
        render(<CTAMinimal title="Minimal CTA" actions={[]} />);
        expect(screen.getByText('Minimal CTA')).toBeDefined();
    });
});

// ── Footer variant rendering tests ─────────────────────────────────────────

describe('Footer Variants', () => {
    let FooterDefault: any;
    let FooterMinimal: any;
    let FooterColumns: any;

    beforeEach(async () => {
        ({ FooterDefault } = await import('../components/variants/footer/FooterDefault'));
        ({ FooterMinimal } = await import('../components/variants/footer/FooterMinimal'));
        ({ FooterColumns } = await import('../components/variants/footer/FooterColumns'));
    });

    it('FooterDefault renders site name', () => {
        render(<FooterDefault siteName="Acme" />);
        expect(screen.getByText(/Acme/)).toBeDefined();
    });

    it('FooterMinimal renders copyright', () => {
        render(<FooterMinimal siteName="Acme" />);
        expect(screen.getByText(/Acme/)).toBeDefined();
    });

    it('FooterColumns renders site name and links', () => {
        const links = [
            { href: '/about', label: 'About' },
            { href: '/docs', label: 'Docs' },
        ];
        render(<FooterColumns siteName="Acme" links={links} />);
        expect(screen.getByText('Acme')).toBeDefined();
        expect(screen.getByText('About')).toBeDefined();
        expect(screen.getByText('Docs')).toBeDefined();
    });
});

// ── Navbar variant rendering tests ─────────────────────────────────────────

describe('Navbar Variants', () => {
    let NavbarDefault: any;
    let NavbarCentered: any;
    let NavbarMinimal: any;

    beforeEach(async () => {
        ({ NavbarDefault } = await import('../components/variants/navbar/NavbarDefault'));
        ({ NavbarCentered } = await import('../components/variants/navbar/NavbarCentered'));
        ({ NavbarMinimal } = await import('../components/variants/navbar/NavbarMinimal'));
    });

    it('NavbarDefault renders title and links', () => {
        render(<NavbarDefault title="MySite" />);
        expect(screen.getByText('MySite')).toBeDefined();
        // Default links should be present
        expect(screen.getByText('Home')).toBeDefined();
    });

    it('NavbarCentered renders title', () => {
        render(<NavbarCentered title="CenteredSite" />);
        expect(screen.getByText('CenteredSite')).toBeDefined();
    });

    it('NavbarMinimal renders title and dark mode toggle', () => {
        render(<NavbarMinimal title="MinSite" />);
        expect(screen.getByText('MinSite')).toBeDefined();
        expect(screen.getByTestId('dark-mode-toggle')).toBeDefined();
    });

    it('NavbarDefault toggles mobile menu', () => {
        render(<NavbarDefault title="Test" />);
        const toggle = screen.getByLabelText('Toggle menu');
        fireEvent.click(toggle);
        // After opening mobile menu, links appear in both desktop and mobile sections
        const homeLinks = screen.getAllByText('Home');
        expect(homeLinks.length).toBeGreaterThanOrEqual(2);
    });
    it('NavbarDefault shows GitHub icon and external-link icon', () => {
        render(<NavbarDefault title="Test" githubUrl="https://github.com/test" />);
        // The GitHub button should be present (hidden on mobile, but in DOM)
        const githubLink = screen.getAllByTitle('Open on GitHub (new tab)');
        expect(githubLink.length).toBeGreaterThanOrEqual(1);
    });

    it('NavbarCentered shows GitHub icon and external-link icon', () => {
        render(<NavbarCentered title="Test" githubUrl="https://github.com/test" />);
        const githubLink = screen.getAllByTitle('Open on GitHub (new tab)');
        expect(githubLink.length).toBeGreaterThanOrEqual(1);
    });
});

// ── About variant rendering tests ──────────────────────────────────────────

describe('About Variants', () => {
    let AboutDefault: any;
    let AboutMinimal: any;
    let AboutDetailed: any;

    beforeEach(async () => {
        ({ AboutDefault } = await import('../components/variants/about/AboutDefault'));
        ({ AboutMinimal } = await import('../components/variants/about/AboutMinimal'));
        ({ AboutDetailed } = await import('../components/variants/about/AboutDetailed'));
    });

    it('AboutDefault renders title and content', () => {
        render(<AboutDefault />);
        expect(screen.getByText(/About/)).toBeDefined();
        expect(screen.getByText(/What is this/)).toBeDefined();
    });

    it('AboutMinimal renders title', () => {
        render(<AboutMinimal />);
        expect(screen.getByText(/About/)).toBeDefined();
    });

    it('AboutDetailed renders feature cards and tech stack', () => {
        render(<AboutDetailed />);
        expect(screen.getByText(/About/)).toBeDefined();
        expect(screen.getByText('Tech Stack')).toBeDefined();
        expect(screen.getByText('Edge-First')).toBeDefined();
    });

    it('AboutDefault accepts custom githubUrl', () => {
        render(<AboutDefault githubUrl="https://github.com/custom/repo" />);
        const githubLinks = screen.getAllByText(/View on GitHub/);
        expect(githubLinks.length).toBeGreaterThanOrEqual(1);
    });

    it('SlotRenderer renders the default about variant', async () => {
        const { HomepageConfigProvider } = await import('../lib/homepage-config-context');
        const { SlotRenderer } = await import('../components/SlotRenderer');
        render(
            <HomepageConfigProvider>
                <SlotRenderer slot="about" data={{}} />
            </HomepageConfigProvider>,
        );
        expect(screen.getByText(/About/)).toBeDefined();
    });
});

describe('HomepageConfigPage', () => {
    let HomepageConfigPage: any;
    let HomepageConfigProvider: any;

    beforeEach(async () => {
        localStorage.clear();
        ({ default: HomepageConfigPage } = await import('../app/homepage-config/page'));
        ({ HomepageConfigProvider } = await import('../lib/homepage-config-context'));
    });

    it('renders the config page heading', () => {
        render(
            <HomepageConfigProvider>
                <HomepageConfigPage />
            </HomepageConfigProvider>,
        );
        expect(screen.getByText('Homepage Config')).toBeDefined();
    });

    it('renders a section for each slot', async () => {
        const { SLOT_REGISTRY } = await import('../lib/homepage-config');
        render(
            <HomepageConfigProvider>
                <HomepageConfigPage />
            </HomepageConfigProvider>,
        );
        for (const slot of Object.values(SLOT_REGISTRY) as any[]) {
            // Label appears both in h2 and in description span, so use getAllByText
            const matches = screen.getAllByText(slot.label);
            expect(matches.length).toBeGreaterThanOrEqual(1);
        }
    });

    it('renders variant buttons for each slot', async () => {
        const { SLOT_REGISTRY } = await import('../lib/homepage-config');
        render(
            <HomepageConfigProvider>
                <HomepageConfigPage />
            </HomepageConfigProvider>,
        );
        for (const slot of Object.values(SLOT_REGISTRY) as any[]) {
            for (const variant of slot.variants) {
                // Labels like "Default" and "Minimal" appear in multiple slots, so use getAllByText
                const matches = screen.getAllByText(variant.label);
                expect(matches.length).toBeGreaterThanOrEqual(1);
            }
        }
    });

    it('clicking a variant updates selection', () => {
        render(
            <HomepageConfigProvider>
                <HomepageConfigPage />
            </HomepageConfigProvider>,
        );
        // Click the "Split" hero variant
        fireEvent.click(screen.getByText('Split'));
        // The "Split" button should now show "Active"
        const splitButton = screen.getByText('Split').closest('button');
        expect(splitButton?.className).toContain('border-primary');
    });

    it('reset button restores defaults', async () => {
        const { HOMEPAGE_CONFIG_KEY, getDefaultConfig } = await import('../lib/homepage-config');
        // Pre-set a non-default config
        localStorage.setItem(HOMEPAGE_CONFIG_KEY, JSON.stringify({ hero: 'split' }));
        render(
            <HomepageConfigProvider>
                <HomepageConfigPage />
            </HomepageConfigProvider>,
        );
        fireEvent.click(screen.getByText('Reset to defaults'));
        const stored = JSON.parse(localStorage.getItem(HOMEPAGE_CONFIG_KEY)!);
        expect(stored).toEqual(getDefaultConfig());
    });
});

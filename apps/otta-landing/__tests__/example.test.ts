import { describe, expect, it, vi } from 'vitest';

// Mock transitive deps that Vite cannot resolve in test environment
vi.mock('@ottabase/ottalayout', () => ({ DEFAULT_LAYOUT: {} }));
vi.mock('@ottabase/brand-engine', () => ({
    registerBuiltInThemes: vi.fn(),
    getThemeByName: vi.fn(() => ({ name: 'artisan', colors: {} })),
    resolveTheme: vi.fn(() => ({
        colors: { primary: '30 80% 50%' },
        typography: {
            heading: { fontFamily: 'Outfit', url: '' },
            body: { fontFamily: 'Inter', url: '' },
            handwriting: { fontFamily: 'Great Vibes', url: '' },
        },
        radius: '0.5rem',
    })),
    buildCriticalCSS: vi.fn(() => ''),
    BUILTIN_THEME_NAMES: ['default', 'neo', 'crisp', 'funky', 'artisan', 'midnight', 'rose', 'verdant'],
    PRESET_MAP: {},
    applyBrandTheme: vi.fn(),
}));
vi.mock('@ottabase/brand-engine-react', () => ({
    BrandProvider: ({ children }: any) => children,
    useBrand: () => ({ config: null }),
}));

describe('Brand Configuration', () => {
    it('exports a valid theme preset', async () => {
        const { themePreset } = await import('../config/brand.config');
        const valid = ['default', 'neo', 'crisp', 'funky', 'artisan', 'midnight', 'rose', 'verdant'];
        expect(valid).toContain(themePreset);
    });

    it('exports brandConfig as an object', async () => {
        const { brandConfig } = await import('../config/brand.config');
        expect(brandConfig).toBeDefined();
        expect(typeof brandConfig).toBe('object');
    });
});

describe('App Metadata', () => {
    it('defines title and description', async () => {
        const { metadata } = await import('../app/layout');
        expect(metadata).toBeDefined();
        expect(metadata.title).toBeDefined();
        expect(metadata.description).toBeDefined();
    });
});

describe('ThemePresetSwitcher storage key', () => {
    it('uses the correct localStorage key', async () => {
        const { THEME_STORAGE_KEY } = await import('../components/ThemePresetSwitcher');
        expect(THEME_STORAGE_KEY).toBe('ottabase.homepage.theme-preset');
    });
});

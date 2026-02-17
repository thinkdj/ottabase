import { defineConfig } from 'tsup';

const entries: Record<string, string> = {
    // Barrel exports
    index: 'src/index.ts',
    types: 'src/types.ts',
    // Internal lib (needed so relative dist imports resolve)
    'lib/utils': 'src/lib/utils.ts',
    // Atlas barrel
    'atlas/index': 'src/atlas/index.ts',
    // Atlas components
    'atlas/HeroSection': 'src/atlas/HeroSection.tsx',
    'atlas/FeaturesGrid': 'src/atlas/FeaturesGrid.tsx',
    'atlas/PricingTable': 'src/atlas/PricingTable.tsx',
    'atlas/TestimonialsCarousel': 'src/atlas/TestimonialsCarousel.tsx',
    'atlas/FAQAccordion': 'src/atlas/FAQAccordion.tsx',
    'atlas/LogoCloud': 'src/atlas/LogoCloud.tsx',
    'atlas/CTABanner': 'src/atlas/CTABanner.tsx',
    'atlas/FooterMarketing': 'src/atlas/FooterMarketing.tsx',
    'atlas/Navbar': 'src/atlas/Navbar.tsx',
    'atlas/StatsSection': 'src/atlas/StatsSection.tsx',
    'atlas/StepsSection': 'src/atlas/StepsSection.tsx',
    // Mono barrel
    'mono/index': 'src/mono/index.ts',
    // Mono components
    'mono/HeroSection': 'src/mono/HeroSection.tsx',
    'mono/FeaturesGrid': 'src/mono/FeaturesGrid.tsx',
    'mono/PricingTable': 'src/mono/PricingTable.tsx',
    'mono/TestimonialsCarousel': 'src/mono/TestimonialsCarousel.tsx',
    'mono/FAQAccordion': 'src/mono/FAQAccordion.tsx',
    'mono/LogoCloud': 'src/mono/LogoCloud.tsx',
    'mono/CTABanner': 'src/mono/CTABanner.tsx',
    'mono/FooterMarketing': 'src/mono/FooterMarketing.tsx',
    'mono/Navbar': 'src/mono/Navbar.tsx',
    'mono/StatsSection': 'src/mono/StatsSection.tsx',
    'mono/StepsSection': 'src/mono/StepsSection.tsx',
};

export default defineConfig({
    entry: entries,
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    bundle: false,
    splitting: false,
    external: ['react', 'react-dom'],
});

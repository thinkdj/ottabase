import {
    AtlasCTABanner,
    AtlasFAQAccordion,
    AtlasFeaturesGrid,
    AtlasFooterMarketing,
    AtlasHeroSection,
    AtlasLogoCloud,
    AtlasNavbar,
    AtlasPricingTable,
    AtlasStatsSection,
    AtlasStepsSection,
    AtlasTestimonialsCarousel,
} from '@ottabase/ui-marketing/atlas';

import {
    demoCtaBanner,
    demoFaq,
    demoFeatures,
    demoFooter,
    demoHero,
    demoLogoCloud,
    demoNavbar,
    demoPricing,
    demoStats,
    demoSteps,
    demoTestimonials,
} from '@/lib/marketing-demo-data';

export default function HomePage() {
    return (
        <>
            <AtlasNavbar {...demoNavbar} />
            <main className="flex min-h-screen flex-col bg-background text-foreground">
                <AtlasHeroSection {...demoHero} />
                <AtlasLogoCloud {...demoLogoCloud} />
                <AtlasFeaturesGrid {...demoFeatures} />
                <AtlasStatsSection {...demoStats} />
                <AtlasStepsSection {...demoSteps} />
                <AtlasTestimonialsCarousel {...demoTestimonials} />
                <AtlasPricingTable {...demoPricing} />
                <AtlasFAQAccordion {...demoFaq} />
                <AtlasCTABanner {...demoCtaBanner} />
                <AtlasFooterMarketing {...demoFooter} />
            </main>
        </>
    );
}

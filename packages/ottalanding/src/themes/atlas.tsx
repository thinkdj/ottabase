/**
 * @ottabase/ottalanding — Atlas Theme
 *
 * Wraps @ottabase/ui-marketing/atlas components as an ottalanding theme.
 * Maps serializable content types → Atlas component props.
 */

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
import type {
    CTAContent,
    FAQContent,
    FeaturesContent,
    HeroContent,
    LogoCloudContent,
    PricingContent,
    SiteContent,
    StatsContent,
    StepsContent,
    TestimonialsContent,
} from '../types';
import type { LandingTheme, SectionProps } from './types';

// ─── Section adapters ────────────────────────────────────────────────────────

function AtlasHero({ content, className }: SectionProps<HeroContent>) {
    return <AtlasHeroSection {...content} className={className} />;
}

function AtlasFeatures({ content, className }: SectionProps<FeaturesContent>) {
    return <AtlasFeaturesGrid {...content} className={className} />;
}

function AtlasPricing({ content, className }: SectionProps<PricingContent>) {
    return <AtlasPricingTable {...content} className={className} />;
}

function AtlasTestimonials({ content, className }: SectionProps<TestimonialsContent>) {
    return <AtlasTestimonialsCarousel {...content} className={className} />;
}

function AtlasFaq({ content, className }: SectionProps<FAQContent>) {
    return <AtlasFAQAccordion {...content} className={className} />;
}

function AtlasLogos({ content, className }: SectionProps<LogoCloudContent>) {
    return <AtlasLogoCloud {...content} className={className} />;
}

function AtlasCta({ content, className }: SectionProps<CTAContent>) {
    return <AtlasCTABanner {...content} className={className} />;
}

function AtlasStats({ content, className }: SectionProps<StatsContent>) {
    return <AtlasStatsSection {...content} className={className} />;
}

function AtlasSteps({ content, className }: SectionProps<StepsContent>) {
    return <AtlasStepsSection {...content} className={className} />;
}

// ─── Layout adapters ─────────────────────────────────────────────────────────

function AtlasNavbarAdapter({ site, className }: { site: SiteContent; className?: string }) {
    return (
        <AtlasNavbar
            brand={{ name: site.name, href: '/' }}
            links={site.navLinks}
            cta={site.navCta}
            className={className}
        />
    );
}

function AtlasFooterAdapter({ site, className }: { site: SiteContent; className?: string }) {
    return (
        <AtlasFooterMarketing
            brand={{ name: site.name, description: site.tagline }}
            sections={site.footerSections}
            social={site.socialLinks}
            legal={site.legal}
            className={className}
        />
    );
}

// ─── Theme definition ────────────────────────────────────────────────────────

export const atlasTheme: LandingTheme = {
    metadata: {
        id: 'atlas',
        name: 'Atlas',
        description: 'Clean, systematic Notion/Atlassian aesthetic — card-heavy, rounded corners, backdrop blur navbar',
        version: '1.0.0',
        tags: ['clean', 'systematic', 'cards', 'corporate'],
    },
    sections: {
        hero: AtlasHero,
        features: AtlasFeatures,
        pricing: AtlasPricing,
        testimonials: AtlasTestimonials,
        faq: AtlasFaq,
        'logo-cloud': AtlasLogos,
        cta: AtlasCta,
        stats: AtlasStats,
        steps: AtlasSteps,
    },
    navbar: AtlasNavbarAdapter,
    footer: AtlasFooterAdapter,
};

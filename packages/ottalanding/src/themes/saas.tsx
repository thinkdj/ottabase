/**
 * @ottabase/ottalanding — SaaS Theme
 *
 * Wraps @ottabase/ui-marketing/saas components as an ottalanding theme.
 * Maps serializable content types -> SaaS component props.
 */

import {
    SaaSAboutSection,
    SaaSCTABanner,
    SaaSContactSection,
    SaaSFAQAccordion,
    SaaSFeatureHighlight,
    SaaSFeaturesGrid,
    SaaSFooterMarketing,
    SaaSHeroSection,
    SaaSLogoCloud,
    SaaSNavbar,
    SaaSPricingTable,
    SaaSStatsSection,
    SaaSStepsSection,
    SaaSTestimonialsCarousel,
    SaaSTimelineSection,
} from '@ottabase/ui-marketing/saas';
import type {
    AboutContent,
    CTAContent,
    ContactContent,
    FAQContent,
    FeatureHighlightContent,
    FeaturesContent,
    HeroContent,
    LogoCloudContent,
    PricingContent,
    SiteContent,
    StatsContent,
    StepsContent,
    TestimonialsContent,
    TimelineContent,
} from '../types';
import type { LandingTheme, SectionProps } from './types';

// ─── Section adapters ────────────────────────────────────────────────────────

function SaaSHero({ content, className }: SectionProps<HeroContent>) {
    return <SaaSHeroSection {...content} className={className} />;
}

function SaaSFeatures({ content, className }: SectionProps<FeaturesContent>) {
    return <SaaSFeaturesGrid {...content} className={className} />;
}

function SaaSPricing({ content, className }: SectionProps<PricingContent>) {
    return <SaaSPricingTable {...content} className={className} />;
}

function SaaSTestimonials({ content, className }: SectionProps<TestimonialsContent>) {
    return <SaaSTestimonialsCarousel {...content} className={className} />;
}

function SaaSFaq({ content, className }: SectionProps<FAQContent>) {
    return <SaaSFAQAccordion {...content} className={className} />;
}

function SaaSLogos({ content, className }: SectionProps<LogoCloudContent>) {
    return <SaaSLogoCloud {...content} className={className} />;
}

function SaaSCta({ content, className }: SectionProps<CTAContent>) {
    return <SaaSCTABanner {...content} className={className} />;
}

function SaaSStats({ content, className }: SectionProps<StatsContent>) {
    return <SaaSStatsSection {...content} className={className} />;
}

function SaaSSteps({ content, className }: SectionProps<StepsContent>) {
    return <SaaSStepsSection {...content} className={className} />;
}

function SaaSFeatureHL({ content, className }: SectionProps<FeatureHighlightContent>) {
    return <SaaSFeatureHighlight {...content} className={className} />;
}

function SaaSAbout({ content, className }: SectionProps<AboutContent>) {
    return <SaaSAboutSection {...content} className={className} />;
}

function SaaSContact({ content, className }: SectionProps<ContactContent>) {
    return <SaaSContactSection {...content} className={className} />;
}

function SaaSTimeline({ content, className }: SectionProps<TimelineContent>) {
    return <SaaSTimelineSection {...content} className={className} />;
}

// ─── Layout adapters ─────────────────────────────────────────────────────────

function SaaSNavbarAdapter({ site, className }: { site: SiteContent; className?: string }) {
    return (
        <SaaSNavbar
            brand={{ name: site.name, href: '/' }}
            links={site.navLinks}
            cta={site.navCta}
            className={className}
        />
    );
}

function SaaSFooterAdapter({ site, className }: { site: SiteContent; className?: string }) {
    return (
        <SaaSFooterMarketing
            brand={{ name: site.name, description: site.tagline }}
            sections={site.footerSections}
            social={site.socialLinks}
            legal={site.legal}
            className={className}
        />
    );
}

// ─── Theme definition ────────────────────────────────────────────────────────

export const saasTheme: LandingTheme = {
    metadata: {
        id: 'saas',
        name: 'SaaS',
        description: 'Modern, airy SaaS design — pill buttons, soft shadows, generous spacing',
        version: '1.0.0',
        tags: ['modern', 'saas', 'soft', 'airy'],
    },
    sections: {
        hero: SaaSHero,
        features: SaaSFeatures,
        pricing: SaaSPricing,
        testimonials: SaaSTestimonials,
        faq: SaaSFaq,
        'logo-cloud': SaaSLogos,
        cta: SaaSCta,
        stats: SaaSStats,
        steps: SaaSSteps,
        'feature-highlight': SaaSFeatureHL,
        about: SaaSAbout,
        contact: SaaSContact,
        timeline: SaaSTimeline,
    },
    navbar: SaaSNavbarAdapter,
    footer: SaaSFooterAdapter,
};

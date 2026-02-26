/**
 * @ottabase/ottalanding — Mono Theme
 *
 * Wraps @ottabase/ui-marketing/mono components as an ottalanding theme.
 * Maps serializable content types → Mono component props.
 */

import {
    MonoAboutSection,
    MonoCTABanner,
    MonoContactSection,
    MonoFAQAccordion,
    MonoFeatureHighlight,
    MonoFeaturesGrid,
    MonoFooterMarketing,
    MonoHeroSection,
    MonoLogoCloud,
    MonoNavbar,
    MonoPricingTable,
    MonoStatsSection,
    MonoStepsSection,
    MonoTestimonialsCarousel,
    MonoTimelineSection,
} from '@ottabase/ui-marketing/mono';
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

function MonoHero({ content, className }: SectionProps<HeroContent>) {
    return <MonoHeroSection {...content} className={className} />;
}

function MonoFeatures({ content, className }: SectionProps<FeaturesContent>) {
    return <MonoFeaturesGrid {...content} className={className} />;
}

function MonoPricing({ content, className }: SectionProps<PricingContent>) {
    return <MonoPricingTable {...content} className={className} />;
}

function MonoTestimonials({ content, className }: SectionProps<TestimonialsContent>) {
    return <MonoTestimonialsCarousel {...content} className={className} />;
}

function MonoFaq({ content, className }: SectionProps<FAQContent>) {
    return <MonoFAQAccordion {...content} className={className} />;
}

function MonoLogos({ content, className }: SectionProps<LogoCloudContent>) {
    return <MonoLogoCloud {...content} className={className} />;
}

function MonoCta({ content, className }: SectionProps<CTAContent>) {
    return <MonoCTABanner {...content} className={className} />;
}

function MonoStats({ content, className }: SectionProps<StatsContent>) {
    return <MonoStatsSection {...content} className={className} />;
}

function MonoSteps({ content, className }: SectionProps<StepsContent>) {
    return <MonoStepsSection {...content} className={className} />;
}

function MonoFeatureHL({ content, className }: SectionProps<FeatureHighlightContent>) {
    return <MonoFeatureHighlight {...content} className={className} />;
}

function MonoAbout({ content, className }: SectionProps<AboutContent>) {
    return <MonoAboutSection {...content} className={className} />;
}

function MonoContact({ content, className }: SectionProps<ContactContent>) {
    return <MonoContactSection {...content} className={className} />;
}

function MonoTimeline({ content, className }: SectionProps<TimelineContent>) {
    return <MonoTimelineSection {...content} className={className} />;
}

// ─── Layout adapters ─────────────────────────────────────────────────────────

function MonoNavbarAdapter({ site, className }: { site: SiteContent; className?: string }) {
    return (
        <MonoNavbar
            brand={{ name: site.name, href: '/' }}
            links={site.navLinks}
            cta={site.navCta}
            className={className}
        />
    );
}

function MonoFooterAdapter({ site, className }: { site: SiteContent; className?: string }) {
    return (
        <MonoFooterMarketing
            brand={{ name: site.name, description: site.tagline }}
            sections={site.footerSections}
            social={site.socialLinks}
            legal={site.legal}
            className={className}
        />
    );
}

// ─── Theme definition ────────────────────────────────────────────────────────

export const monoTheme: LandingTheme = {
    metadata: {
        id: 'mono',
        name: 'Mono',
        description: 'Typography-first, flat design — sharp edges, monospace accents, high contrast',
        version: '1.0.0',
        tags: ['minimal', 'typography', 'monospace', 'bold'],
    },
    sections: {
        hero: MonoHero,
        features: MonoFeatures,
        pricing: MonoPricing,
        testimonials: MonoTestimonials,
        faq: MonoFaq,
        'logo-cloud': MonoLogos,
        cta: MonoCta,
        stats: MonoStats,
        steps: MonoSteps,
        'feature-highlight': MonoFeatureHL,
        about: MonoAbout,
        contact: MonoContact,
        timeline: MonoTimeline,
    },
    navbar: MonoNavbarAdapter,
    footer: MonoFooterAdapter,
};

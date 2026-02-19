/**
 * @ottabase/ottalanding — Theme System Types
 *
 * A theme is a visual layer over structured content.
 * It provides a React component for each section type,
 * plus navbar and footer components.
 *
 * To add a new theme:
 * 1. Create an object satisfying LandingTheme
 * 2. Call registerLandingTheme(yourTheme)
 *
 * That's it. The renderer picks the active theme and
 * maps section content → theme components automatically.
 */

import type { ComponentType } from 'react';
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

// ─── Theme metadata ──────────────────────────────────────────────────────────

export interface LandingThemeMetadata {
    /** Unique theme identifier (e.g. "atlas", "mono", "starter") */
    id: string;
    /** Human-readable name */
    name: string;
    /** Short description */
    description?: string;
    /** Version string */
    version?: string;
    /** Author name */
    author?: string;
    /** Screenshot URL (for theme picker UI) */
    screenshot?: string;
    /** Tags for filtering (e.g. "minimal", "bold", "corporate") */
    tags?: string[];
}

// ─── Section component props ─────────────────────────────────────────────────
// Each section component receives its typed content + an optional className.

export interface SectionProps<T> {
    content: T;
    className?: string;
}

// ─── Theme section components ────────────────────────────────────────────────
// A theme must provide a component for each section type.

export interface LandingThemeSections {
    hero: ComponentType<SectionProps<HeroContent>>;
    features: ComponentType<SectionProps<FeaturesContent>>;
    pricing: ComponentType<SectionProps<PricingContent>>;
    testimonials: ComponentType<SectionProps<TestimonialsContent>>;
    faq: ComponentType<SectionProps<FAQContent>>;
    'logo-cloud': ComponentType<SectionProps<LogoCloudContent>>;
    cta: ComponentType<SectionProps<CTAContent>>;
    stats: ComponentType<SectionProps<StatsContent>>;
    steps: ComponentType<SectionProps<StepsContent>>;
    'feature-highlight': ComponentType<SectionProps<FeatureHighlightContent>>;
    about: ComponentType<SectionProps<AboutContent>>;
    contact: ComponentType<SectionProps<ContactContent>>;
    timeline: ComponentType<SectionProps<TimelineContent>>;
}

// ─── Layout components ───────────────────────────────────────────────────────
// Navbar and footer live outside sections — they wrap the page.

export interface NavbarComponentProps {
    site: SiteContent;
    className?: string;
}

export interface FooterComponentProps {
    site: SiteContent;
    className?: string;
}

// ─── Complete theme definition ───────────────────────────────────────────────

export interface LandingTheme {
    /** Theme metadata */
    metadata: LandingThemeMetadata;
    /** Section renderers — one component per section type */
    sections: LandingThemeSections;
    /** Navbar component */
    navbar: ComponentType<NavbarComponentProps>;
    /** Footer component */
    footer: ComponentType<FooterComponentProps>;
}

// ─── Theme registry interface ────────────────────────────────────────────────

export interface LandingThemeRegistry {
    register(theme: LandingTheme): void;
    get(id: string): LandingTheme | null;
    getAll(): LandingTheme[];
    setActive(id: string): boolean;
    getActive(): LandingTheme | null;
    has(id: string): boolean;
}

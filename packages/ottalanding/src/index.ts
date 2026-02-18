/**
 * @ottabase/ottalanding
 *
 * Semantic landing page layer for Ottabase.
 *
 * Content is structured and strongly typed — every landing page is made of
 * well-defined sections (hero, features, pricing, testimonials, …) stored
 * in the database via OttaORM models.
 *
 * Themes are visual layers that render this content. Swap themes like
 * WordPress — the data stays the same, only the look changes.
 *
 * @example
 * ```typescript
 * import {
 *   // Content types (semantic layer)
 *   type SiteContent,
 *   type PageContent,
 *   type HeroContent,
 *   type FeaturesContent,
 *   SECTION_TYPES,
 *   DEFAULT_NAV_LINKS,
 *
 *   // Theme system
 *   registerLandingTheme,
 *   setActiveLandingTheme,
 *   getActiveLandingTheme,
 *   renderPage,
 *   type LandingTheme,
 *
 *   // OttaORM models (DB persistence)
 *   LandingSite,
 *   LandingPage,
 *   LandingSection,
 *   LandingTheme as LandingThemeModel,
 *
 *   // Init
 *   initOttaLanding,
 * } from '@ottabase/ottalanding';
 * ```
 */

// ─── Content types (the semantic layer) ──────────────────────────────────────
export type {
    CTAContent,
    FAQContent,
    FAQItemContent,
    FeatureItem,
    FeaturesContent,
    FooterSectionContent,
    HeroContent,
    ImageItem,
    LandingSiteData,
    LinkItem,
    LogoCloudContent,
    LogoItemContent,
    PageContent,
    PageSection,
    PricingContent,
    PricingFeatureItem,
    PricingPlanItem,
    SectionContentMap,
    SectionType,
    SiteContent,
    SocialLinkContent,
    StatItemContent,
    StatsContent,
    StepItemContent,
    StepsContent,
    TestimonialItem,
    TestimonialsContent,
} from './types';

export { DEFAULT_HOME_SECTIONS, DEFAULT_NAV_LINKS, SECTION_TYPES } from './types';

// ─── Theme system ────────────────────────────────────────────────────────────
export type {
    FooterComponentProps,
    LandingTheme as LandingThemeDefinition,
    LandingThemeMetadata,
    LandingThemeRegistry,
    LandingThemeSections,
    NavbarComponentProps,
    SectionProps,
} from './themes';

export {
    getAllLandingThemes,
    getActiveLandingTheme,
    getLandingTheme,
    hasLandingTheme,
    landingThemeRegistry,
    registerLandingTheme,
    renderPage,
    renderSection,
    setActiveLandingTheme,
} from './themes';

// ─── OttaORM models (DB persistence) ────────────────────────────────────────
export {
    LandingPage,
    LandingSection,
    LandingSite,
    LandingTheme,
    landingPagesTable,
    landingSectionsTable,
    landingSitesTable,
    landingThemesTable,
} from './ottaorm-models';

export type {
    LandingPageType,
    LandingSectionType,
    LandingSiteType,
    LandingThemeType,
    NewLandingPageType,
    NewLandingSectionType,
    NewLandingSiteType,
    NewLandingThemeType,
} from './ottaorm-models';

// ─── Initialization ──────────────────────────────────────────────────────────
export { initOttaLanding } from './init';
export type { OttaLandingInitOptions } from './init';

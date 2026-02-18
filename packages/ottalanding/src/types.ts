/**
 * @ottabase/ottalanding — Content Types (Semantic Layer)
 *
 * These types define the STRUCTURE of landing page content.
 * They are pure data — no React, fully serializable, ready for DB storage.
 *
 * Themes are the visual layer that renders this data.
 * Content is opinionated: every product site has a hero, features, etc.
 * Themes decide how to display them (nav on top vs side, etc.).
 */

// ─── Primitives ──────────────────────────────────────────────────────────────

export interface LinkItem {
    label: string;
    href: string;
}

export interface ImageItem {
    src: string;
    alt: string;
    width?: number;
    height?: number;
}

// ─── Site-level content ──────────────────────────────────────────────────────

/** Top-level site config — name, branding, navigation */
export interface SiteContent {
    /** App/product name */
    name: string;
    /** Short tagline (used in meta, footer, etc.) */
    tagline?: string;
    /** Logo URL (light mode) */
    logoUrl?: string;
    /** Logo URL (dark mode) */
    logoDarkUrl?: string;
    /** Favicon URL */
    faviconUrl?: string;
    /** Primary navigation links (Home, About, Contact, …) */
    navLinks: LinkItem[];
    /** CTA button in the navbar */
    navCta?: LinkItem;
    /** Footer link groups */
    footerSections: FooterSectionContent[];
    /** Social media links */
    socialLinks: SocialLinkContent[];
    /** Legal / copyright */
    legal?: {
        copyright?: string;
        links?: LinkItem[];
    };
}

export interface FooterSectionContent {
    title: string;
    links: LinkItem[];
}

export interface SocialLinkContent {
    /** Platform name (e.g. "twitter", "github") — themes can map to icons */
    name: string;
    href: string;
    /** Optional icon name from an icon set (e.g. "Github", "Twitter") */
    icon?: string;
}

// ─── Section content types ───────────────────────────────────────────────────
// Each maps 1:1 to a section type. Pure data, no React.

export interface HeroContent {
    badge?: string;
    headline: string;
    subheadline?: string;
    primaryCta?: LinkItem;
    secondaryCta?: LinkItem;
    image?: ImageItem;
    socialProof?: { count: string; label: string };
}

export interface FeatureItem {
    /** Icon name (e.g. "Zap", "Shield") — themes resolve to actual icons */
    icon?: string;
    title: string;
    description: string;
}

export interface FeaturesContent {
    eyebrow?: string;
    headline: string;
    subheadline?: string;
    features: FeatureItem[];
    columns?: 2 | 3 | 4;
}

export interface PricingFeatureItem {
    label: string;
    included: boolean | string;
}

export interface PricingPlanItem {
    name: string;
    description?: string;
    price: {
        monthly: string;
        annual?: string;
        suffix?: string;
    };
    badge?: string;
    features: PricingFeatureItem[];
    cta: LinkItem;
    highlighted?: boolean;
}

export interface PricingContent {
    eyebrow?: string;
    headline: string;
    subheadline?: string;
    plans: PricingPlanItem[];
    defaultBilling?: 'monthly' | 'annual';
}

export interface TestimonialItem {
    quote: string;
    author: string;
    role?: string;
    company?: string;
    avatar?: string;
    rating?: number;
}

export interface TestimonialsContent {
    eyebrow?: string;
    headline?: string;
    testimonials: TestimonialItem[];
}

export interface FAQItemContent {
    question: string;
    answer: string;
}

export interface FAQContent {
    eyebrow?: string;
    headline: string;
    subheadline?: string;
    items: FAQItemContent[];
}

export interface LogoItemContent {
    name: string;
    src?: string;
    width?: number;
    height?: number;
}

export interface LogoCloudContent {
    label?: string;
    logos: LogoItemContent[];
}

export interface CTAContent {
    headline: string;
    subheadline?: string;
    primaryCta: LinkItem;
    secondaryCta?: LinkItem;
}

export interface StatItemContent {
    value: string;
    label: string;
    description?: string;
}

export interface StatsContent {
    eyebrow?: string;
    headline?: string;
    stats: StatItemContent[];
}

export interface StepItemContent {
    title: string;
    description: string;
    icon?: string;
}

export interface StepsContent {
    eyebrow?: string;
    headline: string;
    subheadline?: string;
    steps: StepItemContent[];
}

// ─── Section type union & content map ────────────────────────────────────────

/** All supported section types */
export const SECTION_TYPES = [
    'hero',
    'features',
    'pricing',
    'testimonials',
    'faq',
    'logo-cloud',
    'cta',
    'stats',
    'steps',
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

/** Maps each section type to its content shape */
export interface SectionContentMap {
    hero: HeroContent;
    features: FeaturesContent;
    pricing: PricingContent;
    testimonials: TestimonialsContent;
    faq: FAQContent;
    'logo-cloud': LogoCloudContent;
    cta: CTAContent;
    stats: StatsContent;
    steps: StepsContent;
}

// ─── Page structure ──────────────────────────────────────────────────────────

/** A single section within a page */
export interface PageSection<T extends SectionType = SectionType> {
    /** Section type */
    type: T;
    /** Content for this section (shape depends on type) */
    content: SectionContentMap[T];
    /** Display order (lower = first) */
    order: number;
    /** Optional visibility flag */
    visible?: boolean;
}

/** A page with its ordered sections */
export interface PageContent {
    /** URL slug (e.g. "home", "about", "contact") */
    slug: string;
    /** Page title (for <title> tag) */
    title: string;
    /** Meta description */
    metaDescription?: string;
    /** OG image URL */
    ogImage?: string;
    /** Ordered sections */
    sections: PageSection[];
}

/** Complete site data — everything needed to render a full site */
export interface LandingSiteData {
    site: SiteContent;
    pages: PageContent[];
    /** Active theme ID */
    themeId: string;
}

// ─── Default content helpers ─────────────────────────────────────────────────

/** Default nav links every product site gets */
export const DEFAULT_NAV_LINKS: LinkItem[] = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
];

/** Default home page sections in typical order */
export const DEFAULT_HOME_SECTIONS: SectionType[] = [
    'hero',
    'logo-cloud',
    'features',
    'stats',
    'steps',
    'testimonials',
    'pricing',
    'faq',
    'cta',
];

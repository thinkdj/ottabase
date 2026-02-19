import type { ReactNode } from 'react';

// ─── Shared primitives ────────────────────────────────────────────────────────

export interface CtaButton {
    label: string;
    href: string;
    onClick?: () => void;
}

export interface FooterLink {
    label: string;
    href: string;
}

export interface FooterSection {
    title: string;
    links: FooterLink[];
}

// ─── HeroSection ─────────────────────────────────────────────────────────────

export interface HeroSectionProps {
    /** Optional small badge/chip above the headline */
    badge?: string;
    headline: string | ReactNode;
    subheadline?: string | ReactNode;
    primaryCta?: CtaButton;
    secondaryCta?: CtaButton;
    /** Optional screenshot or product image */
    image?: { src: string; alt: string };
    /** Inline metric/social proof (e.g. "10,000+ teams") */
    socialProof?: { count: string; label: string };
    className?: string;
}

// ─── FeaturesGrid ─────────────────────────────────────────────────────────────

export interface Feature {
    icon?: ReactNode;
    title: string;
    description: string;
}

export interface FeaturesGridProps {
    eyebrow?: string;
    headline: string;
    subheadline?: string;
    features: Feature[];
    /** Number of columns. Defaults to 3. */
    columns?: 2 | 3 | 4;
    className?: string;
}

// ─── PricingTable ─────────────────────────────────────────────────────────────

export interface PricingFeature {
    label: string;
    /** true = checkmark, false = dash, string = custom value (e.g. "Unlimited") */
    included: boolean | string;
}

export interface PricingPlan {
    name: string;
    description?: string;
    price: {
        monthly: string;
        annual?: string;
        suffix?: string; // e.g. "/month"
    };
    badge?: string; // e.g. "Most popular"
    features: PricingFeature[];
    cta: CtaButton;
    highlighted?: boolean;
}

export interface PricingTableProps {
    eyebrow?: string;
    headline: string;
    subheadline?: string;
    plans: PricingPlan[];
    /** Show billing period toggle. Defaults to 'monthly'. */
    defaultBilling?: 'monthly' | 'annual';
    className?: string;
}

// ─── TestimonialsCarousel ─────────────────────────────────────────────────────

export interface Testimonial {
    quote: string;
    author: string;
    role?: string;
    company?: string;
    /** URL to avatar image */
    avatar?: string;
    /** Star rating 1-5. Defaults to 5. */
    rating?: number;
}

export interface TestimonialsCarouselProps {
    eyebrow?: string;
    headline?: string;
    testimonials: Testimonial[];
    className?: string;
}

// ─── FAQAccordion ─────────────────────────────────────────────────────────────

export interface FAQItem {
    question: string;
    answer: string | ReactNode;
}

export interface FAQAccordionProps {
    eyebrow?: string;
    headline: string;
    subheadline?: string;
    items: FAQItem[];
    className?: string;
}

// ─── LogoCloud ────────────────────────────────────────────────────────────────

export interface LogoItem {
    name: string;
    /** URL to logo image. If omitted, renders the name as text. */
    src?: string;
    width?: number;
    height?: number;
}

export interface LogoCloudProps {
    label?: string;
    logos: LogoItem[];
    className?: string;
}

// ─── CTABanner ────────────────────────────────────────────────────────────────

export interface CTABannerProps {
    headline: string;
    subheadline?: string;
    primaryCta: CtaButton;
    secondaryCta?: CtaButton;
    className?: string;
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

export interface NavLink {
    label: string;
    href: string;
}

export interface NavbarProps {
    brand: {
        name: string;
        logo?: ReactNode;
        href?: string;
    };
    links?: NavLink[];
    cta?: CtaButton;
    className?: string;
}

// ─── StatsSection ─────────────────────────────────────────────────────────────

export interface StatItem {
    value: string;
    label: string;
    description?: string;
}

export interface StatsSectionProps {
    eyebrow?: string;
    headline?: string;
    stats: StatItem[];
    className?: string;
}

// ─── StepsSection ─────────────────────────────────────────────────────────────

export interface Step {
    title: string;
    description: string;
    icon?: ReactNode;
}

export interface StepsSectionProps {
    eyebrow?: string;
    headline: string;
    subheadline?: string;
    steps: Step[];
    className?: string;
}

// ─── FeatureHighlight ────────────────────────────────────────────────────────

export interface FeatureHighlightBullet {
    icon?: ReactNode;
    text: string;
}

export interface FeatureHighlightProps {
    eyebrow?: string;
    headline: string;
    description: string;
    image?: { src: string; alt: string };
    imagePosition?: 'left' | 'right';
    bullets?: FeatureHighlightBullet[];
    cta?: CtaButton;
    className?: string;
}

// ─── AboutSection ───────────────────────────────────────────────────────────

export interface TeamMember {
    name: string;
    role: string;
    avatar?: string;
    bio?: string;
    social?: { label: string; href: string }[];
}

export interface ValueCard {
    icon?: ReactNode;
    title: string;
    description: string;
}

export interface AboutSectionProps {
    eyebrow?: string;
    headline: string;
    mission?: string;
    story?: string;
    values?: ValueCard[];
    team?: TeamMember[];
    className?: string;
}

// ─── ContactSection ─────────────────────────────────────────────────────────

export interface ContactInfo {
    icon?: ReactNode;
    label: string;
    value: string;
    href?: string;
}

export interface ContactSectionProps {
    eyebrow?: string;
    headline: string;
    subheadline?: string;
    contactInfo?: ContactInfo[];
    formAction?: string;
    showForm?: boolean;
    mapEmbed?: string;
    className?: string;
}

// ─── TimelineSection ────────────────────────────────────────────────────────

export interface TimelineEvent {
    date: string;
    title: string;
    description: string;
    icon?: ReactNode;
    tag?: string;
}

export interface TimelineSectionProps {
    eyebrow?: string;
    headline: string;
    subheadline?: string;
    events: TimelineEvent[];
    className?: string;
}

// ─── FooterMarketing ──────────────────────────────────────────────────────────

export interface SocialLink {
    name: string;
    href: string;
    icon?: ReactNode;
}

export interface FooterMarketingProps {
    brand: {
        name: string;
        description?: string;
        logo?: ReactNode;
    };
    sections: FooterSection[];
    social?: SocialLink[];
    legal?: {
        copyright?: string;
        links?: FooterLink[];
    };
    className?: string;
}

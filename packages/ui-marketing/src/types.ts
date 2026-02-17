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

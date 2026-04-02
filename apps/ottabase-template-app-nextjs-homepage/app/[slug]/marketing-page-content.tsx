'use client';

/**
 * Marketing Page Content
 *
 * Renders the block-based sections of a marketing page using existing slot components.
 * Transforms PageDataPayload sections into slot-specific data shapes.
 */

import type { PageDataPayload, PageSectionPayload } from '@ottabase/homepage-contract';
import { SlotRenderer } from '../../components/SlotRenderer';
import type { AboutData } from '../../components/variants/about';
import type { CTAAction, CTAData } from '../../components/variants/cta';
import type { FeaturesData } from '../../components/variants/features';
import type { FooterData } from '../../components/variants/footer';
import type { HeroAction, HeroData } from '../../components/variants/hero';
import type { NavbarData } from '../../components/variants/navbar';

interface MarketingPageContentProps {
    pageData: PageDataPayload;
    isPreview?: boolean;
}

// Valid button variants
type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost';
const VALID_VARIANTS: ButtonVariant[] = ['default', 'secondary', 'outline', 'ghost'];

function toButtonVariant(v: string | null | undefined): ButtonVariant {
    if (v && VALID_VARIANTS.includes(v as ButtonVariant)) {
        return v as ButtonVariant;
    }
    return 'default';
}

/**
 * Transform a PageSectionPayload into the data shape expected by each slot variant.
 */
function transformSection(section: PageSectionPayload): { slot: string; data: Record<string, unknown> } | null {
    const { slot, title, subtitle, body, features, actions, githubUrl } = section;

    switch (slot) {
        case 'hero':
            return {
                slot: 'hero',
                data: {
                    title: title || 'Welcome',
                    subtitle: subtitle || undefined,
                    body: body || undefined,
                    actions: actions.map(
                        (a): HeroAction => ({
                            label: a.label,
                            href: a.href,
                            variant: toButtonVariant(a.variant),
                            external: a.external,
                        }),
                    ),
                } satisfies HeroData,
            };

        case 'features':
            return {
                slot: 'features',
                data: {
                    title: title || undefined,
                    features: features.map((f) => ({
                        title: f.title,
                        description: f.description || '',
                        icon: f.icon || undefined,
                        href: f.href || undefined,
                    })),
                } satisfies FeaturesData,
            };

        case 'cta':
            return {
                slot: 'cta',
                data: {
                    title: title || 'Ready to Get Started?',
                    description: subtitle || body || undefined,
                    actions: actions.map(
                        (a): CTAAction => ({
                            label: a.label,
                            href: a.href,
                            variant: toButtonVariant(a.variant),
                            external: a.external,
                        }),
                    ),
                } satisfies CTAData,
            };

        case 'about':
            return {
                slot: 'about',
                data: {
                    title: title || 'About',
                    description: subtitle || body || undefined,
                    githubUrl: githubUrl || undefined,
                } satisfies AboutData,
            };

        case 'navbar':
            return {
                slot: 'navbar',
                data: {
                    title: title || 'Ottabase',
                    githubUrl: githubUrl || undefined,
                } satisfies NavbarData,
            };

        case 'footer':
            return {
                slot: 'footer',
                data: {
                    siteName: title || 'Ottabase',
                    tagline: subtitle || body || undefined,
                } satisfies FooterData,
            };

        // Slots that don't have specific components yet - render as CTA-style sections
        case 'testimonials':
        case 'gallery':
        case 'team':
        case 'pricing':
        case 'faq':
        case 'video':
        case 'code':
        case 'custom':
            return {
                slot: 'cta',
                data: {
                    title: title || slot.charAt(0).toUpperCase() + slot.slice(1),
                    description: subtitle || body || undefined,
                    actions: actions.map(
                        (a): CTAAction => ({
                            label: a.label,
                            href: a.href,
                            variant: toButtonVariant(a.variant),
                            external: a.external,
                        }),
                    ),
                } satisfies CTAData,
            };

        default:
            return null;
    }
}

export function MarketingPageContent({ pageData, isPreview = false }: MarketingPageContentProps) {
    const { sections, page } = pageData;

    // Filter to enabled sections and sort by sortOrder
    const enabledSections = sections.filter((s) => s.enabled !== false).sort((a, b) => a.sortOrder - b.sortOrder);

    // Check for navbar and footer
    const navbarSection = enabledSections.find((s) => s.slot === 'navbar');
    const footerSection = enabledSections.find((s) => s.slot === 'footer');
    const contentSections = enabledSections.filter((s) => s.slot !== 'navbar' && s.slot !== 'footer');

    return (
        <div className="min-h-screen flex flex-col">
            {/* Preview Banner */}
            {isPreview && (
                <div className="bg-amber-500 text-black px-4 py-2 text-center text-sm font-medium">
                    Preview Mode — This page is {page.status}. Only you can see this preview.
                </div>
            )}
            {/* Navbar */}
            {navbarSection &&
                (() => {
                    const transformed = transformSection(navbarSection);
                    if (!transformed) return null;
                    return <SlotRenderer slot={transformed.slot as 'navbar'} data={transformed.data as NavbarData} />;
                })()}

            {/* Main content sections */}
            <main className="flex-1">
                {contentSections.map((section) => {
                    const transformed = transformSection(section);
                    if (!transformed) return null;

                    // Type-safe rendering based on slot
                    switch (transformed.slot) {
                        case 'hero':
                            return <SlotRenderer key={section.id} slot="hero" data={transformed.data as HeroData} />;
                        case 'features':
                            return (
                                <SlotRenderer
                                    key={section.id}
                                    slot="features"
                                    data={transformed.data as FeaturesData}
                                />
                            );
                        case 'cta':
                            return <SlotRenderer key={section.id} slot="cta" data={transformed.data as CTAData} />;
                        case 'about':
                            return <SlotRenderer key={section.id} slot="about" data={transformed.data as AboutData} />;
                        default:
                            return null;
                    }
                })}
            </main>

            {/* Footer */}
            {footerSection &&
                (() => {
                    const transformed = transformSection(footerSection);
                    if (!transformed) return null;
                    return <SlotRenderer slot={transformed.slot as 'footer'} data={transformed.data as FooterData} />;
                })()}
        </div>
    );
}

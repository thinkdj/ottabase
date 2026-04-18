'use client';

/**
 * Slot renderer — resolves the active variant for a given slot name and renders
 * the matching component. Data props are forwarded to the resolved component
 * unchanged, implementing the "write once, render any way" pattern.
 *
 * Type-safe: each slot is enforced to match its canonical data contract at compile time.
 *
 * Usage:
 * ```tsx
 * <SlotRenderer slot="hero" data={heroData} />  // heroData must be HeroData
 * ```
 */

import type { ComponentType } from 'react';
import type { SlotName } from '../lib/homepage-config';
import { SLOT_REGISTRY } from '../lib/homepage-config';
import { useHomepageConfig } from '../lib/homepage-config-context';

// ── Variant component maps ─────────────────────────────────────────────────

import { AboutDefault, AboutDetailed, AboutMinimal, type AboutData } from './variants/about';
import { CTABanner, CTADefault, CTAMinimal, type CTAData } from './variants/cta';
import { FeaturesCards, FeaturesGrid, FeaturesList, type FeaturesData } from './variants/features';
import { FooterColumns, FooterDefault, FooterMinimal, type FooterData } from './variants/footer';
import { HeroCentered, HeroMinimal, HeroSplit, type HeroData } from './variants/hero';
import { NavbarCentered, NavbarDefault, NavbarMinimal, type NavbarData } from './variants/navbar';

// ── Component type map ──────────────────────────────────────────────────────
// Maps variant ID to component for each slot. These are intentionally not strictly typed
// here to avoid duplication; the type safety is enforced via SlotRendererProps discriminated union below.
const VARIANT_COMPONENTS = {
    hero: {
        centered: HeroCentered,
        split: HeroSplit,
        minimal: HeroMinimal,
    } as const,
    features: {
        grid: FeaturesGrid,
        cards: FeaturesCards,
        list: FeaturesList,
    } as const,
    cta: {
        default: CTADefault,
        banner: CTABanner,
        minimal: CTAMinimal,
    } as const,
    navbar: {
        default: NavbarDefault,
        centered: NavbarCentered,
        minimal: NavbarMinimal,
    } as const,
    footer: {
        default: FooterDefault,
        minimal: FooterMinimal,
        columns: FooterColumns,
    } as const,
    about: {
        default: AboutDefault,
        minimal: AboutMinimal,
        detailed: AboutDetailed,
    } as const,
} as const;

type SlotRendererProps =
    | { slot: 'hero'; data: HeroData }
    | { slot: 'features'; data: FeaturesData }
    | { slot: 'cta'; data: CTAData }
    | { slot: 'navbar'; data: NavbarData }
    | { slot: 'footer'; data: FooterData }
    | { slot: 'about'; data: AboutData };

export function SlotRenderer(props: SlotRendererProps) {
    const { slot, data } = props;
    const { config } = useHomepageConfig();
    const variantId = config[slot];
    const variants = VARIANT_COMPONENTS[slot] as Record<string, ComponentType<any>>;
    // Fall back to the registry's default variant if the stored id is invalid
    const fallbackId = SLOT_REGISTRY[slot].defaultVariant;
    const Component = variants[variantId] ?? variants[fallbackId];

    if (!Component) return null;

    return <Component {...(data as any)} />;
}

/**
 * SSR-safe slot renderer variant that does NOT require context.
 * Useful when you want pages to remain Server Components and avoid client-side hydration overhead.
 *
 * Tradeoff: live variant switching via /homepage-config will not work for this renderer.
 * Pages using this will always show the specified variantId (typically the default).
 *
 * Usage:
 * ```tsx
 * // app/page.tsx (can remain a Server Component)
 * import { SlotRendererStatic, SLOT_REGISTRY } from '@/components/SlotRenderer';
 * export default function HomePage() {
 *   const heroVariant = SLOT_REGISTRY.hero.defaultVariant;
 *   return <SlotRendererStatic slot="hero" variantId={heroVariant} data={HERO_DATA} />;
 * }
 * ```
 */
export function SlotRendererStatic(props: Omit<SlotRendererProps, 'slot'> & { slot: SlotName; variantId: string }) {
    const { slot, variantId, data } = props;
    const variants = VARIANT_COMPONENTS[slot] as Record<string, ComponentType<any>>;
    const fallbackId = SLOT_REGISTRY[slot].defaultVariant;
    const Component = variants[variantId] ?? variants[fallbackId];

    if (!Component) return null;

    return <Component {...(data as any)} />;
}

/** Convenience export for direct lookup without React context (e.g. tests). */
export { VARIANT_COMPONENTS };

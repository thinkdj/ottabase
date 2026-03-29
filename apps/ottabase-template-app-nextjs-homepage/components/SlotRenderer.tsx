'use client';

/**
 * Slot renderer — resolves the active variant for a given slot name and renders
 * the matching component. Data props are forwarded to the resolved component
 * unchanged, implementing the "write once, render any way" pattern.
 *
 * Usage:
 * ```tsx
 * <SlotRenderer slot="hero" data={heroData} />
 * ```
 */

import type { ComponentType } from 'react';
import { useHomepageConfig } from '../lib/homepage-config-context';
import type { SlotName } from '../lib/homepage-config';

// ── Variant component maps ─────────────────────────────────────────────────

import { CTABanner, CTADefault, CTAMinimal } from './variants/cta';
import { FeaturesCards, FeaturesGrid, FeaturesList } from './variants/features';
import { FooterColumns, FooterDefault, FooterMinimal } from './variants/footer';
import { HeroCentered, HeroMinimal, HeroSplit } from './variants/hero';
import { NavbarCentered, NavbarDefault, NavbarMinimal } from './variants/navbar';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

/**
 * Central registry mapping `[slot][variantId]` → React component.
 * To add a new variant, drop a component file into `components/variants/<slot>/`
 * and add a single entry here + in `SLOT_REGISTRY` (lib/homepage-config.ts).
 */
const VARIANT_COMPONENTS: Record<SlotName, Record<string, AnyComponent>> = {
    hero: {
        centered: HeroCentered,
        split: HeroSplit,
        minimal: HeroMinimal,
    },
    features: {
        grid: FeaturesGrid,
        cards: FeaturesCards,
        list: FeaturesList,
    },
    cta: {
        default: CTADefault,
        banner: CTABanner,
        minimal: CTAMinimal,
    },
    navbar: {
        default: NavbarDefault,
        centered: NavbarCentered,
        minimal: NavbarMinimal,
    },
    footer: {
        default: FooterDefault,
        minimal: FooterMinimal,
        columns: FooterColumns,
    },
};

type SlotRendererProps = {
    /** Which slot to render */
    slot: SlotName;
    /** Data props forwarded to the resolved variant component */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>;
};

export function SlotRenderer({ slot, data }: SlotRendererProps) {
    const { config } = useHomepageConfig();
    const variantId = config[slot];
    const variants = VARIANT_COMPONENTS[slot];
    const Component = variants[variantId] ?? Object.values(variants)[0];

    if (!Component) return null;

    return <Component {...data} />;
}

/** Convenience export for direct lookup without React context (e.g. tests). */
export { VARIANT_COMPONENTS };

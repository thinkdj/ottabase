'use client';

import { SlotRenderer } from '../components/SlotRenderer';
import type { CTAData } from '../components/variants/cta/types';
import type { FeaturesData } from '../components/variants/features/types';
import type { HeroData } from '../components/variants/hero/types';
import type { HomepagePayload } from '../lib/get-homepage-data';
import { Github, Palette, Rocket } from 'lucide-react';

const ICON_MAP = {
    palette: Palette,
    github: Github,
    rocket: Rocket,
} as const;

function wrapLabel(label: string, icon?: string | null) {
    if (!icon) return label;
    const Ic = ICON_MAP[icon as keyof typeof ICON_MAP];
    if (!Ic) return label;
    return (
        <span className="inline-flex items-center gap-1.5">
            <Ic className="h-4 w-4" aria-hidden />
            {label}
        </span>
    );
}

function heroToData(hero: HomepagePayload['slots']['hero']): HeroData {
    return {
        title: hero.title,
        subtitle: hero.subtitle,
        body: hero.body,
        actions: hero.actions.map((a) => ({
            href: a.href,
            label: wrapLabel(a.label, a.icon),
            variant: a.variant,
            external: a.isExternal,
        })),
    };
}

function featuresToData(features: HomepagePayload['slots']['features']): FeaturesData {
    return {
        title: features.title,
        features: features.items.map((f) => ({
            title: f.title,
            description: f.description,
        })),
    };
}

function ctaToData(cta: HomepagePayload['slots']['cta']): CTAData {
    return {
        title: cta.title,
        description: cta.description,
        actions: cta.actions.map((a) => ({
            href: a.href,
            label: wrapLabel(a.label, a.icon),
            variant: a.variant,
            external: a.isExternal,
        })),
    };
}

const DEFAULT_FEATURE_ITEMS: FeaturesData['features'] = [
    { title: 'Cloudflare Workers', description: 'Edge-deployed via OpenNext. No origin server needed.' },
    { title: 'Brand Engine', description: '8 theme presets with live switching and dark mode.' },
    { title: 'Next.js 16', description: 'App Router, RSC, and streaming out of the box.' },
    { title: 'TypeScript', description: 'End-to-end type safety across client and server.' },
];

export function HomePageClient({ payload }: { payload: HomepagePayload }) {
    const hero = heroToData(payload.slots.hero);
    const features = featuresToData(payload.slots.features);
    const cta = ctaToData(payload.slots.cta);

    const featuresData: FeaturesData = {
        title: features.title,
        features: features.features.length > 0 ? features.features : DEFAULT_FEATURE_ITEMS,
    };

    return (
        <div className="flex flex-col items-center">
            <SlotRenderer slot="hero" data={hero} />
            <SlotRenderer slot="features" data={featuresData} />
            <SlotRenderer slot="cta" data={cta} />
        </div>
    );
}

'use client';

/**
 * Floating config panel — sleek pull-out tab on right edge that opens a
 * non-blocking slide-out panel with theme presets and slot variant selectors.
 *
 * Visibility is controlled by:
 *   - `NEXT_PUBLIC_SHOW_CONFIG_PANEL=true` env var (for prod demos), OR
 *   - Defaults to visible when `NODE_ENV !== 'production'`
 */

import {
    ChevronLeft,
    ChevronRight,
    FileText,
    Grid3X3,
    Layout,
    Megaphone,
    Navigation,
    Palette,
    Rows3,
    RotateCcw,
    Sparkles,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useHomepageConfig } from '../lib/homepage-config-context';
import { SLOT_NAMES, SLOT_REGISTRY } from '../lib/homepage-config';
import type { SlotName } from '../lib/homepage-config';
import { ThemePresetSwitcher } from './ThemePresetSwitcher';

/** Icons mapped to each slot for visual scannability in the config panel. */
const SLOT_ICONS: Record<SlotName, React.ComponentType<{ className?: string }>> = {
    navbar: Navigation,
    hero: Sparkles,
    features: Grid3X3,
    cta: Megaphone,
    footer: Rows3,
    about: FileText,
};

/** Check if the config panel should be shown based on env vars. */
function shouldShowPanel(): boolean {
    const envFlag = process.env.NEXT_PUBLIC_SHOW_CONFIG_PANEL;
    if (envFlag === 'true' || envFlag === '1') return true;
    if (envFlag === 'false' || envFlag === '0') return false;
    // Default: show in development
    return process.env.NODE_ENV !== 'production';
}

export function ConfigPanel() {
    const [open, setOpen] = useState(false);
    const [visible, setVisible] = useState(false);
    const { config, setVariant, resetConfig } = useHomepageConfig();

    // Determine visibility on mount (avoid SSR mismatch)
    useEffect(() => {
        setVisible(shouldShowPanel());
    }, []);

    // Close on Escape key
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open]);

    const toggle = useCallback(() => setOpen((prev) => !prev), []);

    if (!visible) return null;

    return (
        <>
            {/* Slide-out panel — no backdrop, non-blocking */}
            <div
                className={`fixed right-0 top-0 z-[100] flex h-full w-80 max-w-[85vw] flex-col border-l border-border bg-background/95 backdrop-blur-sm shadow-xl transition-transform duration-300 ease-in-out ${
                    open ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Panel header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Layout className="h-4 w-4 text-primary" />
                        <h2 className="font-heading text-sm font-semibold text-foreground">Configurator</h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={resetConfig}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            title="Reset slots to defaults"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset
                        </button>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            aria-label="Close config panel"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                    {/* Theme presets */}
                    <section>
                        <div className="mb-3 flex items-center gap-1.5">
                            <Palette className="h-3.5 w-3.5 text-primary" />
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Theme Preset
                            </h3>
                        </div>
                        <ThemePresetSwitcher />
                    </section>

                    {/* Slot variant selectors */}
                    {SLOT_NAMES.map((slotName) => (
                        <SlotSelector
                            key={slotName}
                            slotName={slotName}
                            activeVariant={config[slotName]}
                            onSelect={(variantId) => setVariant(slotName, variantId)}
                        />
                    ))}
                </div>
            </div>

            {/* Sleek pull-out tab — right edge, vertically centered, primary colour */}
            <button
                type="button"
                onClick={toggle}
                className="fixed top-1/2 z-[110] -translate-y-1/2 inline-flex h-14 w-6 items-center justify-center rounded-l-lg bg-primary text-primary-foreground shadow-lg transition-all hover:w-8 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                style={{ right: open ? 'min(20rem, 85vw)' : 0 }}
                aria-label="Toggle config panel"
                title={open ? 'Close configurator' : 'Open configurator'}
            >
                {open ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
        </>
    );
}

// ── Compact slot selector ──────────────────────────────────────────────────

function SlotSelector({
    slotName,
    activeVariant,
    onSelect,
}: {
    slotName: SlotName;
    activeVariant: string;
    onSelect: (variantId: string) => void;
}) {
    const slot = SLOT_REGISTRY[slotName];
    const Icon = SLOT_ICONS[slotName];

    return (
        <section>
            <div className="mb-2 flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{slot.label}</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {slot.variants.map((variant) => {
                    const isActive = activeVariant === variant.id;
                    return (
                        <button
                            key={variant.id}
                            type="button"
                            onClick={() => onSelect(variant.id)}
                            title={variant.description}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                                isActive
                                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground'
                            }`}
                        >
                            {variant.label}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

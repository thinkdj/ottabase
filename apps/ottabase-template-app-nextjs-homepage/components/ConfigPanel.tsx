'use client';

/**
 * Floating config panel — FAB button at bottom-right that opens a slide-out
 * panel with theme presets and slot variant selectors.
 *
 * Visibility is controlled by:
 *   - `NEXT_PUBLIC_SHOW_CONFIG_PANEL=true` env var (for prod demos), OR
 *   - Defaults to visible when `NODE_ENV !== 'production'`
 */

import { RotateCcw, Settings, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useHomepageConfig } from '../lib/homepage-config-context';
import { SLOT_NAMES, SLOT_REGISTRY } from '../lib/homepage-config';
import type { SlotName } from '../lib/homepage-config';
import { ThemePresetSwitcher } from './ThemePresetSwitcher';

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

    const toggle = useCallback(() => setOpen((prev) => !prev), []);

    if (!visible) return null;

    return (
        <>
            {/* Backdrop — non-blocking: click to close */}
            {open && (
                <div
                    className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-[2px] transition-opacity"
                    onClick={() => setOpen(false)}
                    onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
                    role="button"
                    tabIndex={-1}
                    aria-label="Close config panel"
                />
            )}

            {/* Slide-out panel */}
            <div
                className={`fixed right-0 top-0 z-[100] flex h-full w-80 max-w-[85vw] flex-col border-l border-border bg-background shadow-xl transition-transform duration-300 ease-in-out ${
                    open ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Panel header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h2 className="font-heading text-sm font-semibold text-foreground">Configurator</h2>
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
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Theme Preset
                        </h3>
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

            {/* FAB */}
            <button
                type="button"
                onClick={toggle}
                className={`fixed bottom-5 right-5 z-[110] inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95 ${
                    open ? 'rotate-90' : ''
                }`}
                aria-label="Toggle config panel"
                title="Open configurator"
            >
                <Settings className="h-5 w-5" />
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

    return (
        <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{slot.label}</h3>
            <div className="flex flex-wrap gap-1.5">
                {slot.variants.map((variant) => {
                    const isActive = activeVariant === variant.id;
                    return (
                        <button
                            key={variant.id}
                            type="button"
                            onClick={() => onSelect(variant.id)}
                            title={variant.description}
                            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
                                isActive
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
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

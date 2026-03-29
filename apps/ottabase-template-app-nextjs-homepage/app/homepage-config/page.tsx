'use client';

import { RotateCcw } from 'lucide-react';
import { useHomepageConfig } from '../../lib/homepage-config-context';
import { SLOT_NAMES, SLOT_REGISTRY } from '../../lib/homepage-config';
import type { SlotName } from '../../lib/homepage-config';

export default function HomepageConfigPage() {
    const { config, setVariant, resetConfig } = useHomepageConfig();

    return (
        <div className="mx-auto max-w-4xl space-y-10 px-4 py-12">
            {/* Header */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="font-heading text-3xl font-bold text-foreground">Homepage Config</h1>
                    <p className="mt-1 text-muted-foreground">
                        Switch component variants for each section. Changes are saved automatically and applied
                        instantly.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={resetConfig}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to defaults
                </button>
            </div>

            {/* Slot sections */}
            {SLOT_NAMES.map((slotName) => (
                <SlotConfigSection
                    key={slotName}
                    slotName={slotName}
                    activeVariant={config[slotName]}
                    onSelect={(variantId) => setVariant(slotName, variantId)}
                />
            ))}
        </div>
    );
}

// ── SlotConfigSection ───────────────────────────────────────────────────────

function SlotConfigSection({
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
        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div>
                <h2 className="font-heading text-lg font-semibold text-card-foreground">{slot.label}</h2>
                <p className="text-sm text-muted-foreground">
                    Choose which <span className="lowercase">{slot.label}</span> variant to render.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {slot.variants.map((variant) => {
                    const isActive = activeVariant === variant.id;
                    return (
                        <button
                            key={variant.id}
                            type="button"
                            onClick={() => onSelect(variant.id)}
                            className={`flex flex-col items-start gap-1.5 rounded-lg border-2 p-4 text-left transition-all ${
                                isActive
                                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                    : 'border-border bg-background hover:border-primary/40'
                            }`}
                        >
                            <span className="font-heading text-sm font-semibold text-foreground">{variant.label}</span>
                            <span className="text-xs leading-relaxed text-muted-foreground">{variant.description}</span>
                            {isActive && (
                                <span className="mt-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                    Active
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

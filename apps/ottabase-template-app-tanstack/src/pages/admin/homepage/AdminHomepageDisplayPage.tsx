/**
 * Admin Homepage Display Settings
 *
 * Manages the homepage display state:
 * - Variant selection per slot (maps to SLOT_REGISTRY on the Next.js side)
 * - Theme preset
 *
 * Single-row settings model (id = 'default'). Uses upsert semantics via
 * getOrCreateDefault on the API side.
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { homepageDisplaySettingsHooks, type HomepageDisplaySettingsRow } from '@/hooks/homepageHooks';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
} from '@ottabase/ui-shadcn';
import { Check, Monitor, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { HomepageAdminNav } from './HomepageAdminNav';

/** Matches SLOT_NAMES + SLOT_REGISTRY from the Next.js homepage-config. */
const SLOT_CONFIG = {
    navbar: {
        label: 'Navigation Bar',
        variants: [
            { id: 'default', label: 'Default', desc: 'Logo left, links right, mobile hamburger.' },
            { id: 'centered', label: 'Centered', desc: 'Logo and links centered.' },
            { id: 'minimal', label: 'Minimal', desc: 'Logo and dark-mode toggle only.' },
        ],
        default: 'default',
    },
    hero: {
        label: 'Hero Section',
        variants: [
            { id: 'centered', label: 'Centered', desc: 'Large centered headline with buttons.' },
            { id: 'split', label: 'Split', desc: 'Text left, visual right.' },
            { id: 'minimal', label: 'Minimal', desc: 'Compact headline.' },
        ],
        default: 'centered',
    },
    features: {
        label: 'Features Section',
        variants: [
            { id: 'grid', label: 'Grid', desc: 'Two-column bordered list.' },
            { id: 'cards', label: 'Cards', desc: 'Card layout with hover effects.' },
            { id: 'list', label: 'List', desc: 'Vertical stacked list.' },
        ],
        default: 'grid',
    },
    cta: {
        label: 'Call-to-Action',
        variants: [
            { id: 'default', label: 'Default', desc: 'Centered text with buttons.' },
            { id: 'banner', label: 'Banner', desc: 'Full-width colored banner.' },
            { id: 'minimal', label: 'Minimal', desc: 'Compact inline CTA.' },
        ],
        default: 'default',
    },
    footer: {
        label: 'Footer',
        variants: [
            { id: 'default', label: 'Default', desc: 'Copyright and links row.' },
            { id: 'minimal', label: 'Minimal', desc: 'Single-line copyright.' },
            { id: 'columns', label: 'Columns', desc: 'Multi-column grouped links.' },
        ],
        default: 'default',
    },
    about: {
        label: 'About Page',
        variants: [
            { id: 'default', label: 'Default', desc: 'Full content with features, steps, CTA.' },
            { id: 'minimal', label: 'Minimal', desc: 'Concise single-section.' },
            { id: 'detailed', label: 'Detailed', desc: 'Card-based with tech-stack badges.' },
        ],
        default: 'default',
    },
} as const;

type SlotName = keyof typeof SLOT_CONFIG;
const SLOT_NAMES = Object.keys(SLOT_CONFIG) as SlotName[];

function getDefaults(): Record<string, string> {
    const d: Record<string, string> = {};
    for (const [k, v] of Object.entries(SLOT_CONFIG)) {
        d[k] = v.default;
    }
    return d;
}

export function AdminHomepageDisplayPage() {
    const { data, isLoading } = homepageDisplaySettingsHooks.useList({}, ADMIN_LIST_QUERY_CONFIG);
    const createSettings = homepageDisplaySettingsHooks.useCreate();
    const updateSettings = homepageDisplaySettingsHooks.useUpdate();

    // Normalize response: list may return array or paginated
    const rows = (Array.isArray(data) ? data : []) as HomepageDisplaySettingsRow[];
    const existing = rows.find((r) => r.id === 'default') ?? null;

    const [variantBySlot, setVariantBySlot] = useState<Record<string, string>>(getDefaults());
    const [themePreset, setThemePreset] = useState('default');
    const [initialized, setInitialized] = useState(false);

    // Populate from DB when data loads
    useEffect(() => {
        if (existing && !initialized) {
            setVariantBySlot({ ...getDefaults(), ...(existing.variantBySlotJson ?? {}) });
            setThemePreset(existing.themePreset ?? 'default');
            setInitialized(true);
        } else if (!isLoading && !existing && !initialized) {
            // No row yet — use defaults
            setInitialized(true);
        }
    }, [existing, isLoading, initialized]);

    const isDirty =
        initialized &&
        (JSON.stringify(variantBySlot) !==
            JSON.stringify({ ...getDefaults(), ...(existing?.variantBySlotJson ?? {}) }) ||
            themePreset !== (existing?.themePreset ?? 'default'));

    const handleSave = useCallback(async () => {
        const payload = {
            variantBySlotJson: variantBySlot,
            themePreset,
        };
        if (existing) {
            await updateSettings.mutateAsync({ id: 'default', data: payload });
        } else {
            await createSettings.mutateAsync({ id: 'default', ...payload });
        }
    }, [existing, variantBySlot, themePreset, updateSettings, createSettings]);

    const handleVariantChange = (slot: SlotName, variantId: string) => {
        setVariantBySlot((prev) => ({ ...prev, [slot]: variantId }));
    };

    const handleResetDefaults = () => {
        setVariantBySlot(getDefaults());
        setThemePreset('default');
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <HomepageAdminNav />
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">Loading display settings…</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <HomepageAdminNav />

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Display Settings</h1>
                    <p className="text-muted-foreground mt-1">
                        Choose which variant to display for each slot, and set the active theme preset.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleResetDefaults}>
                        Reset Defaults
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!isDirty || updateSettings.isPending || createSettings.isPending}
                    >
                        <Save className="mr-2 h-4 w-4" />
                        {updateSettings.isPending || createSettings.isPending ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </div>

            {/* Theme Preset */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        Theme Preset
                    </CardTitle>
                    <CardDescription>The theme preset name used for SSR and initial page load.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <Label htmlFor="theme-preset" className="shrink-0">
                            Preset name:
                        </Label>
                        <Input
                            id="theme-preset"
                            value={themePreset}
                            onChange={(e) => setThemePreset(e.target.value)}
                            placeholder="default"
                            className="max-w-xs"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Slot Variant Pickers */}
            {SLOT_NAMES.map((slot) => {
                const config = SLOT_CONFIG[slot];
                const selected = variantBySlot[slot] ?? config.default;

                return (
                    <Card key={slot}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">{config.label}</CardTitle>
                            <CardDescription>
                                Select which variant to use for the{' '}
                                <Badge variant="outline" className="font-mono text-xs">
                                    {slot}
                                </Badge>{' '}
                                slot.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {config.variants.map((v) => {
                                    const isActive = selected === v.id;
                                    return (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => handleVariantChange(slot, v.id)}
                                            className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                                                isActive
                                                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                                    : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                                            }`}
                                        >
                                            {isActive && (
                                                <div className="absolute top-2 right-2 rounded-full bg-primary p-0.5">
                                                    <Check className="h-3 w-3 text-primary-foreground" />
                                                </div>
                                            )}
                                            <p className="font-medium text-sm">{v.label}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">{v.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

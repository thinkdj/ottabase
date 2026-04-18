'use client';

import type { ResolvedBrandTheme } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';
import { Button } from '@ottabase/ui-shadcn';
import { useCallback, useState } from 'react';
import type { ThemeSwitchInfo } from '../../components/ThemePresetSwitcher';
import { ThemePresetSwitcher } from '../../components/ThemePresetSwitcher';

export default function ThemeDemo() {
    const { config } = useBrand();
    const [activePresetName, setActivePresetName] = useState<string | null>(null);
    const [activeTheme, setActiveTheme] = useState<ResolvedBrandTheme | null>(null);

    const handleSwitch = useCallback((info: ThemeSwitchInfo) => {
        setActivePresetName(info.presetName);
        setActiveTheme(info.resolvedTheme);
    }, []);

    if (!config) {
        return <div className="flex min-h-[60vh] items-center justify-center">Loading theme…</div>;
    }

    // Use the switched theme if available, otherwise fall back to the initial config
    const theme = activeTheme ?? config.theme;
    const presetName = activePresetName ?? (config as any).themeBase ?? 'default';

    return (
        <div className="mx-auto max-w-4xl space-y-10 px-4 py-12">
            <div>
                <h1 className="font-heading text-4xl font-bold text-foreground">
                    Theme Demo <span className="ml-1 text-primary capitalize">- {presetName}</span>
                </h1>
                <p className="mt-2 text-muted-foreground">
                    Select a preset below to change the entire site design instantly.
                </p>
            </div>

            {/* ── Theme Preset Switcher ── */}
            <section className="space-y-4 rounded-lg border border-border bg-card p-6">
                <h2 className="font-heading text-2xl font-bold text-card-foreground">Choose a Preset</h2>
                <ThemePresetSwitcher onSwitch={handleSwitch} />
            </section>

            {/* ── Typography ── */}
            <section className="space-y-4 rounded-lg border border-border bg-card p-6">
                <h2 className="font-heading text-2xl font-bold text-card-foreground">Typography</h2>
                <div className="space-y-2">
                    <p className="font-heading text-lg">
                        <strong>Heading Font:</strong> {theme.typography.heading.fontFamily}
                    </p>
                    <p className="font-body">
                        <strong>Body Font:</strong> {theme.typography.body.fontFamily}
                    </p>
                    <p className="font-handwriting text-lg">
                        <strong>Handwriting Font:</strong> {theme.typography.handwriting.fontFamily}
                    </p>
                </div>
            </section>

            {/* ── Color Palette ── */}
            <section className="space-y-4 rounded-lg border border-border bg-card p-6">
                <h2 className="font-heading text-2xl font-bold text-card-foreground">Color Palette</h2>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {(['primary', 'secondary', 'accent', 'muted', 'destructive', 'card', 'background'] as const).map(
                        (token) => (
                            <div key={token} className="space-y-2">
                                <div
                                    className="h-14 rounded-md border border-border"
                                    style={{ backgroundColor: `hsl(var(--${token}))` }}
                                />
                                <p className="text-xs font-medium capitalize">{token}</p>
                            </div>
                        ),
                    )}
                </div>
            </section>

            {/* ── Component Demo ── */}
            <section className="space-y-4 rounded-lg border border-border bg-card p-6">
                <h2 className="font-heading text-2xl font-bold text-card-foreground">Buttons</h2>
                <div className="flex flex-wrap gap-3">
                    <Button>Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="destructive">Destructive</Button>
                    <Button variant="link">Link</Button>
                </div>
            </section>

            {/* ── CSS Variables ── */}
            <section className="space-y-4 rounded-lg border border-border bg-card p-6">
                <h2 className="font-heading text-2xl font-bold text-card-foreground">CSS Variables</h2>
                <div className="space-y-1 font-mono text-sm text-muted-foreground">
                    <p>--primary: {theme.colors.primary}</p>
                    <p>--background: {theme.colors.background}</p>
                    <p>--foreground: {theme.colors.foreground}</p>
                    <p>--font-heading: {theme.typography.heading.fontFamily}</p>
                    <p>--font-body: {theme.typography.body.fontFamily}</p>
                    <p>--radius: {theme.radius}</p>
                </div>
            </section>
        </div>
    );
}

import { THEME_PRESET_ITEMS, registerBuiltInThemes } from '@ottabase/brand-engine';
import Link from 'next/link';

registerBuiltInThemes();

export const metadata = {
    title: 'Theme Gallery — Ottabase',
    description: 'Browse all 8 built-in brand themes for your Ottabase app.',
};

export default function ThemeGalleryPage() {
    const themes = THEME_PRESET_ITEMS;

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <header className="border-b border-border bg-background px-6 py-8">
                <div className="mx-auto max-w-6xl">
                    <Link
                        href="/"
                        className="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        ← Back to home
                    </Link>
                    <h1 className="font-heading text-4xl font-bold text-foreground">Theme Gallery</h1>
                    <p className="mt-3 text-lg text-muted-foreground">
                        8 built-in brand themes. Click any theme to preview a full marketing page.
                    </p>
                </div>
            </header>

            {/* Theme grid */}
            <main className="mx-auto max-w-6xl px-6 py-12">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {themes.map((theme) => (
                        <Link
                            key={theme.id}
                            href={`/theme/${theme.id}`}
                            className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-lg hover:-translate-y-0.5"
                        >
                            {/* Color swatch strip */}
                            <div className="flex h-24">
                                {theme.colors.map((color, i) => (
                                    <div key={i} className="flex-1" style={{ backgroundColor: `hsl(${color})` }} />
                                ))}
                            </div>

                            {/* Theme info */}
                            <div className="flex flex-col gap-1 p-4">
                                <h2 className="font-heading text-base font-semibold text-foreground capitalize">
                                    {theme.name}
                                </h2>
                                <p className="text-xs text-muted-foreground">Preview Atlas &amp; Mono templates →</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </main>
        </div>
    );
}

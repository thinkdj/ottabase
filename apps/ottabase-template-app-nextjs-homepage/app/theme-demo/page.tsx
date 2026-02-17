'use client';

import { useBrand } from '@ottabase/brand-engine-react';
import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';
import { Button } from '@ottabase/ui-shadcn';
import { Home } from 'lucide-react';
import Link from 'next/link';

export default function ThemeDemo() {
    const { config } = useBrand();

    if (!config) {
        return <div>Loading theme...</div>;
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Dark Mode Toggle */}
            <div className="absolute right-5 top-5">
                <DarkModeToggle type="button" title="Toggle dark/light mode" />
            </div>

            <div className="container mx-auto max-w-4xl space-y-8 p-8">
                {/* Back Button */}
                <div className="mb-4">
                    <Button asChild variant="ghost" size="sm">
                        <Link href="/">
                            <Home className="mr-2 h-4 w-4" />
                            Back to Home
                        </Link>
                    </Button>
                </div>

                <h1 className="font-heading text-4xl font-bold text-foreground">Theme Demo: {config.themeBase}</h1>

                {/* Typography Demo */}
                <section className="space-y-4 rounded-lg border border-border bg-card p-6">
                    <h2 className="font-heading text-2xl font-bold text-card-foreground">Typography</h2>
                    <div className="space-y-2">
                        <p className="font-heading text-lg">
                            <strong>Heading Font:</strong> {config.theme.typography.heading.fontFamily}
                        </p>
                        <p className="font-body">
                            <strong>Body Font:</strong> {config.theme.typography.body.fontFamily}
                        </p>
                        <p className="font-handwriting text-lg">
                            <strong>Handwriting Font:</strong> {config.theme.typography.handwriting.fontFamily}
                        </p>
                    </div>
                </section>

                {/* Color Palette Demo */}
                <section className="space-y-4 rounded-lg border border-border bg-card p-6">
                    <h2 className="font-heading text-2xl font-bold text-card-foreground">Color Palette</h2>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                            <div className="h-16 rounded-md bg-primary"></div>
                            <p className="text-sm font-medium">Primary</p>
                        </div>
                        <div className="space-y-2">
                            <div className="h-16 rounded-md bg-secondary"></div>
                            <p className="text-sm font-medium">Secondary</p>
                        </div>
                        <div className="space-y-2">
                            <div className="h-16 rounded-md bg-accent"></div>
                            <p className="text-sm font-medium">Accent</p>
                        </div>
                        <div className="space-y-2">
                            <div className="h-16 rounded-md bg-muted"></div>
                            <p className="text-sm font-medium">Muted</p>
                        </div>
                    </div>
                </section>

                {/* Component Demo */}
                <section className="space-y-4 rounded-lg border border-border bg-card p-6">
                    <h2 className="font-heading text-2xl font-bold text-card-foreground">Components</h2>
                    <div className="flex flex-wrap gap-4">
                        <button className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                            Primary Button
                        </button>
                        <button className="rounded-md bg-secondary px-4 py-2 font-medium text-secondary-foreground transition-colors hover:bg-secondary/90">
                            Secondary Button
                        </button>
                        <button className="rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground transition-colors hover:bg-accent/90">
                            Accent Button
                        </button>
                    </div>
                </section>

                {/* CSS Variables Display */}
                <section className="space-y-4 rounded-lg border border-border bg-card p-6">
                    <h2 className="font-heading text-2xl font-bold text-card-foreground">CSS Variables</h2>
                    <div className="space-y-1 font-mono text-sm">
                        <p>--primary: {config.theme.colors.primary}</p>
                        <p>--background: {config.theme.colors.background}</p>
                        <p>--foreground: {config.theme.colors.foreground}</p>
                        <p>--font-heading: {config.theme.typography.heading.fontFamily}</p>
                        <p>--font-body: {config.theme.typography.body.fontFamily}</p>
                        <p>--radius: {config.theme.radius}</p>
                    </div>
                </section>
            </div>
        </div>
    );
}

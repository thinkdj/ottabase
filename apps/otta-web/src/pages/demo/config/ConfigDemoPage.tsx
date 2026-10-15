/**
 * Config Demo Page
 * Demonstrates @ottabase/config: app configuration, ottabase.config.ts, and environment resolution.
 */
import { createAppConfig } from '@ottabase/config';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Key, Layers, Package, Settings } from 'lucide-react';
import { useMemo } from 'react';
import { PACKAGES_ENABLED } from '@/ottabase/config/packages';
import { DemoPageHeader } from '../DemoPageHeader';

export function ConfigDemoPage() {
    // Create a sample config to display its resolved values
    const sampleConfig = useMemo(() => {
        try {
            return createAppConfig();
        } catch {
            return null;
        }
    }, []);

    /** Safely render Object.entries for a config section that may be undefined. */
    const renderEntries = (obj: Record<string, unknown> | undefined) => {
        if (!obj || typeof obj !== 'object') {
            return <p className="text-xs text-muted-foreground italic">Not available</p>;
        }
        return (
            <div className="grid gap-2 text-xs">
                {Object.entries(obj).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3">
                        <code className="font-medium text-muted-foreground">{key}</code>
                        <code className="text-right truncate max-w-[300px]">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'undefined')}
                        </code>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Config"
                description={
                    <>
                        Centralized configuration for Ottabase apps: app metadata, auth settings, theme colors, UI
                        framework, and the package-gating system via <code>ottabase.config.ts</code>.
                    </>
                }
                actions={
                    <Badge
                        variant="outline"
                        className="rounded-full border-transparent bg-background text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border"
                    >
                        @ottabase/config
                    </Badge>
                }
            />

            {/* Overview */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <Settings className="h-4 w-4" />
                        Two Configuration Systems
                    </CardTitle>
                    <div className="text-sm text-muted-foreground space-y-2">
                        <ol className="list-inside list-decimal space-y-2">
                            <li>
                                <strong>createAppConfig()</strong> — Runtime app config (meta, ui, theme,{' '}
                                <code className="rounded bg-muted px-1 py-0.5 text-xs">features.auth</code>,{' '}
                                <code className="rounded bg-muted px-1 py-0.5 text-xs">features.pagination</code>,
                                etc.). Used by components and hooks.
                            </li>
                            <li>
                                <strong>defineOttabaseConfig()</strong> — Feature dials via{' '}
                                <code className="rounded bg-muted px-1 py-0.5 text-xs">ottabase.config.ts</code>. Which
                                packages are installed is the list in{' '}
                                <code className="rounded bg-muted px-1 py-0.5 text-xs">ottabase/packages.ts</code>.
                            </li>
                        </ol>
                    </div>
                </CardHeader>
            </Card>

            {/* Live config values */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <Key className="h-4 w-4" />
                        Resolved AppConfig (createAppConfig)
                    </CardTitle>
                    <CardDescription>
                        Current resolved configuration from <code>createAppConfig()</code>. These are the default values
                        — your app overrides them.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {/* App Meta */}
                        <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                            <h4 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                App Meta
                            </h4>
                            {renderEntries(sampleConfig?.meta as unknown as Record<string, unknown>)}
                        </div>

                        {/* Auth lives under features in AppConfig */}
                        <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                            <h4 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                Auth (features.auth)
                            </h4>
                            {renderEntries(sampleConfig?.features?.auth as unknown as Record<string, unknown>)}
                        </div>

                        {/* Pagination lives under features in AppConfig */}
                        <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                            <h4 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                Pagination (features.pagination)
                            </h4>
                            {renderEntries(sampleConfig?.features?.pagination as unknown as Record<string, unknown>)}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* defineOttabaseConfig */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <Package className="h-4 w-4" />
                        Packages (ottabase/packages.ts)
                    </CardTitle>
                    <CardDescription>
                        A package is installed by listing its manifest once. Tables, models, routes, cron, queue,
                        events, nav, env and health are derived from the list.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs ring-1 ring-border">
                        <code>{`// ottabase/packages.ts
import { createPackageRegistry } from '@ottabase/kernel';
import { createOttablogPackage } from '@ottabase/ottablog';
import { createShortlinksPackage } from '@ottabase/shortlinks';
import { invoicesPackage } from './packages/invoices'; // your own

export const PACKAGES = [
    corePackage,
    appPackage,
    createOttablogPackage({ mode: 'platform', routes: blogRoutes }),
    createShortlinksPackage({ routes: shortlinkRoutes }),
    invoicesPackage, // tables, models, routes, cron, nav — one manifest
];

export const packages = createPackageRegistry<CloudflareEnv>({ packages: PACKAGES });`}</code>
                    </pre>

                    <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                        <h4 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Installed in this app
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                            {Object.keys(PACKAGES_ENABLED).map((pkg) => (
                                <Badge
                                    key={pkg}
                                    variant="outline"
                                    className="rounded-full border-transparent bg-muted/40 font-mono text-xs text-muted-foreground ring-1 ring-border"
                                >
                                    {pkg}
                                </Badge>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            <strong>core</strong> and <strong>brand-engine</strong> are always in the list; the rest is
                            the app's choice.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* resolveConfigWithEnv */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <Layers className="h-4 w-4" />
                        Environment Resolution
                    </CardTitle>
                    <CardDescription>
                        <code>resolveConfigWithEnv()</code> merges config with Cloudflare environment bindings at
                        runtime.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs ring-1 ring-border">
                        <code>{`import { resolveConfigWithEnv } from '@ottabase/config';

// In a Cloudflare Worker handler:
const config = resolveConfigWithEnv(ottabaseConfig, env);

// Config now has resolved environment values:
// - Database bindings (D1, KV, R2)
// - API keys and secrets
// - Feature flags from env vars`}</code>
                    </pre>

                    <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs ring-1 ring-border">
                        <code>{`// Is a package installed? Ask the registry, on either side:
import { packages } from 'ottabase/registry'; // Worker
if (packages.has('ottablog')) {
    // the blog's routes, tables and cron are already wired from its manifest
}

import { PACKAGES_ENABLED } from '@/ottabase/config'; // browser
if (PACKAGES_ENABLED.ottablog) {
    // show the blog's navigation
}`}</code>
                    </pre>
                </CardContent>
            </Card>

            {/* Utility functions */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Utility Functions</CardTitle>
                    <CardDescription>Helper functions exported by @ottabase/config.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[
                            {
                                name: 'createAppConfig(options?)',
                                desc: 'Create runtime app config with defaults. Merges meta, auth, theme, pagination settings.',
                            },
                            {
                                name: 'defineOttabaseConfig(input)',
                                desc: 'Define app config for ottabase.config.ts: identity, feature dials, email and UI. Packages are listed in ottabase/packages.ts.',
                            },
                            {
                                name: 'resolveConfigWithEnv(config, env)',
                                desc: 'Merge static config with Cloudflare Worker environment bindings at runtime.',
                            },
                            {
                                name: 'createStorageKey(prefix, key)',
                                desc: 'Generate namespaced localStorage/KV keys for the app.',
                            },
                            {
                                name: 'createThemeColors(overrides?)',
                                desc: 'Create theme color palette with defaults for primary, accent, etc.',
                            },
                            {
                                name: 'getCurrentYear()',
                                desc: 'Returns current year (for footer copyright, etc.).',
                            },
                        ].map((fn) => (
                            <div key={fn.name} className="rounded-lg bg-background p-3 ring-1 ring-border">
                                <code className="text-sm font-medium">{fn.name}</code>
                                <p className="text-xs text-muted-foreground mt-1">{fn.desc}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * Config Demo Page
 * Demonstrates @ottabase/config: app configuration, ottabase.config.ts, and environment resolution.
 */
import { createAppConfig } from '@ottabase/config';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Key, Layers, Package, Settings } from 'lucide-react';
import { useMemo } from 'react';
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
                                <strong>defineOttabaseConfig()</strong> — Package and feature gating via{' '}
                                <code className="rounded bg-muted px-1 py-0.5 text-xs">ottabase.config.ts</code>.
                                Controls which packages/features are enabled for the app.
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
                        Package Gating (defineOttabaseConfig)
                    </CardTitle>
                    <CardDescription>
                        The <code>ottabase.config.ts</code> file controls which built-in and custom packages are
                        enabled.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs ring-1 ring-border">
                        <code>{`// ottabase.config.ts
import { defineOttabaseConfig } from '@ottabase/config';

export default defineOttabaseConfig({
    meta: {
        appId: 'my-saas-app',
        appName: 'My SaaS',
    },

    // Built-in packages (toggle on/off)
    packages: {
        ottablog: true,
        shortlinks: true,
        referrals: false,
        ottamenu: true,
        comments: true,
        audit: true,
        analytics: true,
        medialibrary: true,
    },

    // Custom packages with route handlers
    customPackages: {
        invoices: {
            enabled: true,
            tables: ['invoices', 'invoice_items'],
            routes: '/api/invoices',
        },
    },

    // Feature flags
    features: {
        spotlight: { enabled: true },
        pagination: { defaultPerPage: 25 },
    },
});`}</code>
                    </pre>

                    <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                        <h4 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Built-in Packages
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                'ottablog',
                                'shortlinks',
                                'referrals',
                                'ottamenu',
                                'comments',
                                'audit',
                                'analytics',
                                'medialibrary',
                                'notifications',
                                'i18n',
                            ].map((pkg) => (
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
                            <strong>brandEngine</strong> is core — always enabled, not listed in packages.
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
                        <code>{`// Check if a package is enabled:
import { isPackageEnabled } from '@ottabase/config';

if (isPackageEnabled(config, 'ottablog')) {
    // Register blog routes
}

// Check custom packages:
import { isCustomPackageEnabled } from '@ottabase/config';

if (isCustomPackageEnabled(config, 'invoices')) {
    // Register invoice routes
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
                                desc: 'Define package-level config for ottabase.config.ts. Validates package names and feature flags.',
                            },
                            {
                                name: 'resolveConfigWithEnv(config, env)',
                                desc: 'Merge static config with Cloudflare Worker environment bindings at runtime.',
                            },
                            {
                                name: 'isPackageEnabled(config, pkg)',
                                desc: 'Check if a built-in package is enabled in the config.',
                            },
                            {
                                name: 'isCustomPackageEnabled(config, pkg)',
                                desc: 'Check if a custom package is enabled in the config.',
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

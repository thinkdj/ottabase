/**
 * Config Demo Page
 * Demonstrates @ottabase/config: app configuration, ottabase.config.ts, and environment resolution.
 */
import { createAppConfig } from '@ottabase/config';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { Key, Layers, Package, Settings } from 'lucide-react';
import { useMemo } from 'react';

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
            <div className="flex flex-col gap-2">
                <Button asChild variant="ghost" className="w-fit text-muted-foreground hover:text-foreground">
                    <Link to="/demo">← Back to Demo Gallery</Link>
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="uppercase">
                        @ottabase/config
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-tight dark:text-foreground">Config Demo</h1>
                </div>
                <p className="max-w-3xl text-muted-foreground">
                    Centralized configuration for Ottabase apps: app metadata, auth settings, theme colors, UI
                    framework, and the package-gating system via <code>ottabase.config.ts</code>.
                </p>
            </div>

            {/* Overview */}
            <Card className="border-primary/30 bg-primary/5 dark:border-primary/20 dark:bg-primary/10">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Settings className="h-5 w-5" />
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
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Resolved AppConfig (createAppConfig)
                    </CardTitle>
                    <CardDescription>
                        Current resolved configuration from <code>createAppConfig()</code>. These are the default values
                        — your app overrides them.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {/* App Meta */}
                        <div className="rounded-lg border p-4">
                            <h4 className="text-sm font-medium mb-2">App Meta</h4>
                            {renderEntries(sampleConfig?.meta as unknown as Record<string, unknown>)}
                        </div>

                        {/* Auth lives under features in AppConfig */}
                        <div className="rounded-lg border p-4">
                            <h4 className="text-sm font-medium mb-2">Auth (features.auth)</h4>
                            {renderEntries(sampleConfig?.features?.auth as unknown as Record<string, unknown>)}
                        </div>

                        {/* Pagination lives under features in AppConfig */}
                        <div className="rounded-lg border p-4">
                            <h4 className="text-sm font-medium mb-2">Pagination (features.pagination)</h4>
                            {renderEntries(sampleConfig?.features?.pagination as unknown as Record<string, unknown>)}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* defineOttabaseConfig */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Package Gating (defineOttabaseConfig)
                    </CardTitle>
                    <CardDescription>
                        The <code>ottabase.config.ts</code> file controls which built-in and custom packages are
                        enabled.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
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

                    <div className="rounded-lg border p-4">
                        <h4 className="text-sm font-medium mb-2">Built-in Packages</h4>
                        <div className="flex flex-wrap gap-2">
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
                                <Badge key={pkg} variant="secondary" className="font-mono text-xs">
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
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Environment Resolution
                    </CardTitle>
                    <CardDescription>
                        <code>resolveConfigWithEnv()</code> merges config with Cloudflare environment bindings at
                        runtime.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                        <code>{`import { resolveConfigWithEnv } from '@ottabase/config';

// In a Cloudflare Worker handler:
const config = resolveConfigWithEnv(ottabaseConfig, env);

// Config now has resolved environment values:
// - Database bindings (D1, KV, R2)
// - API keys and secrets
// - Feature flags from env vars`}</code>
                    </pre>

                    <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
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
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Utility Functions</CardTitle>
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
                            <div key={fn.name} className="rounded-lg border p-3">
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

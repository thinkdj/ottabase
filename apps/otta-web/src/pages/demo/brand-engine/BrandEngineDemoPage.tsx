import { useBrand } from '@ottabase/brand-engine-react';
import { pathPatternToRegex } from '@ottabase/ottalayout';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@ottabase/ui-shadcn';
import { IconPalette, IconRefresh, IconRoute } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

export function BrandEngineDemoPage() {
    const { config, isLoading, error, refresh } = useBrand();
    const [testPath, setTestPath] = useState('/demo/brand-engine');

    const matchedRoute = useMemo(() => {
        if (!config?.routeMappings?.length) return null;
        const sorted = [...config.routeMappings].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        return sorted.find((mapping) => pathPatternToRegex(mapping.pathPattern).test(testPath)) ?? null;
    }, [config?.routeMappings, testPath]);

    return (
        <div className="space-y-6">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo">← Back to Demos</Link>
            </Button>

            <div className="space-y-2">
                <h1 className="text-3xl font-semibold">Brand Engine Demo</h1>
                <p className="text-muted-foreground">
                    Runtime brand/layout resolution from <code>@ottabase/brand-engine-react</code>, no login required.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <IconPalette className="h-5 w-5" />
                        Current Resolved Brand Config
                    </CardTitle>
                    <CardDescription>Shows values already applied by the app-level BrandProvider.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant={isLoading ? 'secondary' : 'outline'}>{isLoading ? 'loading' : 'loaded'}</Badge>
                        {error && <Badge variant="destructive">error</Badge>}
                        {config?.brandName && <Badge variant="outline">{config.brandName}</Badge>}
                        {config?.layoutTemplateId && <Badge variant="outline">layout: {config.layoutTemplateId}</Badge>}
                    </div>
                    <Button onClick={() => refresh()} variant="outline" size="sm">
                        <IconRefresh className="mr-2 h-4 w-4" />
                        Refresh brand config
                    </Button>
                    <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">
                        {JSON.stringify(
                            {
                                brandName: config?.brandName ?? null,
                                layoutTemplateId: config?.layoutTemplateId ?? null,
                                routeMappings: config?.routeMappings?.length ?? 0,
                                layoutTemplates: Object.keys(config?.layoutTemplatesMap ?? {}).length,
                                menuSlots: Object.keys(config?.menuSlots ?? {}),
                            },
                            null,
                            2,
                        )}
                    </pre>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <IconRoute className="h-5 w-5" />
                        Route Mapping Probe
                    </CardTitle>
                    <CardDescription>Tests how route patterns resolve to brand/layout assignments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input value={testPath} onChange={(e) => setTestPath(e.target.value)} placeholder="/pricing" />
                    {matchedRoute ? (
                        <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">
                            {JSON.stringify(matchedRoute, null, 2)}
                        </pre>
                    ) : (
                        <p className="text-sm text-muted-foreground">No route mapping matched this path.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

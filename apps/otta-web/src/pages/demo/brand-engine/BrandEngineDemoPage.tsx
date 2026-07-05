import { useBrand } from '@ottabase/brand-engine-react';
import { pathPatternToRegex } from '@ottabase/ottalayout';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@ottabase/ui-shadcn';
import { IconPalette, IconRefresh, IconRoute } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

export function BrandEngineDemoPage() {
    const { config, isLoading, error, refresh } = useBrand();
    const [testPath, setTestPath] = useState('/demo/brand-engine');

    const matchedRoute = useMemo(() => {
        if (!config?.routeMappings?.length) return null;
        const sorted = [...config.routeMappings].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        return sorted.find((mapping) => pathPatternToRegex(mapping.pathPattern).test(testPath)) ?? null;
    }, [config?.routeMappings, testPath]);

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Brand Engine"
                description={
                    <>
                        Runtime brand/layout resolution from <code>@ottabase/brand-engine-react</code>, no login
                        required.
                    </>
                }
            />

            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <IconPalette className="h-4 w-4" />
                        Current Resolved Brand Config
                    </CardTitle>
                    <CardDescription>Shows values already applied by the app-level BrandProvider.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge
                            variant="outline"
                            className="rounded-full border-transparent bg-background text-muted-foreground ring-1 ring-border"
                        >
                            {isLoading ? 'loading' : 'loaded'}
                        </Badge>
                        {error && (
                            <Badge variant="destructive" className="rounded-full">
                                error
                            </Badge>
                        )}
                        {config?.brandName && (
                            <Badge
                                variant="outline"
                                className="rounded-full border-transparent bg-background text-muted-foreground ring-1 ring-border"
                            >
                                {config.brandName}
                            </Badge>
                        )}
                        {config?.layoutTemplateId && (
                            <Badge
                                variant="outline"
                                className="rounded-full border-transparent bg-background text-muted-foreground ring-1 ring-border"
                            >
                                layout: {config.layoutTemplateId}
                            </Badge>
                        )}
                    </div>
                    <Button onClick={() => refresh()} variant="outline" size="sm">
                        <IconRefresh className="mr-2 h-4 w-4" />
                        Refresh brand config
                    </Button>
                    <pre className="max-h-72 overflow-auto rounded-lg bg-background p-3 text-xs ring-1 ring-border">
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

            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <IconRoute className="h-4 w-4" />
                        Route Mapping Probe
                    </CardTitle>
                    <CardDescription>Tests how route patterns resolve to brand/layout assignments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input value={testPath} onChange={(e) => setTestPath(e.target.value)} placeholder="/pricing" />
                    {matchedRoute ? (
                        <pre className="max-h-64 overflow-auto rounded-lg bg-background p-3 text-xs ring-1 ring-border">
                            {JSON.stringify(matchedRoute, null, 2)}
                        </pre>
                    ) : (
                        <p className="rounded-xl bg-background p-4 text-sm text-muted-foreground ring-1 ring-border">
                            No route mapping matched this path.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

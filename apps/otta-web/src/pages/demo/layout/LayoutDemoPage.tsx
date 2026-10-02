import {
    LAYOUT_PRESETS,
    LAYOUT_PRESET_IDS,
    resolveLayoutForPath,
    type LayoutPresetId,
    type RouteMapping,
} from '@ottabase/ottalayout';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@ottabase/ui-shadcn';
import { IconEye, IconLayout, IconRoute } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

// Sample rules for the simulator only — the app's real rules live in Admin → Appearance → Layouts.
const DEMO_ROUTE_MAPPINGS: RouteMapping[] = [
    { pathPattern: '/login', layoutTemplateId: 'auth', priority: 100 },
    { pathPattern: '/admin/**', layoutTemplateId: 'dashboard', priority: 90 },
    { pathPattern: '/settings/**', layoutTemplateId: 'settings', priority: 90 },
    { pathPattern: '/pricing', layoutTemplateId: 'marketing', priority: 50 },
    { pathPattern: '/**', layoutTemplateId: 'app-shell', priority: 0 },
];

export function LayoutDemoPage() {
    const [selectedPreset, setSelectedPreset] = useState<LayoutPresetId>('app-shell');
    const [testPath, setTestPath] = useState('/demo/layout');

    const resolvedLayout = useMemo(() => resolveLayoutForPath(testPath, DEMO_ROUTE_MAPPINGS), [testPath]);
    const selectedConfig = LAYOUT_PRESETS[selectedPreset]?.config ?? null;

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Dynamic Layout Engine"
                description={
                    <>
                        Preset and route-resolution playground for <code>@ottabase/ottalayout</code>.
                    </>
                }
            />

            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <IconEye className="h-4 w-4" />
                        Live Preview
                    </CardTitle>
                    <CardDescription>
                        Each link is its own route that pins one preset with <code>useLayoutMeta</code>, so moving
                        between them swaps the whole app shell. The rest of the app keeps its layout. Per-route rules
                        for real pages live in{' '}
                        <Link to="/admin/appearance/layouts" className="underline underline-offset-4">
                            Admin → Appearance → Layouts
                        </Link>
                        .
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    {LAYOUT_PRESET_IDS.map((id) => (
                        <Button key={id} asChild variant="outline" size="sm">
                            <Link to="/layout-preview/$preset" params={{ preset: id }}>
                                {id}
                            </Link>
                        </Button>
                    ))}
                </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                            <IconLayout className="h-4 w-4" />
                            Preset Browser
                        </CardTitle>
                        <CardDescription>Inspect built-in layout preset configs.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Select
                            value={selectedPreset}
                            onValueChange={(value) => setSelectedPreset(value as LayoutPresetId)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {LAYOUT_PRESET_IDS.map((id) => (
                                    <SelectItem key={id} value={id}>
                                        {id}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <pre className="max-h-72 overflow-auto rounded-lg bg-background p-3 text-xs ring-1 ring-border">
                            {JSON.stringify(selectedConfig, null, 2)}
                        </pre>
                    </CardContent>
                </Card>

                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                            <IconRoute className="h-4 w-4" />
                            Path Resolver
                        </CardTitle>
                        <CardDescription>Type a path to see which layout template gets selected.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Input
                            value={testPath}
                            onChange={(e) => setTestPath(e.target.value)}
                            placeholder="/admin/settings"
                        />
                        <p className="text-sm text-muted-foreground">
                            Resolved layout: <code>{resolvedLayout ?? 'none'}</code>
                        </p>
                        <pre className="max-h-72 overflow-auto rounded-lg bg-background p-3 text-xs ring-1 ring-border">
                            {JSON.stringify(DEMO_ROUTE_MAPPINGS, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

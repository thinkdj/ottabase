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
import { IconLayout, IconRoute } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

const DEMO_ROUTE_MAPPINGS: RouteMapping[] = [
    { pathPattern: '/', layoutTemplateId: 'homepage', priority: 100 },
    { pathPattern: '/blog/**', layoutTemplateId: 'docs', priority: 90 },
    { pathPattern: '/admin/**', layoutTemplateId: 'dashboard', priority: 95 },
    { pathPattern: '/auth/**', layoutTemplateId: 'auth', priority: 96 },
    { pathPattern: '/demo/**', layoutTemplateId: 'app-shell', priority: 80 },
];

export function LayoutDemoPage() {
    const [selectedPreset, setSelectedPreset] = useState<LayoutPresetId>('app-shell');
    const [testPath, setTestPath] = useState('/demo/layout');

    const resolvedLayout = useMemo(() => resolveLayoutForPath(testPath, DEMO_ROUTE_MAPPINGS), [testPath]);
    const selectedConfig = LAYOUT_PRESETS[selectedPreset]?.config ?? null;

    return (
        <div className="space-y-6">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo">← Back to Demos</Link>
            </Button>

            <div className="space-y-2">
                <h1 className="text-3xl font-semibold">Layout Demo</h1>
                <p className="text-muted-foreground">
                    Preset and route-resolution playground for <code>@ottabase/ottalayout</code>.
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <IconLayout className="h-5 w-5" />
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
                        <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">
                            {JSON.stringify(selectedConfig, null, 2)}
                        </pre>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <IconRoute className="h-5 w-5" />
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
                        <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">
                            {JSON.stringify(DEMO_ROUTE_MAPPINGS, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

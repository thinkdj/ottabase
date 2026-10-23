import { useApiMutation } from '@ottabase/ottaorm/client';
// Types only: the root entry also carries the Worker route.
import type { ScreenshotInput, ScreenshotResponse } from '@ottabase/screenshot';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    NativeSelect,
    NativeSelectOption,
    Switch,
} from '@ottabase/ui';
import { Camera, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

type Format = 'png' | 'jpg' | 'webp';

const OPTIMIZATION_LABEL: Record<ScreenshotResponse['optimization'], string> = {
    applied: 'Optimized',
    'no-gain': 'Optimizer found no saving',
    skipped: 'Optimization off',
    unavailable: 'No optimizer bound',
};

const SCRIPT_EXAMPLE = `import { runShots } from '@ottabase/screenshot/node';

await runShots({
    origin: 'http://127.0.0.1:3003',
    outDir: 'docs/images',
    defaults: { format: 'webp', quality: 80, scale: 1.5 },
    shots: [
        { name: 'home', path: '/' },
        { name: 'blog-dark', path: '/blog', theme: 'dark', waitFor: 'Blog' },
        { name: 'search', path: '/', steps: [{ key: '/' }, { type: 'pricing' }] },
    ],
});`;

function formatBytes(bytes: number): string {
    return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function CloudflareScreenshotDemoPage() {
    const [path, setPath] = useState('/');
    const [format, setFormat] = useState<Format>('webp');
    const [quality, setQuality] = useState(80);
    const [width, setWidth] = useState(1280);
    const [height, setHeight] = useState(800);
    const [scale, setScale] = useState(1);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [waitFor, setWaitFor] = useState('');
    const [optimize, setOptimize] = useState(true);

    const capture = useApiMutation<{ data: ScreenshotResponse }, ScreenshotInput>({
        endpoint: '/api/screenshot/capture',
        requestOptions: { timeout: 90_000 },
    });
    const shot = capture.data?.data;
    const saving = shot ? Math.round((1 - shot.bytes / shot.originalBytes) * 100) : 0;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        capture.mutate({
            path,
            format,
            quality,
            width,
            height,
            scale,
            theme,
            optimize,
            ...(waitFor.trim() ? { waitFor: waitFor.trim() } : {}),
        });
    };

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Screenshots"
                description="@ottabase/screenshot drives a headless Chrome over the DevTools Protocol: Cloudflare Browser Rendering from this Worker, or a local Chrome from a Node script. Pick the output, the quality and whether the optimization pass runs."
                backTo="/demo/cloudflare"
                backLabel="Back to Cloudflare demos"
            />

            <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle>Shot</CardTitle>
                        <CardDescription>A path of this app. The browser is signed out.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={submit}>
                            <div className="space-y-1.5">
                                <Label htmlFor="shot-path">Path</Label>
                                <Input id="shot-path" value={path} onChange={(e) => setPath(e.target.value)} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="shot-format">Output</Label>
                                    <NativeSelect
                                        id="shot-format"
                                        value={format}
                                        onChange={(e) => setFormat(e.target.value as Format)}
                                    >
                                        <NativeSelectOption value="png">PNG</NativeSelectOption>
                                        <NativeSelectOption value="jpg">JPG</NativeSelectOption>
                                        <NativeSelectOption value="webp">WebP</NativeSelectOption>
                                    </NativeSelect>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="shot-theme">Theme</Label>
                                    <NativeSelect
                                        id="shot-theme"
                                        value={theme}
                                        onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                                    >
                                        <NativeSelectOption value="light">Light</NativeSelectOption>
                                        <NativeSelectOption value="dark">Dark</NativeSelectOption>
                                    </NativeSelect>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="shot-quality">Quality</Label>
                                    <span className="text-sm tabular-nums text-muted-foreground">{quality}</span>
                                </div>
                                <input
                                    id="shot-quality"
                                    type="range"
                                    min={1}
                                    max={100}
                                    value={quality}
                                    onChange={(e) => setQuality(Number(e.target.value))}
                                    className="w-full accent-primary"
                                />
                                {format === 'png' ? (
                                    <p className="text-xs text-muted-foreground">
                                        PNG is lossless here; quality sets the palette in the Node optimizer.
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="shot-width">Width</Label>
                                    <Input
                                        id="shot-width"
                                        type="number"
                                        min={320}
                                        max={1920}
                                        value={width}
                                        onChange={(e) => setWidth(Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="shot-height">Height</Label>
                                    <Input
                                        id="shot-height"
                                        type="number"
                                        min={240}
                                        max={1920}
                                        value={height}
                                        onChange={(e) => setHeight(Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="shot-scale">Scale</Label>
                                    <NativeSelect
                                        id="shot-scale"
                                        value={String(scale)}
                                        onChange={(e) => setScale(Number(e.target.value))}
                                    >
                                        <NativeSelectOption value="1">1×</NativeSelectOption>
                                        <NativeSelectOption value="1.5">1.5×</NativeSelectOption>
                                        <NativeSelectOption value="2">2×</NativeSelectOption>
                                    </NativeSelect>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="shot-wait">Wait for text (optional)</Label>
                                <Input
                                    id="shot-wait"
                                    placeholder="e.g. Latest posts"
                                    value={waitFor}
                                    onChange={(e) => setWaitFor(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center justify-between rounded-md border p-3">
                                <Label htmlFor="shot-optimize" className="cursor-pointer">
                                    Optimization pass
                                </Label>
                                <Switch id="shot-optimize" checked={optimize} onCheckedChange={setOptimize} />
                            </div>

                            <Button type="submit" className="w-full gap-2" disabled={capture.isPending}>
                                {capture.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Camera className="h-4 w-4" />
                                )}
                                {capture.isPending ? 'Capturing…' : 'Capture'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle>Result</CardTitle>
                        {shot ? (
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="secondary">{shot.format.toUpperCase()}</Badge>
                                <span>
                                    {shot.width}×{shot.height}
                                </span>
                                <span>·</span>
                                <span>{formatBytes(shot.bytes)}</span>
                                {shot.optimization === 'applied' ? (
                                    <span>
                                        (from {formatBytes(shot.originalBytes)}, −{saving}%)
                                    </span>
                                ) : null}
                                <Badge variant={shot.optimization === 'applied' ? 'default' : 'outline'}>
                                    {OPTIMIZATION_LABEL[shot.optimization]}
                                </Badge>
                            </div>
                        ) : null}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {capture.error ? (
                            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                                {capture.error.message}
                            </p>
                        ) : null}
                        {shot ? (
                            <>
                                <img
                                    src={shot.dataUrl}
                                    alt={`Screenshot of ${path}`}
                                    className="w-full rounded-md border bg-muted"
                                />
                                <Button asChild variant="outline" className="gap-2">
                                    <a href={shot.dataUrl} download={`screenshot.${format}`}>
                                        <Download className="h-4 w-4" />
                                        Download
                                    </a>
                                </Button>
                            </>
                        ) : (
                            <div className="flex aspect-[16/10] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                                {capture.isPending ? 'Starting a browser…' : 'No shot yet'}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Automate it</CardTitle>
                    <CardDescription>
                        The same runner from Node, against a local Chrome, with a sharp optimization pass (palette PNG,
                        mozjpeg, max-effort WebP). <code className="text-xs">pnpm gen:screenshots</code> in otta-web
                        runs a shot list like this one.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
                        <code>{SCRIPT_EXAMPLE}</code>
                    </pre>
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * Cropper Demo Page – @ottabase/cropper
 * Vanilla image cropper: crop, flip, rotate. Square/rect/circle viewfinder.
 * All capabilities exposed via realtime config.
 */
import { Cropper, DEFAULT_ASPECT_PRESETS } from '@ottabase/cropper';
import type { CropShape } from '@ottabase/cropper';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Label,
    NativeSelect,
    NativeSelectOption,
    Slider,
    Switch,
} from '@ottabase/ui-shadcn';
import { IconArrowLeft, IconCircle, IconDownload, IconRectangle } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

const ASPECT_OPTIONS: { label: string; value: number | null }[] = [
    { label: 'Freeform', value: null },
    { label: '1:1 (square)', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '16:9', value: 16 / 9 },
];

const findAspectValue = (v: number | null) => {
    if (v === null) return null;
    return ASPECT_OPTIONS.find((o) => o.value !== null && Math.abs(o.value - v) < 1e-4)?.value ?? 1;
};

export function CropperDemoPage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const cropperRef = useRef<Cropper | null>(null);
    const previewUrlRef = useRef<string | null>(null);

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [shape, setShape] = useState<CropShape>('rect');
    const [aspectRatio, setAspectRatio] = useState<number | null>(1);
    const [presetsVisible, setPresetsVisible] = useState(true);
    const [maxHeight, setMaxHeight] = useState(400);
    const [zoom, setZoom] = useState(1);
    const [transitions, setTransitions] = useState(true);
    const [transitionDuration, setTransitionDuration] = useState(300);

    useEffect(() => {
        if (!containerRef.current) return;
        cropperRef.current = new Cropper(containerRef.current, {
            aspectRatio,
            shape,
            maxHeight,
            aspectPresets: presetsVisible ? DEFAULT_ASPECT_PRESETS : false,
            zoom,
            transitions,
            transitionDuration,
        });
        return () => {
            cropperRef.current?.destroy();
            cropperRef.current = null;
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        };
    }, []);

    // Realtime config sync
    useEffect(() => {
        const c = cropperRef.current;
        if (!c) return;
        c.setShape(shape);
    }, [shape]);

    useEffect(() => {
        const c = cropperRef.current;
        if (!c) return;
        c.setAspectRatio(aspectRatio);
    }, [aspectRatio]);

    useEffect(() => {
        const c = cropperRef.current;
        if (!c) return;
        c.setPresetsVisible(presetsVisible);
    }, [presetsVisible]);

    useEffect(() => {
        const c = cropperRef.current;
        if (!c) return;
        c.setMaxHeight(maxHeight);
    }, [maxHeight]);

    // Sync zoom from cropper on user interaction (wheel zoom)
    useEffect(() => {
        const c = cropperRef.current;
        if (!c) return;
        const interval = setInterval(() => {
            const currentZoom = c.getZoom();
            if (Math.abs(currentZoom - zoom) > 0.01) {
                setZoom(currentZoom);
            }
        }, 100);
        return () => clearInterval(interval);
    }, [zoom]);

    const handleExport = async () => {
        const cropper = cropperRef.current;
        if (!cropper) return;
        try {
            const blob = await cropper.getBlob('image/jpeg', 0.92);
            const url = URL.createObjectURL(blob);
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = url;
            setPreviewUrl(url);
        } catch (err) {
            console.error('Export failed:', err);
        }
    };

    return (
        <div className="mx-auto max-w-4xl space-y-8">
            <div className="flex flex-col gap-2">
                <Button asChild variant="ghost" size="sm" className="w-fit gap-2">
                    <Link to="/demo">
                        <IconArrowLeft className="h-4 w-4" />
                        Back to Demo
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold tracking-tight">Image Cropper</h1>
                <p className="text-muted-foreground">
                    Advanced vanilla cropper: crop, flip, rotate, zoom with smooth transitions. Drag to move, resize
                    handles, mouse wheel zoom. Zero React dependency. ~3–4 KB gzipped.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr,300px]">
                <Card>
                    <CardHeader>
                        <CardTitle>Cropper</CardTitle>
                        <CardDescription>
                            Select PNG/JPEG, drag to move, resize with handles, zoom with wheel or buttons, flip/rotate
                            with smooth transitions
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div
                            ref={containerRef}
                            className="rounded-lg border bg-muted/30 p-4 dark:bg-muted/10"
                            style={{ minHeight: 120 }}
                        />
                        <Button onClick={handleExport} className="gap-2">
                            <IconDownload className="h-4 w-4" />
                            Export JPEG
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Realtime Config</CardTitle>
                        <CardDescription>All capabilities – change and see effect immediately</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Shape</Label>
                            <div className="flex gap-2">
                                <Button
                                    variant={shape === 'rect' ? 'default' : 'outline'}
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => setShape('rect')}
                                >
                                    <IconRectangle className="h-4 w-4" />
                                    Rect
                                </Button>
                                <Button
                                    variant={shape === 'circle' ? 'default' : 'outline'}
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => setShape('circle')}
                                >
                                    <IconCircle className="h-4 w-4" />
                                    Circle
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Aspect ratio</Label>
                            <NativeSelect
                                value={aspectRatio === null ? 'null' : String(findAspectValue(aspectRatio))}
                                onChange={(e) => {
                                    const val = e.target.value === 'null' ? null : Number(e.target.value);
                                    setAspectRatio(val);
                                }}
                            >
                                {ASPECT_OPTIONS.map((o) => (
                                    <NativeSelectOption
                                        key={o.label}
                                        value={o.value === null ? 'null' : String(o.value)}
                                    >
                                        {o.label}
                                    </NativeSelectOption>
                                ))}
                            </NativeSelect>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <Label htmlFor="presets">Presets visible</Label>
                            <Switch id="presets" checked={presetsVisible} onCheckedChange={setPresetsVisible} />
                        </div>

                        <div className="space-y-2">
                            <Label>Max height: {maxHeight}px</Label>
                            <Slider
                                value={[maxHeight]}
                                onValueChange={([v]) => setMaxHeight(v ?? 400)}
                                min={200}
                                max={800}
                                step={50}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Zoom: {zoom.toFixed(2)}x</Label>
                            <Slider
                                value={[zoom]}
                                onValueChange={([v]) => {
                                    setZoom(v ?? 1);
                                    cropperRef.current?.setZoom(v ?? 1);
                                }}
                                min={0.5}
                                max={3}
                                step={0.1}
                            />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <Label htmlFor="transitions">Smooth transitions</Label>
                            <Switch
                                id="transitions"
                                checked={transitions}
                                onCheckedChange={(checked) => {
                                    setTransitions(checked);
                                    // Recreate cropper with new transition setting
                                    if (containerRef.current) {
                                        cropperRef.current?.destroy();
                                        cropperRef.current = new Cropper(containerRef.current, {
                                            aspectRatio,
                                            shape,
                                            maxHeight,
                                            aspectPresets: presetsVisible ? DEFAULT_ASPECT_PRESETS : false,
                                            zoom,
                                            transitions: checked,
                                            transitionDuration,
                                        });
                                    }
                                }}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Transition duration: {transitionDuration}ms</Label>
                            <Slider
                                value={[transitionDuration]}
                                onValueChange={([v]) => {
                                    setTransitionDuration(v ?? 300);
                                    if (containerRef.current) {
                                        cropperRef.current?.destroy();
                                        cropperRef.current = new Cropper(containerRef.current, {
                                            aspectRatio,
                                            shape,
                                            maxHeight,
                                            aspectPresets: presetsVisible ? DEFAULT_ASPECT_PRESETS : false,
                                            zoom,
                                            transitions,
                                            transitionDuration: v ?? 300,
                                        });
                                    }
                                }}
                                min={100}
                                max={1000}
                                step={50}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {previewUrl && (
                <Card>
                    <CardHeader>
                        <CardTitle>Preview</CardTitle>
                        <CardDescription>Cropped output (JPEG, 92% quality)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <img src={previewUrl} alt="Cropped" className="max-h-64 rounded-lg border object-contain" />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

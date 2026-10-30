/**
 * Cropper Demo Page – @ottabase/ui-cropper
 * Fixed-viewfinder cropper: the frame fills the stage, the photo moves underneath.
 * Every option is exposed; runtime ones apply live, construction ones remount.
 */
import type { CropperState, CropShape } from '@ottabase/ui-cropper';
import { Cropper } from '@ottabase/ui-cropper';
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
} from '@ottabase/ui';
import { Circle, Download, RectangleHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';
import '@ottabase/ui-cropper/styles.css';

const ASPECT_OPTIONS: { label: string; value: number | null }[] = [
    { label: 'Free (resizable frame)', value: null },
    { label: '1:1 (square)', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '16:9', value: 16 / 9 },
    { label: '3:4 (portrait)', value: 3 / 4 },
];

const aspectKey = (v: number | null) => (v === null ? 'null' : v.toFixed(4));

export function CropperDemoPage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const cropperRef = useRef<Cropper | null>(null);
    const previewUrlRef = useRef<string | null>(null);

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewFormat, setPreviewFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
    const [state, setState] = useState<CropperState | null>(null);

    // Live options
    const [shape, setShape] = useState<CropShape>('rect');
    const [aspectRatio, setAspectRatio] = useState<number | null>(1);
    const [height, setHeight] = useState(360);
    // Construction options (remount)
    const [presetsVisible, setPresetsVisible] = useState(true);
    const [straighten, setStraighten] = useState(true);
    const [transitions, setTransitions] = useState(true);
    const [maxOutput, setMaxOutput] = useState(2048);

    // Live options are read through a ref at mount so changing them never remounts.
    const liveRef = useRef({ shape, aspectRatio, height });
    liveRef.current = { shape, aspectRatio, height };

    useEffect(() => {
        if (!containerRef.current) return;
        cropperRef.current = new Cropper(containerRef.current, {
            ...liveRef.current,
            aspectPresets: presetsVisible ? undefined : false,
            straighten,
            transitions,
            maxOutput,
            onChange: setState,
        });
        return () => {
            cropperRef.current?.destroy();
            cropperRef.current = null;
            setState(null);
        };
    }, [presetsVisible, straighten, transitions, maxOutput]);

    useEffect(() => {
        cropperRef.current?.setShape(shape);
    }, [shape]);
    useEffect(() => {
        cropperRef.current?.setAspectRatio(aspectRatio);
    }, [aspectRatio]);
    useEffect(() => {
        cropperRef.current?.setHeight(height);
    }, [height]);
    useEffect(
        () => () => {
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        },
        [],
    );

    const handleExport = async () => {
        const cropper = cropperRef.current;
        if (!cropper?.hasImage()) return;
        const format = shape === 'circle' ? 'image/png' : 'image/jpeg';
        try {
            const blob = await cropper.getBlob(format, 0.92);
            const url = URL.createObjectURL(blob);
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = url;
            setPreviewFormat(format);
            setPreviewUrl(url);
        } catch (err) {
            console.error('Export failed:', err);
        }
    };

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Image Cropper"
                description="The frame fills the stage and the photo moves underneath it: drag to pan, pinch or scroll to zoom, rotate, straighten and flip from the toolbar. Drop a photo anywhere to begin. Zero React dependency."
            />

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-[0.9375rem] font-semibold">Cropper</CardTitle>
                        <CardDescription>
                            Arrow keys nudge, Shift for 10px. <kbd>+</kbd>/<kbd>-</kbd> zoom, <kbd>R</kbd> rotates
                            (Shift for the other way), <kbd>0</kbd> or double-click resets.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div ref={containerRef} />
                        <div className="flex flex-wrap items-center gap-3">
                            <Button onClick={handleExport} className="gap-2" disabled={!state?.hasImage}>
                                <Download className="h-4 w-4" />
                                Export {shape === 'circle' ? 'PNG' : 'JPEG'}
                            </Button>
                            {state?.hasImage && (
                                <span className="text-sm text-muted-foreground tabular-nums">
                                    {state.output.width} × {state.output.height} px · zoom {state.zoom.toFixed(2)}×
                                    {state.rotation ? ` · ${state.rotation}°` : ''}
                                    {state.straighten ? ` ${state.straighten > 0 ? '+' : ''}${state.straighten}°` : ''}
                                    {state.flipX ? ' · flipped ↔' : ''}
                                    {state.flipY ? ' · flipped ↕' : ''}
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-[0.9375rem] font-semibold">Options</CardTitle>
                        <CardDescription>
                            Shape, aspect and height apply live. The rest remount the cropper.
                        </CardDescription>
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
                                    <RectangleHorizontal className="h-4 w-4" />
                                    Rect
                                </Button>
                                <Button
                                    variant={shape === 'circle' ? 'default' : 'outline'}
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => setShape('circle')}
                                >
                                    <Circle className="h-4 w-4" />
                                    Circle
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Aspect ratio</Label>
                            <NativeSelect
                                value={aspectKey(aspectRatio)}
                                onChange={(e) => {
                                    const picked = ASPECT_OPTIONS.find((o) => aspectKey(o.value) === e.target.value);
                                    setAspectRatio(picked ? picked.value : 1);
                                }}
                            >
                                {ASPECT_OPTIONS.map((o) => (
                                    <NativeSelectOption key={o.label} value={aspectKey(o.value)}>
                                        {o.label}
                                    </NativeSelectOption>
                                ))}
                            </NativeSelect>
                        </div>

                        <div className="space-y-2">
                            <Label>Stage height: {height}px</Label>
                            <Slider
                                value={[height]}
                                onValueChange={([v]) => setHeight(v ?? 360)}
                                min={200}
                                max={640}
                                step={20}
                            />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <Label htmlFor="presets">Aspect presets</Label>
                            <Switch id="presets" checked={presetsVisible} onCheckedChange={setPresetsVisible} />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <Label htmlFor="straighten">Straighten slider</Label>
                            <Switch id="straighten" checked={straighten} onCheckedChange={setStraighten} />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <Label htmlFor="transitions">Smooth transitions</Label>
                            <Switch id="transitions" checked={transitions} onCheckedChange={setTransitions} />
                        </div>

                        <div className="space-y-2">
                            <Label>Max output (longest side)</Label>
                            <NativeSelect
                                value={String(maxOutput)}
                                onChange={(e) => setMaxOutput(Number(e.target.value))}
                            >
                                {[512, 1024, 2048, 4096].map((n) => (
                                    <NativeSelectOption key={n} value={String(n)}>
                                        {n} px
                                    </NativeSelectOption>
                                ))}
                            </NativeSelect>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {previewUrl && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-[0.9375rem] font-semibold">Preview</CardTitle>
                        <CardDescription>
                            Cropped output (
                            {previewFormat === 'image/png' ? 'PNG with transparency' : 'JPEG, 92% quality'})
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <img
                            src={previewUrl}
                            alt="Cropped"
                            className="max-h-64 rounded-lg object-contain ring-1 ring-border"
                        />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

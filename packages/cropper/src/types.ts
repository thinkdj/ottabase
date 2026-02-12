/** Viewfinder shape: rect (square or aspect ratio) or circle */
export type CropShape = 'rect' | 'circle';

/** Aspect preset: label shown in UI, value is width/height ratio (null = freeform) */
export interface AspectPreset {
    label: string;
    value: number | null;
}

/** Default aspect presets: Freeform, 1:1, 4:3, 16:9 */
export const DEFAULT_ASPECT_PRESETS: AspectPreset[] = [
    { label: 'Free', value: null as any }, // null means freeform
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '16:9', value: 16 / 9 },
];

/** Options for Cropper */
export interface CropperOptions {
    /** Aspect ratio: 1 = square, 16/9 = landscape rect, null = freeform (no constraints) */
    aspectRatio?: number | null;
    /** Viewfinder shape – rect or circle (circle uses square crop internally) */
    shape?: CropShape;
    /** Accepted file types (default: png, jpeg) */
    accept?: string;
    /** Max display height in px */
    maxHeight?: number;
    /** Aspect ratio presets. Default: 1:1, 4:3, 16:9. Set false to hide. */
    aspectPresets?: AspectPreset[] | false;
    /** Enable smooth transitions for transforms (default: true) */
    transitions?: boolean;
    /** Transition duration in ms (default: 300) */
    transitionDuration?: number;
    /** Initial zoom level (default: 1) */
    zoom?: number;
    /** Min zoom level (default: 0.5) */
    minZoom?: number;
    /** Max zoom level (default: 3) */
    maxZoom?: number;
}

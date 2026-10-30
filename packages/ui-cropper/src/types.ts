/** Viewfinder shape: rect (any aspect) or circle (an ellipse when the aspect is not 1:1) */
export type CropShape = 'rect' | 'circle';

/** Aspect preset: label shown in the toolbar, value is width/height (null = free) */
export interface AspectPreset {
    label: string;
    value: number | null;
}

/** Default aspect presets: Free, 1:1, 4:3, 16:9 */
export const DEFAULT_ASPECT_PRESETS: AspectPreset[] = [
    { label: 'Free', value: null },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '16:9', value: 16 / 9 },
];

/** Snapshot handed to `onChange` and returned by `getState()` */
export interface CropperState {
    /** True once a photo is on the stage */
    hasImage: boolean;
    /** 1 = photo exactly covers the frame; up to `maxZoom` */
    zoom: number;
    /** Quarter turns, 0..359, clockwise as seen on screen */
    rotation: number;
    /** Fine rotation in degrees, -45..45 (0 unless `straighten` is on) */
    straighten: number;
    flipX: boolean;
    flipY: boolean;
    /** Current frame aspect (w/h) — the locked ratio, or the free frame's own */
    aspectRatio: number;
    /** Size of the export at native resolution, in image pixels */
    output: { width: number; height: number };
    /** Anything differs from the freshly loaded photo */
    dirty: boolean;
}

export interface CropperOptions {
    /** Locked frame aspect (w/h): 1 = square, 16/9 = landscape. null = free, resizable frame. Default 1. */
    aspectRatio?: number | null;
    /** Frame shape. Default 'rect'. */
    shape?: CropShape;
    /** Aspect buttons in the toolbar. Default Free / 1:1 / 4:3 / 16:9; false hides them. */
    aspectPresets?: AspectPreset[] | false;
    /** File input accept list. Default 'image/*'. */
    accept?: string;
    /** Stage height in px. Width follows the container. Default 360. */
    height?: number;
    /** How far past "cover" the photo may be enlarged. Default 4. */
    maxZoom?: number;
    /** Longest side of the exported image in px; larger crops are downscaled. Default: native. */
    maxOutput?: number;
    /** Show the fine-rotation slider (-45..45°). Default false. */
    straighten?: boolean;
    /** Animate rotate, flip, zoom buttons, aspect changes and reset. Default true. */
    transitions?: boolean;
    /** Transition length in ms. Default 240. */
    transitionDuration?: number;
    /** A photo finished loading (file picker, drop, loadFromFile or loadFromUrl). */
    onImageLoad?: (state: CropperState) => void;
    /** Any change to zoom, position, rotation, flips, frame or image. */
    onChange?: (state: CropperState) => void;
    /** A file was rejected or an image failed to decode. The message is user-facing. */
    onError?: (message: string) => void;
}

/**
 * @ottabase/ui-cropper – Vanilla image cropper, fixed-viewfinder model.
 * Pan, pinch, zoom, rotate, straighten and flip the photo under a frame that fills the stage.
 * Zero dependencies, zero React. Pair with '@ottabase/ui-cropper/styles.css'.
 */
export { Cropper } from './cropper';
export type { AspectPreset, CropperOptions, CropperState, CropShape } from './types';
export { DEFAULT_ASPECT_PRESETS } from './types';
export type { Point, Rect, View } from './geometry';
export { clampView, coverScale, fitRect, toImage } from './geometry';

# @ottabase/ui-cropper — agent notes

Vanilla DOM image cropper widget (crop/flip/rotate/zoom, Blob export). Full docs: ./README.md

## Use when

- Browser UI needs in-page image cropping/editing before upload (avatars, covers), framework-free.
- NOT for server-side/edge image processing (needs DOM + canvas) or when a React component API is required.

## Imports

```ts
import { Cropper, DEFAULT_ASPECT_PRESETS } from '@ottabase/ui-cropper';
import type { CropperOptions, CropShape, AspectPreset } from '@ottabase/ui-cropper';
import '@ottabase/ui-cropper/styles.css'; // required side-effect import
```

## Canonical usage

```ts
const cropper = new Cropper(container, {
    aspectRatio: 1, // null = freeform
    shape: 'rect', // or 'circle'
    onImageLoad: () => {},
});

cropper.loadFromUrl('https://example.com/photo.jpg'); // or loadFromFile(file)
const blob = await cropper.getBlob('image/jpeg', 0.92);
cropper.destroy();
```

```ts
// Runtime tweaks
cropper.setAspectRatio(16 / 9);
cropper.setShape('circle');
cropper.setZoom(1.5);
new Cropper(container, { aspectPresets: false }); // hide preset buttons
```

## Gotchas

- Styles ship separately: skip the `styles.css` import and the widget renders unstyled.
- `shape: 'circle'` does NOT force 1:1 — it keeps `aspectRatio`, so non-1:1 ratios yield an ellipse (1:1 is only enforced while dragging resize handles); `getBlob` always exports PNG (transparent corners) even if you pass `'image/jpeg'`.
- `getBlob` is async; JPEG quality defaults to 0.92.
- Theming reads raw HSL channel tokens (`--background`, `--border`, ...) wrapped in `hsl()` — shadcn convention, same as `@ottabase/ottadate`; full color values won't work.
- Built-in file picker only loads png/jpeg — a hard-coded MIME check rejects everything else; the `accept` option just sets the `<input>` attribute and cannot widen supported types (e.g. webp is silently dropped).

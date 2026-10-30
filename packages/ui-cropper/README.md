# @ottabase/ui-cropper

Vanilla image cropper built on the fixed-viewfinder model used by every modern photo app: the frame fills the stage and
the photo pans, pinches, zooms, rotates, straightens and flips underneath it. Zero dependencies, zero React, ~9 KB
gzipped including icons.

## Why this model

A crop box dragged over a static photo (the classic jQuery-era cropper) makes the output shape small, makes zoom
meaningless and leaves the user guessing what they will get. Here the frame **is** the output: it fills the available
width, the user composes the photo inside it, and zoom is "how much closer". That is how iOS Photos, Instagram and every
avatar picker worth copying work.

- **The photo is a CSS-transformed `<img>`, the overlay is DOM.** Crisp on any display, GPU-smooth while dragging, every
  pixel themeable. Canvas is used only to export.
- **The frame is never empty.** Zoom can't go below "cover" and panning stops at the photo's edge, in any rotation.
- **Rotation about the frame.** 90° turns and fine straightening (−45°…45°) pivot on what you're looking at; the photo
  grows just enough to keep the frame full.
- **Free frames reshape then refill.** With `aspectRatio: null` the frame has handles; drag one and on release the frame
  grows back to fill the stage with its new proportions, the photo following. Turning a free frame turns it with the
  photo.
- **Touch first.** One finger pans, two pinch and pan together, with pointer capture so a drag survives leaving the
  stage.
- **Export sized for purpose.** `maxOutput` caps the longest side, so a 6000px photo yields a 512px avatar, not a 4000px
  PNG. Circles export as PNG with transparent corners.

## Usage

```ts
import { Cropper } from '@ottabase/ui-cropper';
import '@ottabase/ui-cropper/styles.css';

const cropper = new Cropper(document.getElementById('avatar')!, {
    aspectRatio: 1,
    shape: 'circle',
    height: 320,
    maxOutput: 512,
    aspectPresets: false,
    onImageLoad: () => (save.disabled = false),
});

cropper.loadFromUrl(currentAvatarUrl); // optional: start from the existing picture

save.onclick = async () => {
    const blob = await cropper.getBlob('image/png');
    // upload…
};

cropper.destroy();
```

Mount it in a plain container; the cropper owns its full surface (stage plus toolbar) and does not want a second card,
border or padding around it.

## Options

| Option               | Default                 | Description                                                                                              |
| -------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `aspectRatio`        | `1`                     | Locked frame aspect (w/h). `16/9` landscape, `3/4` portrait, `null` = free, resizable frame.             |
| `shape`              | `'rect'`                | `'rect'` or `'circle'` (an ellipse when the aspect isn't 1:1).                                           |
| `aspectPresets`      | Free · 1:1 · 4:3 · 16:9 | Toolbar aspect buttons (`{ label, value }[]`); `false` hides them. `DEFAULT_ASPECT_PRESETS` is exported. |
| `accept`             | `'image/*'`             | File input accept list. Anything the browser can decode works (PNG, JPEG, WebP, AVIF, GIF, SVG).         |
| `height`             | `360`                   | Stage height in px. Width follows the container and the frame refits on resize.                          |
| `maxZoom`            | `4`                     | How far past "cover" the photo may be enlarged.                                                          |
| `maxOutput`          | `4096`                  | Longest side of the export in px; larger crops are downscaled.                                           |
| `straighten`         | `false`                 | Show the fine-rotation slider (−45°…45°).                                                                |
| `transitions`        | `true`                  | Animate rotate, flip, zoom buttons, aspect changes and reset. Pointer gestures are never animated.       |
| `transitionDuration` | `240`                   | Animation length in ms.                                                                                  |
| `onImageLoad`        | —                       | `(state) => void` after a photo loads from the picker, a drop, `loadFromFile` or `loadFromUrl`.          |
| `onChange`           | —                       | `(state) => void` on every change to zoom, position, rotation, flips, frame or photo.                    |
| `onError`            | —                       | `(message) => void` for a rejected file or a photo that failed to decode. The message is user-facing.    |

## Methods

| Method                                | Description                                                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `loadFromFile(file)`                  | Load a `File`.                                                                                                    |
| `loadFromUrl(url)`                    | Load from http(s), `blob:` or `data:`. Remote hosts must send CORS headers for export to work.                    |
| `hasImage()`                          | A photo is on the stage.                                                                                          |
| `getState()`                          | `{ hasImage, zoom, rotation, straighten, flipX, flipY, aspectRatio, output, dirty }`.                             |
| `getZoom()` / `setZoom(z)`            | Zoom relative to cover: `1` fills the frame, up to `maxZoom`. Zooms about the frame centre.                       |
| `zoomIn()` / `zoomOut()`              | ±25 %.                                                                                                            |
| `rotate(deg = 90)`                    | Turn about the frame centre; positive is clockwise on screen, flips notwithstanding.                              |
| `setStraighten(deg)`                  | Fine rotation, −45…45.                                                                                            |
| `flipHorizontal()` / `flipVertical()` | Mirror what's in the frame about its centre line.                                                                 |
| `reset()`                             | Back to the freshly loaded photo: base aspect, cover zoom, centred, upright.                                      |
| `setAspectRatio(ratio \| null)`       | Lock a new aspect (or free the frame). Also becomes the Reset baseline.                                           |
| `setShape(shape)`                     | `'rect'` or `'circle'`.                                                                                           |
| `setHeight(px)`                       | Stage height; the content under the frame is preserved.                                                           |
| `getBlob(mime?, quality?)`            | The framed region at native resolution (capped by `maxOutput`) as a `Blob`. Default JPEG 0.92; circles force PNG. |
| `destroy()`                           | Remove listeners, revoke object URLs, empty the container.                                                        |

`CropperState.output` tells you the export size before exporting, handy for a "too small for a cover image" hint.

## Interactions

| Input                                    | Effect                                                       |
| ---------------------------------------- | ------------------------------------------------------------ |
| Drop a file anywhere, or click the stage | Load a photo (the toolbar's **Replace** does the same later) |
| Drag                                     | Pan the photo                                                |
| Pinch · wheel · slider · `+` `-`         | Zoom (wheel and pinch zoom about the pointer)                |
| Arrow keys, Shift for 10px               | Nudge the photo                                              |
| `R` / `Shift+R`                          | Rotate right / left                                          |
| `0` or double-click                      | Reset                                                        |
| Handles (free aspect only)               | Reshape the frame; it refills the stage on release           |

The rule-of-thirds grid shows only while the photo is being adjusted, and never for a circle. Reset appears in the
toolbar only once something has changed.

## Theming

Tokens follow the same convention as `@ottabase/ottadate`: shadcn/tailwind variables hold raw HSL channels, so they are
wrapped in `hsl()` with standalone fallbacks. Override any of them on `.ottacropper`:

```css
.ottacropper {
    --cr-stage: hsl(var(--overlay, 150 17% 7%)); /* photo surface, dark in every theme */
    --cr-dim: rgb(0 0 0 / 0.55); /* outside the frame */
    --cr-frame: rgb(255 255 255 / 0.92);
    --cr-grid: rgb(255 255 255 / 0.35);
    --cr-handle: #fff;
    --cr-radius: var(--radius, 0.5rem);
    --cr-btn-size: 2rem;
}
```

Every element carries a `data-slot` (`cropper`, `cropper-stage`, `cropper-frame`, `cropper-empty`, `cropper-toolbar`)
for Tier 1 theming. The stage is a muted dropzone while empty and becomes the dark photo surface once a picture lands,
so it never sits as a black block in a light dialog. Reduced-motion preferences disable every animation.

## Accessibility

The container is focusable with the keyboard map above; aspect buttons are a `radiogroup`; flips expose `aria-pressed`;
zoom and straighten are native range inputs. Toolbar controls are disabled, not hidden, until a photo loads so the
layout never jumps.

## Geometry

The headless math is exported for tests and custom UIs: `fitRect`, `coverScale`, `clampView`, `toImage` and the `View` /
`Rect` / `Point` types. A `View` is the photo's centre, scale, rotation and flips in stage pixels; flips are applied
after rotation so "flip horizontal" is always left-right on screen.

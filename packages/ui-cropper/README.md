# @ottabase/ui-cropper

Advanced vanilla image cropper: crop, flip, rotate, zoom with smooth transitions. Square/rect/circle viewfinder.
PNG/JPEG. Zero React. ~3–4 KB gzipped.

## Features

- 🎯 **Smooth interactions** - Slick transitions inspired by react-advanced-cropper
- 🔍 **Zoom support** - Mouse wheel zoom, programmatic zoom, smooth scaling
- ✨ **Resize handles** - Drag corner and edge handles to resize crop area
- 🎨 **Visual feedback** - Rule of thirds grid, resize handles, smooth animations
- 🔄 **Smart rotation** - Rotate 90° with smooth animated transitions, crop adjusts automatically
- 💯 **Perfect rotation handling** - Drag and resize work correctly in all rotation states (0°, 90°, 180°, 270°)
- 📐 **Flexible aspect ratios** - Freeform, square, landscape, portrait, or custom ratios
- 🎭 **Shape support** - Rectangular or circular crop viewfinder
- 🖱️ **Intuitive drag** - Drag to reposition, cursor changes for different actions

## Usage

```typescript
import { Cropper } from '@ottabase/ui-cropper';

const container = document.getElementById('cropper-root');
const cropper = new Cropper(container, {
    aspectRatio: 1, // square (default); use 16/9 for rect, null for freeform
    shape: 'rect', // 'rect' | 'circle'
    accept: 'image/png,image/jpeg',
    maxHeight: 400,
    zoom: 1, // initial zoom level
    minZoom: 0.5,
    maxZoom: 3,
    transitions: true, // smooth animations
    transitionDuration: 300, // ms
});

// User interactions:
// - Drag crop area to move
// - Drag corner/edge handles to resize
// - Mouse wheel to zoom
// - Use zoom/flip/rotate buttons

const blob = await cropper.getBlob('image/jpeg', 0.92);
// upload blob...

cropper.destroy();
```

## API

### Methods

| Method                       | Description                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `flipHorizontal()`           | Flip image left-right with smooth transition                                   |
| `flipVertical()`             | Flip image top-bottom with smooth transition                                   |
| `rotate()`                   | Rotate 90° clockwise with smooth transition                                    |
| `zoomIn()`                   | Zoom in by 0.2x                                                                |
| `zoomOut()`                  | Zoom out by 0.2x                                                               |
| `setZoom(level)`             | Set zoom level (respects min/max zoom)                                         |
| `getZoom()`                  | Get current zoom level                                                         |
| `setAspectRatio(ratio)`      | Set aspect ratio (e.g. 1, 4/3, 16/9, null for freeform) with smooth transition |
| `setShape(shape)`            | Set viewfinder: 'rect' \| 'circle'                                             |
| `setMaxHeight(px)`           | Set max display height                                                         |
| `setPresetsVisible(visible)` | Show/hide aspect preset buttons                                                |
| `getBlob(mime?, quality?)`   | Export cropped image as Blob                                                   |
| `loadFromFile(file)`         | Load image from a File object                                                  |
| `loadFromUrl(url)`           | Load image from URL (http, blob:, or data: base64)                             |
| `destroy()`                  | Remove DOM and cleanup                                                         |

### Options

| Option               | Default                | Description                                                    |
| -------------------- | ---------------------- | -------------------------------------------------------------- |
| `aspectRatio`        | 1                      | 1 = square, 16/9 = landscape, null = freeform (no constraints) |
| `aspectPresets`      | Free, 1:1, 4:3, 16:9   | Preset buttons. Set `false` to hide.                           |
| `shape`              | 'rect'                 | 'rect' or 'circle' viewfinder                                  |
| `accept`             | 'image/png,image/jpeg' | File input accept                                              |
| `maxHeight`          | 400                    | Max display height (px) - honored even when zoomed             |
| `zoom`               | 1                      | Initial zoom level                                             |
| `minZoom`            | 0.5                    | Minimum zoom level                                             |
| `maxZoom`            | 3                      | Maximum zoom level                                             |
| `transitions`        | true                   | Enable smooth CSS transitions                                  |
| `transitionDuration` | 300                    | Transition duration in ms                                      |
| `onImageLoad`        | —                      | Callback fired whenever an image finishes loading              |

## Interactions

### Mouse/Touch

- **Drag crop area** - Click and drag inside the crop box to reposition (works for both rect and circle)
- **Resize crop** - Drag corner handles (nw, ne, sw, se) or edge handles (n, e, s, w)
    - Rectangle crops: Resize with aspect ratio constraints (or freeform if `aspectRatio: null`)
    - Circle crops: Always maintain 1:1 aspect ratio to keep circular shape
- **Zoom** - Use mouse wheel to zoom in/out (respects min/max zoom)
- **Cursor feedback** - Cursor changes to indicate available actions

### Buttons

- **Zoom +/-** - Zoom in/out by 0.2x increments
- **Flip H/V** - Flip image horizontally or vertically
- **Rotate** - Rotate 90° clockwise
- **Aspect presets** - Quick aspect ratio selection (Freeform, 1:1, 4:3, 16:9)

## Advanced Examples

### Custom presets

```typescript
import { Cropper, DEFAULT_ASPECT_PRESETS } from '@ottabase/ui-cropper';

new Cropper(container, {
    aspectPresets: [...DEFAULT_ASPECT_PRESETS, { label: '3:2', value: 3 / 2 }, { label: '21:9', value: 21 / 9 }],
});

// Or hide presets
new Cropper(container, { aspectPresets: false });

// Freeform (no aspect ratio constraints)
new Cropper(container, { aspectRatio: null });
```

### Programmatic zoom control

```typescript
const cropper = new Cropper(container);

// Zoom in
cropper.zoomIn();

// Set specific zoom level
cropper.setZoom(1.5);

// Get current zoom
const currentZoom = cropper.getZoom();
console.log(`Current zoom: ${currentZoom.toFixed(2)}x`);
```

### Custom transition timing

```typescript
new Cropper(container, {
    transitions: true,
    transitionDuration: 500, // slower, more dramatic
});

// Or disable transitions for instant updates
new Cropper(container, {
    transitions: false,
});
```

### Image load callback

```typescript
const cropper = new Cropper(container, {
    // Fires whenever an image loads — from the file picker, loadFromFile(), or loadFromUrl()
    onImageLoad: () => {
        console.log('Image ready');
        saveButton.disabled = false;
    },
});

// Also fires when loading from URL
cropper.loadFromUrl('https://example.com/photo.jpg');
```

### Rotation and transforms

```typescript
const cropper = new Cropper(container);

// Rotate 90° clockwise (with smooth animation)
cropper.rotate(); // 0° → 90° → 180° → 270° → 0°

// Flip transforms
cropper.flipHorizontal(); // Mirror left-right
cropper.flipVertical(); // Mirror top-bottom

// Change aspect ratio dynamically
cropper.setAspectRatio(16 / 9); // Landscape
cropper.setAspectRatio(1); // Square
cropper.setAspectRatio(null); // Freeform (no constraints)

// Drag and resize work perfectly in all rotation states
// The crop area automatically adjusts to new image dimensions
```

### Export cropped image

```typescript
const cropper = new Cropper(container);

// Export as JPEG (default quality: 0.92)
const jpegBlob = await cropper.getBlob('image/jpeg', 0.92);

// Export as PNG
const pngBlob = await cropper.getBlob('image/png');

// Upload to server
const formData = new FormData();
formData.append('image', jpegBlob, 'cropped.jpg');
await fetch('/api/upload', { method: 'POST', body: formData });

// Or create download link
const url = URL.createObjectURL(jpegBlob);
const a = document.createElement('a');
a.href = url;
a.download = 'cropped.jpg';
a.click();
URL.revokeObjectURL(url);
```

## Technical Details

### Rotation Handling

- Crop coordinates are maintained in **rotated/visible space** (what the user sees)
- Image is rotated using canvas transforms while crop overlay remains axis-aligned
- Drag and resize operations work correctly in all rotation states (0°, 90°, 180°, 270°)
- Export correctly maps crop coordinates back to original image space
- Smooth CSS transitions animate the canvas wrapper during rotation

### Performance

- Zero dependencies - pure vanilla JavaScript
- Efficient canvas rendering with requestAnimationFrame where appropriate
- Transitions disabled during drag/resize for responsive feel
- ~3-4 KB gzipped

## Inspiration

This cropper is inspired by [react-advanced-cropper](https://advanced-cropper.github.io/react-advanced-cropper/) with
its smooth transitions, zoom support, and polished user experience, but implemented as a framework-agnostic vanilla
JavaScript library with zero dependencies.

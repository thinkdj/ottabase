# @ottabase/ui-split-pane

Minimal, clean split-pane component for React applications with no frills.

## Features

- **Basic Split-Pane**: Horizontal and vertical split layouts
- **Nested Support**: Create complex layouts with nested split panes
- **Styled**: Customizable appearance with clean, minimal UI
- **Snap Points**: Configure snap positions for panes
- **Percentage Config**: Support for percentage-based sizing

## Installation

```bash
pnpm add @ottabase/ui-split-pane
```

## Usage

### Basic Example

```tsx
import { SplitPane } from '@ottabase/ui-split-pane';

function App() {
    return (
        <SplitPane split="vertical" defaultSize="50%">
            <div>Left Pane</div>
            <div>Right Pane</div>
        </SplitPane>
    );
}
```

### Nested Split Panes

```tsx
import { SplitPane } from '@ottabase/ui-split-pane';

function App() {
    return (
        <SplitPane split="vertical" defaultSize="50%">
            <div>Left Pane</div>
            <SplitPane split="horizontal" defaultSize="50%">
                <div>Top Right</div>
                <div>Bottom Right</div>
            </SplitPane>
        </SplitPane>
    );
}
```

### With Snap Points

```tsx
import { SplitPane } from '@ottabase/ui-split-pane';

function App() {
    return (
        <SplitPane split="vertical" defaultSize={300} snapPoints={[100, 200, 300]}>
            <div>Left Pane</div>
            <div>Right Pane</div>
        </SplitPane>
    );
}
```

> `snapPoints` only take effect when the pane is sized in pixels (as above). They are silently ignored when
> `defaultSize` is a percentage string like `'50%'`, since snap positions are pixel offsets and percentage-based
> panes never resolve to pixel values internally.

## API

### SplitPane Props

| Prop               | Type                         | Default      | Description                                     |
| ------------------ | ---------------------------- | ------------ | ----------------------------------------------- |
| `split`            | `'vertical' \| 'horizontal'` | `'vertical'` | Direction of the split                          |
| `defaultSize`      | `string \| number`           | `'50%'`      | Initial size of the first pane                  |
| `minWidth`         | `number`                     | `50`         | Minimum width in pixels (for vertical split)    |
| `maxWidth`         | `number`                     | `undefined`  | Maximum width in pixels (for vertical split)    |
| `minHeight`        | `number`                     | `50`         | Minimum height in pixels (for horizontal split) |
| `maxHeight`        | `number`                     | `undefined`  | Maximum height in pixels (for horizontal split) |
| `snapPoints`       | `number[]`                   | `[]`         | Array of snap positions in pixels               |
| `snapThreshold`    | `number`                     | `20`         | Distance to snap point before snapping          |
| `onChange`         | `(size: number) => void`     | `undefined`  | Callback when size changes                      |
| `className`        | `string`                     | `undefined`  | Additional CSS class for the container          |
| `resizerClassName` | `string`                     | `undefined`  | Additional CSS class for the resizer            |
| `children`         | `ReactNode`                  | required     | Two child elements to split                     |

## Theming

The resizer's built-in visual styling (divider color, hover tint, active/drag color, and the color transition) is
driven by CSS custom properties — `--border`, `--primary`, `--duration-normal`, `--ease` — that this package does
not define or ship a stylesheet for. They're expected to come from the host app's design system (e.g.
`@ottabase/ui-tailwind` / shadcn-style theme tokens, as used elsewhere in this monorepo). Outside that setup the
resizer remains fully functional (drag, keyboard resize, snapping) but renders with no visible divider color; use
`resizerClassName` or `resizerStyle` to supply your own styling instead.

## License

MIT

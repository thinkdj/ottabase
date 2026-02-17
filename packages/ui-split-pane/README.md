# @ottabase/ui-split-pane

Minimal, clean split-pane component for React applications with no frills.

## Features

- 🎯 **Basic Split-Pane**: Horizontal and vertical split layouts
- 🔄 **Nested Support**: Create complex layouts with nested split panes
- 🎨 **Styled**: Customizable appearance with clean, minimal UI
- 📍 **Snap Points**: Configure snap positions for panes
- 📊 **Percentage Config**: Support for percentage-based sizing

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
        <SplitPane split="vertical" defaultSize="50%" snapPoints={[100, 200, 300]}>
            <div>Left Pane</div>
            <div>Right Pane</div>
        </SplitPane>
    );
}
```

## API

### SplitPane Props

| Prop               | Type                         | Default      | Description                                                        |
| ------------------ | ---------------------------- | ------------ | ------------------------------------------------------------------ |
| `split`            | `'vertical' \| 'horizontal'` | `'vertical'` | Direction of the split                                             |
| `defaultSize`      | `string \| number`           | `'50%'`      | Initial size of the first pane                                     |
| `minSize`          | `number`                     | `50`         | Minimum size of a pane in pixels (deprecated)                      |
| `maxSize`          | `number`                     | `undefined`  | Maximum size of a pane in pixels (deprecated)                      |
| `minWidth`         | `number`                     | `undefined`  | Minimum width in pixels (for vertical split, overrides minSize)    |
| `maxWidth`         | `number`                     | `undefined`  | Maximum width in pixels (for vertical split, overrides maxSize)    |
| `minHeight`        | `number`                     | `undefined`  | Minimum height in pixels (for horizontal split, overrides minSize) |
| `maxHeight`        | `number`                     | `undefined`  | Maximum height in pixels (for horizontal split, overrides maxSize) |
| `snapPoints`       | `number[]`                   | `[]`         | Array of snap positions in pixels                                  |
| `snapThreshold`    | `number`                     | `20`         | Distance to snap point before snapping                             |
| `onChange`         | `(size: number) => void`     | `undefined`  | Callback when size changes                                         |
| `className`        | `string`                     | `undefined`  | Additional CSS class for the container                             |
| `resizerClassName` | `string`                     | `undefined`  | Additional CSS class for the resizer                               |
| `children`         | `ReactNode`                  | required     | Two child elements to split                                        |

## License

MIT

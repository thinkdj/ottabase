# @ottabase/hello-world

A simple, customizable React component that displays a friendly greeting message with beautiful default styling.

## Features

- Simple hello world component for quick testing
- Customizable text and styling
- Lightweight with no dependencies
- TypeScript support

## Installation

```bash
pnpm add @ottabase/hello-world
```

## Quick Start

```tsx
import { HelloBox } from '@ottabase/hello-world';

function App() {
  return (
    <div>
      <HelloBox />
    </div>
  );
}
```

## Common Use Cases

### Basic Usage

```tsx
import { HelloBox } from '@ottabase/hello-world';

<HelloBox />
```

### Custom Message

```tsx
<HelloBox message="Welcome to Ottabase!" />
```

### Custom Styling

```tsx
<HelloBox
  message="Hello World"
  className="custom-hello"
  style={{ fontSize: '24px', color: 'blue' }}
/>
```

## API Reference

### `HelloBox`

**Props:**
- `message?` - Custom greeting message (default: "Hello World!")
- `className?` - Additional CSS classes
- `style?` - Inline styles

## License

MIT

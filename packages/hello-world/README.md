# @ottabase/hello-world

A simple, customizable React component that displays a friendly greeting message. Perfect for demo pages, onboarding, or
placeholder content in development.

## Installation

```bash
pnpm add @ottabase/hello-world
```

## Quick Start

```tsx
import { HelloBox } from '@ottabase/hello-world';

export default function App() {
    return <HelloBox />;
}
```

## Usage

### Basic

Render with default message:

```tsx
<HelloBox />
```

### Custom Message

Override the greeting text:

```tsx
<HelloBox message="Welcome to our app!" />
```

### With Description

Add additional description text:

```tsx
<HelloBox message="Hello, World!" description="Get started by editing this component" />
```

### Custom Styling

Apply custom CSS classes:

```tsx
<HelloBox className="p-8 rounded-lg border border-blue-500" />
```

### Dark Mode

Supports dark mode via Tailwind:

```tsx
<div className="dark">
    <HelloBox />
</div>
```

## Examples

### In a Demo Page

```tsx
import { HelloBox } from '@ottabase/hello-world';

export function DemoPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="container mx-auto py-12">
                <HelloBox message="Feature Demo" description="Showcasing component usage" />
            </div>
        </div>
    );
}
```

### With Other Components

```tsx
import { HelloBox } from '@ottabase/hello-world';
import { Button } from '@ottabase/ui-shadcn';

export function Onboarding() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <HelloBox message="Welcome!" description="Let's get started" />
            <Button onClick={() => console.log('Next')}>Get Started</Button>
        </div>
    );
}
```

### Conditional Rendering

```tsx
import { HelloBox } from '@ottabase/hello-world';

export function App() {
    const [isLoading, setIsLoading] = useState(true);

    if (isLoading) {
        return <HelloBox message="Loading..." />;
    }

    return <MainApp />;
}
```

## Props

```typescript
interface HelloBoxProps {
    message?: string; // Greeting text (default: "Hello, World!")
    description?: string; // Optional description text
    className?: string; // Custom CSS classes
}
```

## Features

- ✨ Minimal and lightweight
- 🎨 Beautiful default styling
- 🌙 Dark mode support
- ♿ Accessible component
- 📱 Responsive design
- 🔧 Easy to customize

## License

MIT

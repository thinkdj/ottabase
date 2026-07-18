# @ottabase/hello-world

A simple, customizable React component that displays a friendly greeting message with beautiful default styling.

This package is a reference/template, not a component meant for use in ottabase apps. It exists to demonstrate the standard build → test → publish workflow for authoring a new `@ottabase` package (see `_STEPS.MD` for the full walkthrough); no app or other package in this monorepo depends on it.

## Installation

```bash
npm install @ottabase/hello-world
```

`react` and `react-dom` are peer dependencies and must already be installed in the consuming project.

## Usage

### Basic Usage

```tsx
import React from 'react';
import { HelloBox } from '@ottabase/hello-world';

function App() {
    return (
        <div>
            <HelloBox />
        </div>
    );
}

export default App;
```

### Props

| Prop        | Type                  | Default   | Description                             |
| ----------- | --------------------- | --------- | ---------------------------------------- |
| `name`      | `string`               | `'World'` | Name to display in the greeting          |
| `className` | `string`               | `''`      | Additional CSS class on the outer `div`  |
| `style`     | `React.CSSProperties`  | `{}`      | Inline styles, merged over the defaults  |

```tsx
<HelloBox name="thinkdj" style={{ borderColor: '#28a745' }} />
```

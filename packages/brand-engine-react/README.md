# @ottabase/brand-engine-react

React bindings for Ottabase Brand Engine.

## Usage

```tsx
import { BrandProvider, useBrand } from '@ottabase/brand-engine-react';

function App() {
    return (
        <BrandProvider apiEndpoint="/api/brand" appId="my-app">
            <MyContent />
        </BrandProvider>
    );
}

function MyContent() {
    const { config, isLoading } = useBrand();
    return config ? <div>{config.brandName}</div> : null;
}
```

## API

- **BrandProvider** – Fetches brand config from API, applies theme, injects custom CSS
- **useBrand()** – Consumes brand config from context

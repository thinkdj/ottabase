# Optimization Guide

This document outlines the optimizations implemented in Ottabase for improving performance, reducing bundle size, and enhancing user experience.

## 1. FOUC Prevention (Flash of Unstyled Content)

### TanStack App (Vite)
A lightweight loading indicator has been added to `index.html` to prevent FOUC and improve perceived performance:

```html
<style>
  /* FOUC Prevention - Lightweight loading indicator */
  #app-loading {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    z-index: 9999;
  }
  
  @media (prefers-color-scheme: dark) {
    #app-loading {
      background: #0a0a0a;
    }
    #app-loading .spinner {
      border-top-color: #ffffff !important;
    }
  }
  
  #app-loading .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #f3f4f6;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  /* Hide loading indicator once React mounts */
  #root:not(:empty) ~ #app-loading {
    display: none;
  }
</style>

<div id="app-loading">
  <div class="spinner"></div>
</div>
```

**Benefits:**
- Shows immediate feedback to users
- Lightweight (< 1KB inline CSS)
- Supports dark mode automatically
- Hides automatically when React mounts

### Next.js App
Similar loading indicator added to `app/layout.tsx` with automatic cleanup on hydration.

## 2. Chunk Optimization & Tree Shaking

### Vite Configuration (TanStack App)

Improved `vite.config.ts` with granular chunk splitting:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: (id) => {
        if (id.includes("node_modules")) {
          // React ecosystem
          if (id.includes("react") || id.includes("react-dom")) {
            return "vendor-react";
          }
          
          // Mantine UI library
          if (id.includes("@mantine/")) {
            return "vendor-mantine";
          }
          
          // TanStack libraries
          if (id.includes("@tanstack/")) {
            return "vendor-tanstack";
          }
          
          // Radix UI - group all radix components together
          if (id.includes("@radix-ui/")) {
            return "vendor-radix";
          }
          
          // ... more vendor chunks
        }
        
        // App chunks by feature
        if (id.includes("/src/pages/demo/")) {
          const match = id.match(/\/pages\/demo\/([^\/]+)\//);
          if (match) {
            return `demo-${match[1]}`;
          }
        }
      },
    },
  },
}
```

**Results:**
- Radix UI components bundled together: ~0.27 KB (was 100+ separate chunks)
- Demo pages split by feature for better code splitting
- Vendor libraries properly grouped for better caching

### Next.js Configuration

Added Radix UI packages to `optimizePackageImports`:

```javascript
experimental: {
  optimizePackageImports: [
    // ... existing packages
    "@ottabase/ui-shadcn",
    "@radix-ui/react-accordion",
    "@radix-ui/react-alert-dialog",
    // ... all radix components
    "lucide-react",
  ],
}
```

### Package-Level Optimizations

Updated all UI packages with tree-shaking support:

**packages/ui-shadcn/package.json:**
```json
{
  "sideEffects": false,
  "scripts": {
    "build": "tsup src/index.ts src/providers.ts --format cjs,esm --clean --treeshake"
  }
}
```

**packages/ui-components/package.json:**
```json
{
  "sideEffects": false,
  "scripts": {
    "build": "tsup src/index.ts ... --format cjs,esm --dts --clean --treeshake"
  }
}
```

**packages/ui-mantine/package.json:**
```json
{
  "sideEffects": false,
  "scripts": {
    "build": "tsup src/index.ts src/provider.ts --format cjs,esm --dts --clean --treeshake"
  }
}
```

## 3. Best Practices

### For App Developers

1. **Import only what you need:**
   ```typescript
   // Good - specific imports
   import { Button, Card } from "@ottabase/ui-shadcn";
   
   // Avoid - importing everything
   import * as UI from "@ottabase/ui-shadcn";
   ```

2. **Use code splitting for routes:**
   - TanStack Router handles this automatically
   - Next.js App Router handles this automatically

3. **Lazy load heavy components:**
   ```typescript
   const HeavyComponent = lazy(() => import("./HeavyComponent"));
   ```

### For Package Authors

1. **Set `sideEffects: false` in package.json** if your package has no side effects
2. **Use `--treeshake` flag in tsup build scripts**
3. **Export individual components** rather than barrel exports when possible
4. **Minimize dependencies** to reduce bundle size

## 4. Performance Metrics

### Before Optimization
- **Dev mode:** 100+ separate Radix UI chunks in Network tab
- **Production:** Multiple small chunks per Radix component
- **Initial load:** Visible FOUC before React hydration

### After Optimization
- **Dev mode:** Reduced chunk count (Radix components bundled)
- **Production:** Single vendor-radix chunk (~0.27 KB)
- **Initial load:** Loading indicator shows immediately
- **Tree shaking:** Enabled across all UI packages

## 5. Monitoring & Validation

### Check Production Bundle
```bash
cd apps/ottabase-template-app-tanstack
pnpm build
```

Look for:
- Consolidated vendor chunks (vendor-react, vendor-radix, etc.)
- Feature-based demo page chunks
- No duplicate dependencies across chunks

### Check Dev Build
```bash
pnpm dev
```

Open Network tab in browser DevTools and verify:
- Fewer HTTP requests for component chunks
- Proper code splitting per route

## 6. Future Optimizations

- [ ] Implement dynamic imports for rarely-used features
- [ ] Add bundle analyzer to CI pipeline
- [ ] Optimize font loading strategy
- [ ] Implement service worker for offline support
- [ ] Add performance budgets to CI

# @ottabase/motion

Brand-kit-aware animation utilities for Ottabase. Provides transition presets, React hooks, and components powered by
[Motion](https://motion.dev) that automatically adapt to the active brand kit's motion tokens.

## Why Motion?

After evaluating the major options:

| Library                | Bundle Size  | React Support | CSS Var Integration | License     |
| ---------------------- | ------------ | ------------- | ------------------- | ----------- |
| **Motion** (motiondev) | ~2.5 kB core | First-class   | Excellent           | MIT         |
| Framer Motion          | ~32 kB       | First-class   | Good                | MIT         |
| GSAP                   | ~23 kB       | Plugin-based  | Manual              | Proprietary |

**Motion** (the successor to Framer Motion's open-source core) was chosen because:

- **Smallest bundle** — critical for Cloudflare Workers edge deployment
- **First-class React API** — `<motion.div>`, `AnimatePresence`, layout animations
- **CSS variable aware** — can read brand-kit tokens at runtime
- **Tree-shakeable** — only pay for what you use
- **TypeScript-first** — full type safety

## Installation

```bash
pnpm add @ottabase/motion
```

## Quick Start

```tsx
import { motion, AnimatePresence } from 'motion/react';
import { useBrandMotion } from '@ottabase/motion';

function DropdownMenu({ open, children }) {
    const presets = useBrandMotion();

    return <AnimatePresence>{open && <motion.div {...presets.fadeScale}>{children}</motion.div>}</AnimatePresence>;
}
```

## Available Presets

| Preset        | Use Case                          | Animation                |
| ------------- | --------------------------------- | ------------------------ |
| `fade`        | Overlays, modals backdrop         | Opacity fade             |
| `fadeUp`      | Toasts, notifications             | Fade + slide up          |
| `fadeDown`    | Dropdowns, select menus           | Fade + slide down        |
| `fadeScale`   | Popovers, context menus, tooltips | Fade + scale from center |
| `slideLeft`   | Sidebars, drawers (left)          | Slide from left edge     |
| `slideRight`  | Sidebars, drawers (right)         | Slide from right edge    |
| `scaleSpring` | Buttons, badges, toasts           | Scale with spring easing |

## Hooks

### `useBrandMotion()`

Returns all presets configured for the active brand kit:

```tsx
const presets = useBrandMotion();
// presets.fade, presets.fadeUp, presets.fadeScale, etc.
```

### `useTransitionPreset(name)`

Returns a single preset:

```tsx
const fadeUp = useTransitionPreset('fadeUp');
return <motion.div {...fadeUp}>Hello</motion.div>;
```

### `useMotionTokens()`

Returns raw motion token values for custom animations:

```tsx
const tokens = useMotionTokens();
// tokens.durationNormal, tokens.easingSpring, tokens.scaleFrom, etc.
```

## Per-Brand Personalities

Each brand kit defines its own motion personality through tokens:

| Token            | Default                             | Funky                            | Crisp                             | Neo                                |
| ---------------- | ----------------------------------- | -------------------------------- | --------------------------------- | ---------------------------------- |
| `durationNormal` | 200ms                               | 250ms                            | 150ms                             | 180ms                              |
| `easingSpring`   | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `cubic-bezier(0.2, 1.8, 0.4, 1)` | `cubic-bezier(0.32, 1.2, 0.5, 1)` | `cubic-bezier(0.22, 1.5, 0.36, 1)` |
| `scaleFrom`      | 0.95                                | 0.9                              | 0.98                              | 0.97                               |
| `slideOffset`    | 8px                                 | 16px                             | 4px                               | 6px                                |

The **Funky** brand gets larger, bouncier animations. **Crisp** gets subtle, fast transitions. These values are set in
the brand-engine theme JSON and injected as CSS custom properties.

## Pure Functions (No React)

For non-React use or server-side rendering:

```ts
import { buildPresets, parseDuration, parseEasing } from '@ottabase/motion';
import { DEFAULT_MOTION } from '@ottabase/brand-engine';

const presets = buildPresets(DEFAULT_MOTION);
const seconds = parseDuration('200ms'); // 0.2
const curve = parseEasing('cubic-bezier(0.4, 0, 0.2, 1)'); // [0.4, 0, 0.2, 1]
```

## CSS Custom Properties

The brand-engine injects these CSS variables that power the motion system:

```css
:root {
    --duration-fast: 100ms;
    --duration-normal: 200ms;
    --duration-slow: 400ms;
    --ease: cubic-bezier(0.4, 0, 0.2, 1);
    --ease-enter: cubic-bezier(0, 0, 0.2, 1);
    --ease-exit: cubic-bezier(0.4, 0, 1, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --scale-from: 0.95;
    --scale-to: 0.95;
    --slide-offset: 8px;
    --opacity-from: 0;
    --reduced-motion: reduce;
}
```

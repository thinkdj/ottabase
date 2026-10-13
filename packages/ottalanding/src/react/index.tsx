// Rendered entry: the three themes and the components that draw a page with them.
// LandingView is server-safe (the public site); LandingPreview is a client component (the admin).

export type { SectionProps, ShellProps, ThemeComponents } from './shared';
export { LandingView, THEME_COMPONENTS, type LandingViewProps } from './view';
export { LandingPreview, type LandingPreviewProps } from './preview';
export { SchemeToggle } from './scheme-toggle';
// The social-image renderer (canvas, not React) — browser-only, so it lives on this entry, not the root.
export { drawShareCard, wrapLines, type ShareCardScene } from '../share-card-draw';

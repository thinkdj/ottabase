// Browser surface for @ottabase/medialibrary: React, JSX, @tabler/icons-react and DOM globals.
// Isolated behind the `@ottabase/medialibrary/react` subpath so the pure root
// (`@ottabase/medialibrary`) stays free of React and the DOM — see ./index.ts.
export { MediaImmersiveLightbox } from './viewer/MediaImmersiveLightbox';
export { MediaLightbox } from './viewer/MediaLightbox';
export {
    MediaLightboxProvider,
    useMediaLightboxRegistration,
    useOptionalMediaLightbox,
} from './viewer/MediaLightboxProvider';
export type { MediaLightboxProviderProps } from './viewer/MediaLightboxProvider';
export { MediaPreview } from './viewer/MediaPreview';
export { ZoomableImage, type ZoomStartGesture } from './viewer/ZoomableImage';
// Deep-link hook (no JSX, but reads `window`).
export { useMediaLightboxUrlSync } from './viewer/useMediaLightboxUrlSync';
export type { MediaLightboxUrlSyncOptions } from './viewer/useMediaLightboxUrlSync';

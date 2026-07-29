// Rendered React surface for @ottabase/medialibrary.
// Everything exported here pulls in JSX and @tabler/icons-react, so it is
// isolated behind the `@ottabase/medialibrary/react` subpath. The pure root
// (`@ottabase/medialibrary`) imports ZERO rendered UI — see ./index.ts.
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

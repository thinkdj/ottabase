// ============================================================
// @ottabase/og — social images for any page
// ============================================================
// Headless: a card, a template that turns it into HTML, a renderer that turns the HTML into a
// PNG through Browser Rendering and keeps it in R2, a signed URL to ask for it, and the route
// that serves it. No React; the admin side of this (editing the template) is Ottabase Pro's
// og-studio.
// ============================================================

export {
    canonicalCard,
    CARD_FIELDS,
    CARD_LIMITS,
    cardFromParams,
    cardId,
    cardParams,
    httpUrl,
    isColor,
    OG_SIZE,
    type OgCard,
} from './card';
export { createOgPackage, OG_PACKAGE_KEY, type OgPackageOptions } from './manifest';
export {
    createOgRenderer,
    type OgBucket,
    type OgRendered,
    type OgRenderer,
    type OgRendererOptions,
    type OgTemplateChoice,
} from './renderer';
export { createOgRouter, registerOgTemplateSource, type OgRouterOptions, type OgTemplateSource } from './routes';
export { OG_BASE_PATH, ogImageUrl, SIGNATURE_PARAM, signCard, verifyCard } from './sign';
export {
    createOgTemplate,
    escapeHtml,
    renderOgHtml,
    TEMPLATE_VERSION,
    titleSize,
    type OgTemplate,
    type OgTemplateOptions,
} from './template';

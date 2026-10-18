/**
 * @ottabase/legal
 *
 * Parameterized, conditional legal pages for SaaS apps: one config produces Terms, Privacy (GDPR and CCPA clauses fold
 * in), Cookies, Acceptable Use, Refunds and a Sub-processors list. Clauses toggle on feature flags; apps override any
 * section. This root entry is headless: types, assembly, server-side HTML and the kernel package. React components
 * live behind `@ottabase/legal/react`, the stylesheet at `@ottabase/legal/styles.css`.
 *
 * The templates are a conventional starting point, not legal advice. Have counsel review them before publishing.
 */

export type {
    AssembledLegalDocument,
    LegalConfig,
    LegalDocId,
    LegalDocMeta,
    LegalFeatures,
    LegalSection,
    LegalSectionOverrides,
    SubProcessor,
    TocItem,
} from './types';

export { assembleLegalDocument, listLegalDocuments, resolveLegalSlug } from './assemble';
export { docEnabled, docIdOfSlug, LEGAL_DOC_ORDER, LEGAL_DOCS, type LegalDocDef } from './registry';
export {
    buildVars,
    DEFAULTS,
    interpolate,
    lastUpdatedFor,
    legalBaseOf,
    makeHeadingSlugger,
    slugify,
} from './interpolate';
export { extractToc } from './toc';
export {
    documentToHtml,
    documentToMarkdown,
    escapeHtml,
    indexToHtml,
    inlineToHtml,
    markdownToHtml,
    PAGE_STYLE,
    pageToHtml,
    renderLegalPage,
    safeHref,
} from './html';
export {
    emailAddressOf,
    legalConfigFromApp,
    validateLegalConfig,
    type AppLikeConfig,
    type LegalConfigInput,
} from './config';
export { createLegalPackage, LEGAL_PACKAGE_KEY, type LegalPackageOptions } from './manifest';

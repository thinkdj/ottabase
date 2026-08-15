/**
 * @ottabase/cf-pdf
 *
 * Headless contracts, route constants, and pure security helpers. Rendering is
 * isolated behind `/server`, Worker routing behind `/router`, and DOM work behind
 * `/client`, so importing this entrypoint never pulls runtime-specific code into a consumer.
 */

export type {
    CfPdfRequest,
    DomCaptureOptions,
    PdfGenerateOptions,
    PdfMargins,
    PdfMetadata,
    PdfPageFormat,
    PdfPuppeteerModule,
} from './types';
export { PDF_PAGE_FORMATS } from './types';
export {
    DEFAULT_PDF_RESOURCE_ORIGINS,
    normalizePdfResourceOrigins,
    sanitizeFileName,
    type PdfRenderErrorCode,
} from './security';

export { CF_PDF_BASE_PATH, CF_PDF_MAX_HTML_BYTES, CF_PDF_MAX_REQUEST_BYTES } from './constants';

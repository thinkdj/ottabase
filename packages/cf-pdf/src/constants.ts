/** Default route for the package's PDF response endpoint. */
export const CF_PDF_BASE_PATH = '/api/cf-pdf';

/** Bound the complete JSON request before it reaches Browser Rendering. */
export const CF_PDF_MAX_REQUEST_BYTES = 750 * 1024;

/** Bound the HTML portion after JSON parsing. */
export const CF_PDF_MAX_HTML_BYTES = 700 * 1024;

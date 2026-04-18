/**
 * Stub for @sentry/node in browser builds.
 * Vite aliases @sentry/node to this file so the real package (which uses node:inspector)
 * is never bundled. The logger's SentryTransport will catch the error and try
 * @sentry/browser instead, or show "Sentry SDK not found" if neither is installed.
 */
throw new Error(
    '@sentry/node is not available in the browser. Use @sentry/browser for client-side error tracking, or omit Sentry transport when Sentry is not installed.',
);

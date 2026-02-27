# @ottabase/error-page

Pretty print JavaScript errors as self-contained HTML pages — edge-runtime compatible.

Built for Cloudflare Workers and other edge runtimes where Node.js `fs` is unavailable.

## Features

- 🔥 Beautiful error pages with error type badges, expandable stack frames, and "Open in editor" links
- 🌗 Dark/light theme toggle (respects `prefers-color-scheme`)
- 📋 Request metadata display (method, URL, headers with sensitive masking)
- ⛓️ Error cause chain rendering (recursive)
- 🏷️ Extra error properties shown as inline badges
- 📄 Stack Trace / Raw JSON tab switching with copy-to-clipboard
- 🕒 Timestamp display for when the error occurred
- 🛡️ XSS-safe HTML escaping, circular reference handling
- ☁️ Zero Node.js dependencies — works in Cloudflare Workers and other edge runtimes

## Usage

```ts
import { ErrorPage } from '@ottabase/error-page';

try {
    await handleRequest();
} catch (error) {
    const errorPage = new ErrorPage();
    errorPage.addRequestMetadata(request);

    const html = errorPage.toHTML(error, { title: 'Worker Error' });
    return new Response(html, {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}
```

## API

### `new ErrorPage()`

Create a new ErrorPage instance.

### `errorPage.toHTML(error, options?)`

Render an error to a self-contained HTML page with:

- Error type badge and message
- Expandable stack trace frames (app frames highlighted)
- Raw JSON error view with copy-to-clipboard
- Error cause chain
- Metadata sections
- Dark/light theme toggle
- "Open in editor" links
- Timestamp

**Options:**

| Option     | Type     | Default                   | Description                            |
| ---------- | -------- | ------------------------- | -------------------------------------- |
| `title`    | `string` | `"An error has occurred"` | Page title / subtitle                  |
| `ide`      | `string` | `"vscode"`                | Code editor for file links             |
| `offset`   | `number` | `0`                       | Stack frames to skip                   |
| `cspNonce` | `string` | —                         | CSP nonce for inline style/script tags |

Supported editors: `vscode`, `sublime`, `atom`, `phpstorm`, `textmate`, `emacs`, `macvim`, or a custom URL template with
`%f`, `%l`, `%c` placeholders.

### `errorPage.group(name, sections)`

Add metadata sections (e.g., request info, environment).

```ts
errorPage.group('Request', {
    info: [
        { key: 'Method', value: 'POST' },
        { key: 'URL', value: '/api/users' },
    ],
    headers: [
        { key: 'content-type', value: 'application/json' },
        { key: 'user-agent', value: request.headers.get('user-agent') },
    ],
});
```

### `errorPage.addRequestMetadata(request)`

Automatically extract method, URL, and common headers from a `Request` object. Sensitive headers (`authorization`,
`cookie`) are automatically masked.

### `errorPage.toProductionHTML(status, options?)`

Render a minimal, production-safe error page. Does not expose stack traces, internal paths, or error details.

```ts
const html = errorPage.toProductionHTML(500, {
    title: 'Service Unavailable',
    message: 'We are currently undergoing maintenance.',
});
```

### `errorPage.parse(error, offset?)`

Parse an error into a structured `ParsedError` object without rendering HTML.

### `parseError(error, offset?)`

Standalone function to parse errors into structured objects.

### `renderHTML(parsedError, metadata?, options?)`

Standalone function to render a `ParsedError` to HTML.

### `renderProductionHTML(status, options?)`

Standalone function to render a minimal production error page.

## Integration with Cloudflare Worker

```ts
import { ErrorPage } from '@ottabase/error-page';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        try {
            return await handleRequest(request, env);
        } catch (err) {
            const isDev = !env.ENVIRONMENT || env.ENVIRONMENT === 'development';
            const errorPage = new ErrorPage();

            if (isDev) {
                errorPage.addRequestMetadata(request);
                const html = errorPage.toHTML(err, { title: 'Worker Error' });
                return new Response(html, {
                    status: 500,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            // Production: clean error page without internals
            const html = errorPage.toProductionHTML(500);
            return new Response(html, {
                status: 500,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        }
    },
};
```

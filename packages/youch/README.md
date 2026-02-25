# @ottabase/youch

Pretty print JavaScript errors as self-contained HTML pages — edge-runtime compatible.

Inspired by [poppinss/youch](https://github.com/poppinss/youch), built for Cloudflare Workers and other edge runtimes
where Node.js `fs` is unavailable.

## Usage

```ts
import { Youch } from '@ottabase/youch';

try {
    await handleRequest();
} catch (error) {
    const youch = new Youch();
    youch.addRequestMetadata(request);

    const html = youch.toHTML(error, { title: 'Worker Error' });
    return new Response(html, {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}
```

## API

### `new Youch()`

Create a new Youch instance.

### `youch.toHTML(error, options?)`

Render an error to a self-contained HTML page with:

- Error type badge and message
- Expandable stack trace frames (app frames highlighted)
- Raw JSON error view
- Error cause chain
- Metadata sections
- Dark/light theme toggle
- "Open in editor" links

**Options:**

| Option     | Type     | Default                   | Description                            |
| ---------- | -------- | ------------------------- | -------------------------------------- |
| `title`    | `string` | `"An error has occurred"` | Page title / subtitle                  |
| `ide`      | `string` | `"vscode"`                | Code editor for file links             |
| `offset`   | `number` | `0`                       | Stack frames to skip                   |
| `cspNonce` | `string` | —                         | CSP nonce for inline style/script tags |

Supported editors: `vscode`, `sublime`, `atom`, `phpstorm`, `textmate`, `emacs`, `macvim`, or a custom URL template with
`%f`, `%l`, `%c` placeholders.

### `youch.group(name, sections)`

Add metadata sections (e.g., request info, environment).

```ts
youch.group('Request', {
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

### `youch.addRequestMetadata(request)`

Automatically extract method, URL, and common headers from a `Request` object. Sensitive headers (`authorization`,
`cookie`) are automatically masked.

### `youch.parse(error, offset?)`

Parse an error into a structured `ParsedError` object without rendering HTML.

### `parseError(error, offset?)`

Standalone function to parse errors into structured objects.

### `renderHTML(parsedError, metadata?, options?)`

Standalone function to render a `ParsedError` to HTML.

## Integration with Cloudflare Worker

```ts
import { Youch } from '@ottabase/youch';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        try {
            return await handleRequest(request, env);
        } catch (err) {
            const isDev = env.ENVIRONMENT === 'development';

            if (isDev) {
                const youch = new Youch();
                youch.addRequestMetadata(request);
                const html = youch.toHTML(err, { title: 'Worker Error' });
                return new Response(html, {
                    status: 500,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            return new Response('Internal Server Error', { status: 500 });
        }
    },
};
```

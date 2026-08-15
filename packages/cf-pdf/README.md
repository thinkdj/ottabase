# @ottabase/cf-pdf

`@ottabase/cf-pdf` is a normal Ottabase package for secure HTML-to-PDF export on Cloudflare Workers. It combines:

- static DOM capture in the browser;
- bounded Cloudflare Browser Rendering through `@cloudflare/puppeteer`;
- strict attachment headers and safe filenames; and
- conservative incremental PDF Info metadata injection.

The package is split by runtime boundary:

| Import                      | Runtime | Purpose                                               |
| --------------------------- | ------- | ----------------------------------------------------- |
| `@ottabase/cf-pdf`          | Any     | Contracts, route constants, and pure security helpers |
| `@ottabase/cf-pdf/client`   | Browser | Static DOM capture and Blob downloads                 |
| `@ottabase/cf-pdf/react`    | Browser | Generic Tailwind workbench; host supplies transport   |
| `@ottabase/cf-pdf/server`   | Worker  | Browser Rendering lifecycle and PDF responses         |
| `@ottabase/cf-pdf/router`   | Worker  | Authenticated route and request-handler factories     |
| `@ottabase/cf-pdf/metadata` | Worker  | Classic-xref Info-dictionary injection                |

## Host registration

The host supplies its verified session resolver, Browser Rendering binding, Puppeteer loader, and rate limiter:

```ts
import type { BrowserWorker } from '@cloudflare/puppeteer';
import { CF_PDF_BASE_PATH, DEFAULT_PDF_RESOURCE_ORIGINS } from '@ottabase/cf-pdf';
import { createCfPdfRouter } from '@ottabase/cf-pdf/router';

const pdfRouter = createCfPdfRouter<CloudflareEnv>({
    resolveCaller: async (request, env) => {
        const session = await getVerifiedSession(request, env);
        return session?.user?.id ? { userId: session.user.id } : null;
    },
    getBrowserBinding: (env) => env.OBCF_BROWSER as unknown as BrowserWorker | undefined,
    loadPuppeteer: async () => (await import('@cloudflare/puppeteer')).default,
    rateLimit: (request, env, caller) => enforcePdfRateLimit(request, env, `cf-pdf:${caller.userId}`),
    getResourceOrigins: (request) => {
        const origin = new URL(request.url).origin;
        return origin.startsWith('https:') ? [origin, ...DEFAULT_PDF_RESOURCE_ORIGINS] : DEFAULT_PDF_RESOURCE_ORIGINS;
    },
});

app.mount(CF_PDF_BASE_PATH, pdfRouter);
```

Hosts with a custom dispatcher can use `createCfPdfRequestHandler()` instead and call the returned handler only for
`POST /api/cf-pdf`. Both factories use the same request validation and rendering path.

The package has no tables or models, so it does not require migrations, schema adapters, or OttaORM registration.

`@cloudflare/puppeteer` is an optional peer dependency. The consuming Worker imports it and passes the module through a
loader so Wrangler keeps its built-in-module resolution at the application boundary.

## Browser flow

`/client` does not make HTTP requests. It produces static HTML, which must be sent through the host application's one
authenticated API client:

```ts
import { captureDomAsHtml, downloadBlob } from '@ottabase/cf-pdf/client';

const html = captureDomAsHtml('document-to-export', {
    title: 'Quarterly report',
    pageSize: 'letter',
    fitWidth: true,
    fitHeight: true,
});

const pdf = await api<Blob>('/api/cf-pdf', {
    method: 'POST',
    body: { html, fileName: 'quarterly-report' },
    headers: { Accept: 'application/pdf' },
    responseType: 'blob',
});

downloadBlob(pdf, 'quarterly-report.pdf');
```

## Generic React workbench

The rendered demo is available without an Ottabase UI or router dependency. The host only supplies the authenticated
request function:

```tsx
import { CfPdfDemoPage } from '@ottabase/cf-pdf/react';

<CfPdfDemoPage
    requestPdf={(request) =>
        api('/api/cf-pdf', {
            method: 'POST',
            body: request,
            headers: { Accept: 'application/pdf' },
            responseType: 'blob',
        })
    }
/>;
```

The component uses plain HTML and Tailwind utility classes. Add the package source to the consuming app's Tailwind
`content` globs, or publish equivalent CSS for the component's classes.

Capture strips executable markup and event handlers, retains only configured HTTPS stylesheet origins, and converts CSS
`zoom` to `transform: scale()`. This is defense in depth; the Worker policy remains the security boundary.

## Worker flow

The route owns authentication, request bounds, and rate limiting. It never accepts resource origins or Browser Rendering
options from the client. The renderer disables JavaScript, injects a restrictive CSP, intercepts subrequests, and always
closes the Browser Rendering session.

`buildPdfResponse` copies the exact supplied byte view and emits `no-store`, `nosniff`, same-origin resource policy, and
an RFC 5987-safe `Content-Disposition` filename.

## Metadata

```ts
import { injectPdfInfoMetadata } from '@ottabase/cf-pdf/metadata';

const result = injectPdfInfoMetadata(pdf, {
    title: 'Quarterly report',
    author: 'Ottabase',
    subject: 'Quarterly report',
    keywords: 'Cloudflare, PDF',
});

const responseBytes = result.pdf;
```

Metadata injection supports the classic `xref` layout emitted by Chromium/Puppeteer and preserves source bytes as an
incremental update. Encrypted PDFs and cross-reference streams are returned unchanged with an explicit reason.

## Browser Rendering binding

```jsonc
{
    "browser": {
        "binding": "OBCF_BROWSER",
    },
}
```

Browser Rendering must be enabled for the deployment. Local Wrangler development may not provide the binding; the route
returns a stable configuration response instead of attempting an unbounded fallback.

## Validation

```bash
pnpm --filter @ottabase/cf-pdf lint
pnpm --filter @ottabase/cf-pdf type-check
pnpm --filter @ottabase/cf-pdf test --run
pnpm --filter @ottabase/cf-pdf build
```

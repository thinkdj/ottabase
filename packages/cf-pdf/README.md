# @ottabase/cf-pdf

Zero-dependency PDF generation toolkit for Cloudflare Workers. Captures a live DOM element as self-contained HTML,
renders it server-side via Puppeteer (Cloudflare Browser Rendering), and injects rich PDF metadata — all without any
external PDF library.

## Install

```bash
# From within the monorepo
pnpm add --filter @ottabase/your-app @ottabase/cf-pdf
```

In `package.json`:

```json
{ "@ottabase/cf-pdf": "workspace:*" }
```

## Sub-path Exports

| Import                      | Environment | Contents                                                                |
| --------------------------- | ----------- | ----------------------------------------------------------------------- |
| `@ottabase/cf-pdf`          | Any         | Shared types (`PdfMetadata`, `PdfGenerateOptions`, `DomCaptureOptions`) |
| `@ottabase/cf-pdf/metadata` | Server      | Binary PDF Info dictionary injection (`injectPdfInfoMetadata`)          |
| `@ottabase/cf-pdf/server`   | Server      | Puppeteer PDF rendering (`generatePdf`, `buildPdfResponse`)             |
| `@ottabase/cf-pdf/client`   | Browser     | DOM capture, zoom fix, download helpers                                 |

## Quick Start — Full Integration Example

A typical integration has **two parts**: a client-side capture + download trigger, and a server-side worker route that
renders the PDF. Here's a minimal end-to-end example.

### 1. Client-side — Capture DOM and request PDF

```ts
import type { PdfMetadata } from '@ottabase/cf-pdf';
import { captureDomAsHtml, fetchAndDownloadPdf } from '@ottabase/cf-pdf/client';

async function downloadPdf() {
    // Serialise the live DOM element + all page CSS into a self-contained HTML string.
    // The element must be rendered and visible when this is called.
    const html = captureDomAsHtml('preview-element', {
        title: 'My Report',
        pageSize: 'letter',
        containerSelector: '#preview-element > div', // optional: force full-width
    });

    // Build metadata to embed in the PDF's Info dictionary (Title, Author, etc.)
    const metadata: PdfMetadata = {
        title: 'Quarterly Report',
        author: 'Acme Corp',
        subject: 'Finance Q1 2026',
        keywords: 'finance, quarterly, 2026',
    };

    // POST the HTML + metadata to the worker, receive PDF blob, trigger download.
    // fetchAndDownloadPdf handles the full fetch → blob → <a> click flow.
    await fetchAndDownloadPdf('/api/pdf', { html, fileName: 'report', metadata }, 'report');
}
```

### 2. Server-side — Worker route that renders HTML → PDF

```ts
// ⚠️  CRITICAL: import puppeteer directly in the worker source file.
// Wrangler only resolves @cloudflare/puppeteer when the import is in worker code.
// See "Why pass puppeteer explicitly?" below.
import puppeteer from '@cloudflare/puppeteer';
import type { PdfMetadata } from '@ottabase/cf-pdf';
import { generatePdf, buildPdfResponse } from '@ottabase/cf-pdf/server';
import { injectPdfInfoMetadata } from '@ottabase/cf-pdf/metadata';

export async function handlePdf(request: Request, env: Env): Promise<Response> {
    const { html, fileName, metadata } = (await request.json()) as {
        html: string;
        fileName?: string;
        metadata?: PdfMetadata;
    };

    // 1. Render HTML → PDF bytes via Puppeteer.
    //    Pass the imported `puppeteer` module — this is required.
    let pdf = await generatePdf(html, env.OBCF_BROWSER, { puppeteer });

    // 2. Inject PDF metadata via zero-dep binary incremental update (non-fatal).
    if (metadata) {
        try {
            pdf = injectPdfInfoMetadata(pdf, metadata, {
                creator: 'MyApp by @author',
                producer: 'MyApp',
            });
        } catch {
            // Non-fatal — deliver the unmodified PDF on metadata injection failure.
        }
    }

    // 3. Return as an attachment download with correct headers.
    return buildPdfResponse(pdf, fileName ?? 'document');
}
```

## ⚠️ Critical: Why pass `puppeteer` explicitly?

Cloudflare's `@cloudflare/puppeteer` is a **built-in Wrangler module** (like `node:*`). Wrangler resolves it at bundle
time only when the `import` statement lives **directly in your worker source code**. A pre-built package dist file (like
`@ottabase/cf-pdf/server`) cannot `import('@cloudflare/puppeteer')` at runtime — the Workers runtime will throw
`No such module "@cloudflare/puppeteer"`.

**The fix:** `generatePdf()` accepts the puppeteer module as `options.puppeteer`. You import it in your worker route and
pass it through:

```ts
// ✅ CORRECT — import in worker source, pass to generatePdf
import puppeteer from '@cloudflare/puppeteer';
await generatePdf(html, env.OBCF_BROWSER, { puppeteer });

// ❌ WRONG — omitting puppeteer throws at runtime
await generatePdf(html, env.OBCF_BROWSER, {} as any); // throws "options.puppeteer is required"
```

This is a Cloudflare-specific constraint. The same dependency injection pattern applies to any built-in Wrangler module
consumed from a pre-built package.

## Cloudflare Binding Requirement

Server-side PDF generation requires the **Browser Rendering API** binding. Add to `wrangler.jsonc`:

```jsonc
{
    "browser": {
        "binding": "OBCF_BROWSER",
    },
}
```

And declare the type in `cloudflare-env.d.ts`:

```ts
interface CloudflareEnv {
    OBCF_BROWSER: Fetcher; // Browser Rendering API
}
```

Without the binding, `generatePdf` will fail. Your route should check for its presence and return a fallback response
(e.g. 503) so the client can degrade gracefully to `window.print()`.

## API Reference

### Types (`@ottabase/cf-pdf`)

#### `PdfMetadata`

```ts
interface PdfMetadata {
    title: string; // Document title — shown in PDF reader title bar
    author: string; // Author name or brand
    subject: string; // Short document description
    keywords: string; // Comma-separated keywords for search / ATS
}
```

#### `PdfGenerateOptions`

```ts
interface PdfGenerateOptions {
    puppeteer: any; // @cloudflare/puppeteer module — REQUIRED (see above)
    format?: string; // CSS page format (default: 'Letter')
    viewportWidth?: number; // Viewport width in px (default: 816 — US Letter @ 96dpi)
    viewportHeight?: number; // Viewport height in px (default: 1056)
    printBackground?: boolean; // Print backgrounds & images (default: true)
    margin?: { top?: string; right?: string; bottom?: string; left?: string }; // (default: all '0')
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'; // (default: 'networkidle0')
    fontTimeout?: number; // Max ms to wait for web fonts (default: 5000)
}
```

#### `DomCaptureOptions`

```ts
interface DomCaptureOptions {
    title?: string; // HTML <title> (default: 'Document')
    pageSize?: string; // @page size — 'letter', 'a4', 'legal' (default: 'letter')
    containerSelector?: string; // CSS selector to force max-width: 100%
    stripPrintMedia?: boolean; // Remove @media print rules (default: true)
    preconnectDomains?: string[]; // DNS hint domains (default: Google Fonts CDN)
    cssVariablePatterns?: string[]; // :root var prefixes to capture (default: ['--font-', '--typography-'])
}
```

### Metadata (`@ottabase/cf-pdf/metadata`)

| Function                                          | Description                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `injectPdfInfoMetadata(pdfBytes, meta, options?)` | Append a new Info dictionary via zero-dep incremental PDF update   |
| `toPdfString(text)`                               | Encode a JS string as a PDF string (ASCII literal or UTF-16BE hex) |
| `toPdfDate(date)`                                 | Format a Date as PDF date: `D:YYYYMMDDHHmmSS+00'00'`               |

**`injectPdfInfoMetadata` options:**

| Field      | Type   | Default      | Description                        |
| ---------- | ------ | ------------ | ---------------------------------- |
| `creator`  | string | `'cf-pdf'`   | `/Creator` field in the Info dict  |
| `producer` | string | `'cf-pdf'`   | `/Producer` field in the Info dict |
| `now`      | Date   | `new Date()` | Timestamp for CreationDate/ModDate |

### Server (`@ottabase/cf-pdf/server`)

| Function                              | Description                                             |
| ------------------------------------- | ------------------------------------------------------- |
| `generatePdf(html, binding, options)` | Full Puppeteer lifecycle: launch → render → PDF → close |
| `buildPdfResponse(pdf, fileName?)`    | Wrap PDF bytes in a `Response` with download headers    |

### Client (`@ottabase/cf-pdf/client`)

| Function                                         | Description                                           |
| ------------------------------------------------ | ----------------------------------------------------- |
| `captureDomAsHtml(elementId, options?)`          | Serialize live DOM + all CSS into self-contained HTML |
| `convertZoomToTransform(element)`                | Convert CSS `zoom` → `transform: scale()` for PDF     |
| `downloadBlob(blob, fileName)`                   | Trigger browser download from a Blob                  |
| `sanitizeFileName(name)`                         | Replace illegal filename chars with underscores       |
| `fetchAndDownloadPdf(endpoint, body, fileName?)` | POST JSON → receive PDF blob → trigger download       |

## How It Works

### DOM Capture (`captureDomAsHtml`)

1. Clones the target element (does not mutate the live DOM)
2. Converts CSS `zoom` → `transform: scale()` on the clone and all children
3. Collects every `CSSRule` from the page's stylesheets
4. Re-attaches external font `<link>` tags (Google Fonts, etc.) for Puppeteer to fetch
5. Captures `:root` CSS custom properties matching the configured patterns
6. Wraps everything in a self-contained `<!DOCTYPE html>` with `@page` geometry, print-color-adjust, and blank-page CSS
   guards

### Metadata Injection (`injectPdfInfoMetadata`)

Uses the PDF **incremental update** mechanism (PDF spec §7.5.6) — zero external dependencies:

1. Scans the source PDF for the last `startxref` offset and highest object number
2. Appends a new Info dictionary object (`/Title`, `/Author`, `/Subject`, `/Keywords`, `/Creator`, `/Producer`,
   `/CreationDate`, `/ModDate`)
3. Appends a minimal cross-reference section for that one new object
4. Appends a new trailer with `/Info` ref and `/Prev` chain to the previous xref

Works with PDF 1.4–2.0, cross-reference streams, and any Puppeteer/Chromium output. Non-ASCII strings (international
names, CJK, emoji) are encoded as UTF-16BE hex strings with BOM.

### Blank Page Prevention

`captureDomAsHtml` injects CSS guards that prevent Chromium's print renderer from emitting a trailing blank page:

```css
html,
body {
    height: fit-content !important;
    min-height: unset !important;
}
```

This is placed **both before and after** the collected page CSS to win the cascade over framework utilities like
Tailwind's `h-full`, `min-h-screen`, or Mantine's global body styles.

## Real-World Example: ResumeMe

The app uses this package for PDF export. See `/apps/resumeme` for a complete integration:

- **Worker route:** [`worker/routes/resume-pdf.ts`](../../apps/resumeme/worker/routes/resume-pdf.ts) — auth +
  validation + `generatePdf` + `injectPdfInfoMetadata` with branded creator/producer
- **Client export:** [`src/lib/resume-export.ts`](../../apps/resumeme/src/lib/resume-export.ts) — `captureDomAsHtml` +
  `fetchAndDownloadPdf` + resume-specific metadata derivation

## Testing

```bash
pnpm test --filter @ottabase/cf-pdf
```

Tests cover: `toPdfString` (8), `toPdfDate` (4), `injectPdfInfoMetadata` (12), `buildPdfResponse` (7),
`sanitizeFileName` (5) — 36 tests total.

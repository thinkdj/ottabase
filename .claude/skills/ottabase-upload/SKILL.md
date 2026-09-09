---
name: ottabase-upload
description:
    The Ottabase way to handle file uploads (@ottabase/ottaupload) backed by R2, without touching R2 multipart
    internals. Use for "upload a file/image", "file input", "attach a document", "drag-and-drop upload", "store to R2".
    Encodes the client hook + server handler split and the ownership/security rule.
---

# File uploads the Ottabase way

`@ottabase/ottaupload` hides R2 behind a simple contract: the browser POSTs `FormData` to `/api/upload`; the server
writes to R2. Never call R2 multipart directly from app code.

## Client

- Headless/vanilla: `uploadFile(file, options)` (`@ottabase/ottaupload`) — no React needed.
- React: `useFileUpload(options)` → `{ files, isUploading, addFiles, uploadAll, removeFile, retryUpload }`, plus
  `useDragAndDrop`.
- Common options: `maxFileSize`, `acceptedFileTypes`, `provider` (`'r2' | 'cloudflare-images'`), progress/result
  callbacks. (Callback names differ between the vanilla and hook APIs — check the README for the exact ones rather than
  guessing.)
- Do not hand-roll `fetch` (lint-banned); the upload helpers are the request path.

## Server

- The `/api/upload` route resolves the caller, then calls `uploadFileToR2(file, r2Client, options)` (or
  `uploadFileToCloudflareImages`). `r2Client` comes from `@ottabase/cf`. `generateKey(file)` customizes the object key.
- Retrieve/list via `getFileFromR2` / `listFilesFromR2`. The raw `R2Client` binding is reachable when genuinely needed.

## Gotchas

- **Ownership/tenant columns come from the resolved security context, never from upload metadata or a request header.**
  Deriving the owner/org from client-supplied fields is a tenant leak.
- Keep `wrangler.jsonc` and `cloudflare-env.d.ts` in sync for the R2 binding.
- Validate file type/size on the **server** too — client limits are a UX hint, not a trust boundary.

## Authoritative sources

`AGENTS.MD` → "Security Context" (ownership fields), "@ottabase/cf". `packages/ottaupload/README.md`,
`packages/medialibrary/README.md`. Full docs: `/llms-full.txt`.

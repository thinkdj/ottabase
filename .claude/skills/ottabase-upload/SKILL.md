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
- React: `useFileUpload(options)` → `{ files, isUploading, addFiles, uploadAll, removeFile, clearFiles, retryUpload }`,
  plus `useDragAndDrop` and the `<FileUploader>` component (`@ottabase/ottaupload/client`).
- Common options: `maxFileSize`, `acceptedFileTypes`, `provider` (`'r2' | 'cloudflare-images'`). Callbacks differ by
  API: vanilla `uploadFile` takes `onProgress`/`onSuccess`/`onError`; the hook takes `onUploadProgress`/
  `onUploadComplete`/`onUploadError`. `onUploadComplete` fires once per batch (including `autoUpload`) with only the
  files that actually uploaded.
- Do not hand-roll `fetch` (lint-banned); the upload helpers are the request path.

## Server

- The `/api/upload` route resolves the caller (session required), then calls `uploadFileToR2(file, r2Client, options)`
  (or `uploadFileToCloudflareImages`). `r2Client` is `createR2Client({ bucket: env.OBCF_R2 })` from `@ottabase/cf/r2`.
  Server options: `maxFileSize`, `allowedTypes`, `generateKey(file)` (object key), `getUrl(key)` (returned URL; default
  `/api/upload/file/<key>`, served by the app's `/api/upload/file/*` route). The app then records the upload via
  `persistUploadedMediaRecord` (media library).
- Retrieve/list via `getFileFromR2` / `listFilesFromR2`. The raw `R2Client` binding is reachable when genuinely needed.

## Gotchas

- **Ownership/tenant columns come from the resolved security context, never from upload metadata or a request header.**
  Deriving the owner/org from client-supplied fields is a tenant leak.
- Keep `wrangler.jsonc` and `cloudflare-env.d.ts` in sync for the R2 binding.
- Validate file type/size on the **server** too — client limits are a UX hint, not a trust boundary.

## Authoritative sources

`AGENTS.MD` → "Security Context" (ownership fields), "@ottabase/cf". `packages/ottaupload/README.md`,
`packages/medialibrary/README.md`. Full docs: `/llms-full.txt`.

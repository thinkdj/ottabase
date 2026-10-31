---
name: ottabase-upload
description:
    The Ottabase way to handle files and uploads (@ottabase/ottaupload's files service) backed by R2, without touching
    R2 directly. Use for "upload a file/image", "file input", "attach a document", "avatar", "drag-and-drop upload",
    "store to R2", "serve a private file". Encodes purposes, audiences, buckets and the ownership/security rules.
---

# Files the Ottabase way

Every user file goes through ONE object, the app's files service (`apps/*/ottabase/files.ts`, built with `createFiles`
from `@ottabase/ottaupload/server`). Never write user files to an R2 binding yourself.

## Declare a purpose

A kind of file is a `files` entry in the package's kernel manifest:

```typescript
files: [{ purpose: 'invoice', label: 'Invoices', audience: 'members', types: ['application/pdf'], maxBytes: 5 * 1024 * 1024 }],
```

- `audience`: `public` (anyone; public bucket `OBCF_R2`, served by key), `members` (the owning org) or `owner` (the
  uploader and admins); both private ones live in `OBCF_R2_PRIVATE`, which is never served by key.
- `types` are SNIFFED MIME types (the bytes decide, never `file.type` or the extension); `image/*` = the raster family.
- `variants: ['thumb' | 'card' | 'full']` for images (160/640/1600 px WebP via `OBCF_IMAGES`); `svg: true` only for
  purposes trusted admins write; `server: true` when only your own guarded route may write it.

## Client

- `POST /api/files` with multipart `file` + `purpose` (+ `title`, `altText`) answers `{ success, file }` (the view:
  `url`, `thumbnailUrl`, `previewUrl`, `id`, sniffed `mimeType`, `width`, `height`).
- Headless/vanilla: `uploadFile(file, { purpose })` (`@ottabase/ottaupload/utils`). React: `useFileUpload({ purpose })`,
  `useDragAndDrop`, `<FileUploader purpose="…">` (`@ottabase/ottaupload/client`).
- Edit with `PATCH /api/files/:id`, delete with `DELETE /api/files/:id`. List media rows with generic CRUD
  (`/api/ottaorm/media`, read-only; the view URLs are added).
- Do not hand-roll `fetch` (lint-banned).

## Server

- In a package route, after your own guard: `files.put(env, { purpose, owner, file })`. `owner` is
  `{ appId, userId, organizationId }` from the VERIFIED SESSION and server config, never from the request. A file the
  app owns (a logo, a generated card) has `userId: null` and records the uploader in `metadata`, so an account erasure
  (`removeOwned`) never deletes it.
- Public URLs from the service are absolute (a relative `R2_PUBLIC_URL` is resolved against `AUTH_URL`): safe to put in
  mail, social cards and exports.
- A package takes the service as an option (`files?: Files<Env>`); the app composition passes `files`. Never import the
  app's instance from a package.
- Store a public file's KEY on the row that uses it (or the media id for a private file); URLs come from
  `files.url(env, key)` / `files.view(env, record)`. Replacing a file is a new key: `files.remove` the old one.
- `files.signedUrl(env, id)` makes a link that opens one private file without a session (needs `FILES_SIGNING_SECRET`).
- `files.quarantine(env, id)` / `files.restore(env, id)` take a file out of circulation (admins; the media library has
  the buttons). A public file leaves the public bucket and its cached URLs are purged when the purge vars are set.
- System data (backups, error artifacts) is not a file: no media row; artifacts go to `OBCF_R2_PRIVATE`, backups to
  Vault's `OBCF_R2_VAULT`.

## Gotchas

- Keep `wrangler.jsonc` and `cloudflare-env.d.ts` in sync for `OBCF_R2`, `OBCF_R2_PRIVATE`, `OBCF_R2_VAULT`,
  `OBCF_IMAGES` (bindings are not inherited by named envs: every env block lists them).
- Client limits are a UX hint; the purpose's `types` and `maxBytes` are the trust boundary.
- `R2_PUBLIC_URL` is the public bucket's base URL (default `/api/files/public`); in production a custom domain on a
  separate registrable domain, with the nosniff + sandbox CSP Transform Rule (see `docs/CLOUDFLARE_DEPLOY.md`).

## Authoritative sources

`packages/ottaupload/README.md` (the whole system), `packages/kernel/README.md` (purposes), `AGENTS.MD` → "Security
Context" (ownership fields). Full docs: `/llms-full.txt`.

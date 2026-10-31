# @ottabase/ottaupload

Files for an Ottabase app: the browser side (drag-and-drop uploader, progress, hooks, a vanilla helper) and the server
side, **the files service**: one object every writer of user files goes through, which decides what a file really is,
strips what it should not carry, puts it in the right bucket, makes its variants, records it and serves it back to the
right people.

## The system in one page

| Audience  | Who may read                                              | Bucket            | Served by                                         |
| --------- | --------------------------------------------------------- | ----------------- | ------------------------------------------------- |
| `public`  | anyone (a CDN may cache it)                               | `OBCF_R2`         | key: `/api/files/public/<key>` or a custom domain |
| `members` | signed-in members of the owning organization, admins      | `OBCF_R2_PRIVATE` | id: `/api/files/:id`, after the check             |
| `owner`   | the uploader, admins of the file's organization, platform | `OBCF_R2_PRIVATE` | id: `/api/files/:id`, after the check             |

- **Every object in the public bucket is public by definition.** Nothing private is ever written there, so serving it by
  key (or from a custom domain with no Worker in front) leaks nothing.
- **The private bucket is never served by key.** Only `read()` opens it, after checking the viewer, or a signed `?t=`
  token minted for that one file.
- **System data is not a file.** Backups (Vault, in its own `OBCF_R2_VAULT`) and error artifacts never get a media row;
  artifacts go to the private bucket.

**Keys** are `<appId>/<purpose>/<id>.<ext>`: `id` is 32 hex chars from `crypto.randomUUID()` (the media row has the same
id) and `ext` comes from the sniffed type. Variants are `<appId>/<purpose>/<id>/<variant>.webp`. A key is never written
twice: replacing a file is a new key and a delete of the old one, so a year of immutable caching is always right. The
original filename lives only in the row.

**Purposes** are declared in kernel manifests (`files: [...]`, see `@ottabase/kernel`) and collected by the registry
like tables. A purpose names its audience, an allow-list of sniffed MIME types (`image/*` covers the raster family), a
byte cap, optional variants, `svg: true` for trusted admin purposes and `server: true` when only its own guarded route
writes it. otta-web declares `avatar`, `media`, `attachment`, `brand-asset` and `share-image`; packages declare their
own.

### The pipeline (`put`)

1. **Purpose**: unknown purposes are refused (400 `UNKNOWN_PURPOSE`).
2. **Quota**: one `SUM(fileSize)` over the owner's rows (the organization's, or the user's outside one). An owner at the
   limit is refused before a byte is read; one the file would push over is refused after (413 `QUOTA_EXCEEDED`).
3. **Byte cap while reading**: a stream is read with a counter and cancelled the moment it passes `maxBytes` (413
   `PAYLOAD_TOO_LARGE`).
4. **Sniff the real type** from magic bytes: JPEG, PNG, GIF, WebP, AVIF, MP4, WebM, PDF, ICO; text must be valid UTF-8
   without NULs and is told apart from SVG, HTML and XML. Never `file.type`, never the extension (CSV is the one label
   the name may pick, and only after the bytes proved plain text).
5. **Allow-list**: the sniffed type against the purpose's `types` (415 `UNSUPPORTED_TYPE`). SVG only where `svg: true`.
6. **Strip metadata** from raster images, in code, without re-encoding: JPEG APP1 (Exif, XMP) and APP13 (IPTC) go, and
   Orientation survives as a minimal EXIF holding only that tag; PNG `eXIf`, `tEXt`, `zTXt`, `iTXt` go; WebP `EXIF` and
   `XMP ` chunks go and the VP8X flags follow. Width and height are read from the headers (turned for orientations 5-8).
   **AVIF**, whose metadata sits in ISO-BMFF item boxes the code cannot rewrite, is re-encoded to WebP through the
   `OBCF_IMAGES` binding (WebP output never carries metadata) and that WebP is the stored original; without the binding
   it is refused (415). No unstripped original is ever stored.
7. **Write** to the audience's bucket with `httpMetadata`: the content type; `inline` disposition for raster images and
   video, `attachment` for everything else, PDF included (browsers' PDF viewers do not run under the sandbox CSP, and
   inline with the sandbox relaxed is the combination to avoid); `public, max-age=31536000, immutable` for public files,
   `private, no-store` otherwise.
8. **Variants** through the `OBCF_IMAGES` binding when it is bound: fixed widths thumb 160, card 640, full 1600, WebP,
   each made only when it is narrower than the original (a 500px image gets a thumb and nothing else; one whose width
   could not be read gets none). Without the binding there are no variants and every variant URL is the original's.
   There are no on-the-fly `/cdn-cgi/image` URLs: nobody can mint new sizes on your bill.
9. **Row**: the media record. A failed put deletes what it wrote, so nothing counts against the quota.

### Views

URLs are never stored. `view(record)` computes them: a public file's `url` is `<R2_PUBLIC_URL>/<key>` (default
`/api/files/public/<key>`), a private one's is `/api/files/<id>`; `thumbnailUrl` is the thumb variant and `previewUrl`
the card variant, else the original; `srcSet` (public raster images with variants) offers the variants, and the original
when no `full` was made, as width descriptors. Rows that reference a public file store its key; rows that reference a
private file store its media id.

**Content stores a `StoredFile`, never a URL.** A blog post, an editor block, a landing page or a menu item that holds
an uploaded image keeps `storedFileOf(view)` from `@ottabase/utils/media` (`{ key, width, height, variants }`), or a
plain string for an address someone typed. It renders through `imageSources(value)` (`src`, `srcSet`, `width`, `height`)
with a `sizes` for its layout, and `fileUrl(value, variant?)` where one URL is needed (`fileUrl(value)`, the original,
for og:image, feeds and mail, which do not all take WebP). The key format, the widths and the URL base live in
`@ottabase/utils/media`; the app calls `configureMedia({ publicUrl })` in the Worker per request and in the browser at
boot, so every URL follows `R2_PUBLIC_URL`.

**Public URLs are absolute.** A relative `R2_PUBLIC_URL` (the default `/api/files/public`) is resolved against the app's
public origin (the `origin` option; otta-web passes `AUTH_URL`), so a logo or an image works where the page is not: in
mail, social cards, exports. `publicBase(env)` is that base; `url()`, views, signed URLs and the quarantine purge list
all start with it, and `keyOf()` recognises a URL in either spelling. Without an origin they stay relative.

## Server

```typescript
// apps/otta-web/ottabase/files.ts: the app's one instance
import { mediaFileStore } from '@ottabase/ottaorm';
import { createFiles, quotaBytes, type FilesBucket } from '@ottabase/ottaupload/server';
import { getOttabaseConfig } from './config.loader';
import { packages } from './registry';

export const files = createFiles<CloudflareEnv>({
    appId: (env) => getOttabaseConfig(env).appId,
    purposes: () => packages.files(), // every manifest's `files`
    store: mediaFileStore, // the Media model
    buckets: (env) => ({
        public: (env.OBCF_R2 ?? null) as FilesBucket | null,
        private: (env.OBCF_R2_PRIVATE ?? null) as FilesBucket | null,
    }),
    images: (env) => env.OBCF_IMAGES, // optional: variants
    publicUrl: (env) => env.R2_PUBLIC_URL, // default /api/files/public
    origin: (env) => env.AUTH_URL, // relative public URLs are made absolute against it
    signingSecret: (env) => env.FILES_SIGNING_SECRET, // unset: no signed URLs
    quota: (env) => quotaBytes(env.FILES_QUOTA_MB), // default 1024 MB; a plan lookup goes here later
});
```

| Method                                          | Does                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `put(env, { purpose, owner, file, name?, ...})` | the pipeline above; resolves to the `FileView`, throws `FilesError` when refused       |
| `get(env, id)` / `view(env, record)`            | the record (this app's only) / the record with its URLs                                |
| `url(env, key)` / `keyOf(env, url)`             | public URL of a public key / the key behind one of this app's public URLs              |
| `signedUrl(env, id, { variant?, ttlSeconds? })` | `/api/files/<id>[/<variant>]?t=…`, readable without a session until it expires (1 h)   |
| `read(env, request, { id, variant, viewer })`   | public: 302 to its URL; private: the bytes if the viewer (or the token) may; Range/304 |
| `servePublic(env, request, key)`                | one key of the public bucket                                                           |
| `update(env, id, { title, altText, caption })`  | the describing text (trimmed, capped)                                                  |
| `remove(env, id)`                               | the file, its variants and its row                                                     |
| `removeOwned(env, { appId, userId })`           | everything one user uploaded (an account erase)                                        |
| `quarantine(env, id, { origin? })`              | stop serving it (see below); `{ file, purge, urls }`                                   |
| `restore(env, id)`                              | serve a quarantined file again                                                         |
| `purposes(env)` / `purpose(env, name)`          | the declared purposes                                                                  |

`owner` is `{ appId, userId, organizationId }` and **always comes from the verified session**, never from the request. A
file that belongs to the app rather than a person (brand logos, landing share images) has `userId: null` (and the owning
organization, if any): an account erasure (`removeOwned`) of whoever uploaded it must never take a live logo. Put the
uploader in `metadata` (`{ uploadedBy }`) and the audit log instead.

**Quarantine** takes a file out of circulation without deleting it. A public file's objects (original and variants) move
from the public bucket to the private one under the same keys, so neither `/api/files/public/*` nor the bucket's custom
domain has them; every read path refuses a `quarantined` row. Public files are cached as immutable, so their URLs also
have to leave the CDN: the `purge(env, urls)` option does that (otta-web calls Cloudflare's purge API with
`CLOUDFLARE_FILES_ZONE_ID` and `CLOUDFLARE_PURGE_API_TOKEN`). Without it, or when it fails, the result says
`purge: 'manual'` with the absolute `urls` to purge by hand. `restore` moves the objects back.
`canModerateFile(record, viewer)`: admins of the file's organization and platform admins. `FilesError` carries `status`
and `code` for `errorResponse`. Authorization helpers `canReadFile(record, viewer)` and `canChangeFile(record, viewer)`
(the uploader and admins) are exported for routes.

**Signed tokens** are `<exp>.<HMAC-SHA256>` over `['files.read', id, exp]` with `FILES_SIGNING_SECRET`: purpose-bound (a
signature minted for anything else never opens a file), bound to one file, expiring, verified in constant time, and
refused outright while the secret is unset.

A package that stores files takes the service as an option and the composition passes `files`:

```typescript
import type { Files } from '@ottabase/ottaupload/server';

export interface MyPackageOptions<Env> {
    files?: Files<Env>;
}

// in a route, after the package's own guard:
const view = await options.files!.put(env, { purpose: 'my-purpose', owner, file });
```

### Serving

`servePublicFile(bucket, request, key)` is the public route on its own (otta-landing uses it): the key must be plain
segments, the object is read with `onlyIf`/`range` from the request headers (ETag and If-Modified-Since → 304, Range →
206 with `Content-Range`, a range past the end → 416), and every response carries `X-Content-Type-Options: nosniff`,
`Content-Security-Policy: sandbox; default-src 'none'` and a `Content-Disposition` that is `inline` only for raster
images and video. `applySafeObjectHeaders(headers, filename)` sets those three on any response.

The pure pieces are exported too: `sniff`, `imageSize`, `stripMetadata`, `fileKey`, `signFileToken`, `verifyFileToken`,
`dispositionFor`. Key and URL helpers (`variantKey`, `fileIdFromKey`, `FILE_VARIANT_WIDTHS`, `DEFAULT_PUBLIC_FILES_URL`)
are in `@ottabase/utils/media`.

## The routes (otta-web)

| Route                                 | Who                                       | Does                                                                  |
| ------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| `POST /api/files`                     | a session; `OBCF_RATE_LIMITER_UPLOADS`    | multipart `file`, `purpose`, optional `title`, `altText` → `{ file }` |
| `GET\|HEAD /api/files/public/*`       | anyone                                    | the public bucket by key; no D1                                       |
| `GET\|HEAD /api/files/:id[/:variant]` | per audience, or a `?t=` token            | 302 for public files, the bytes (`private, no-cache`) otherwise       |
| `PATCH /api/files/:id`                | the uploader, org admins, platform admins | `{ title, altText, caption }`                                         |
| `DELETE /api/files/:id`               | the uploader, org admins, platform admins | the file; `server` purposes answer 409 (their row owns them)          |
| `POST /api/files/:id/quarantine`      | org admins of the file, platform admins   | quarantine (audited) → `{ file, purge, urls }`                        |
| `DELETE /api/files/:id/quarantine`    | org admins of the file, platform admins   | restore (audited)                                                     |
| `PUT\|DELETE /api/users/me/avatar`    | the session                               | sets or drops the avatar; deletes the previous file                   |

Uploads (here and the avatar route) have a limiter of their own, `OBCF_RATE_LIMITER_UPLOADS`: 60 a minute per user, so a
bulk media-library upload goes through; byte caps and the storage quota bound the volume. A production deploy without
the binding refuses uploads (500) rather than let them through uncounted.

Media rows are read through generic CRUD (`/api/ottaorm/media`, with the view URLs added); writes there are refused.

## Client

### React component

```tsx
import { FileUploader } from '@ottabase/ottaupload/client';

function App() {
    return (
        <FileUploader
            purpose="media" // default; sent with every file
            maxFiles={5}
            maxFileSize={10 * 1024 * 1024} // a hint: the purpose's cap is enforced on the server
            acceptedFileTypes={['image/*', 'application/pdf']}
            autoUpload
            onUploadComplete={(files) => console.log(files.map((f) => f.uploaded?.url))}
        />
    );
}
```

| Prop                | Type                                           | Default        | Description                                                                          |
| ------------------- | ---------------------------------------------- | -------------- | ------------------------------------------------------------------------------------ |
| `variant`           | `'dropzone' \| 'button'`                       | `'dropzone'`   | UI style                                                                             |
| `purpose`           | `string`                                       | `'media'`      | The file purpose                                                                     |
| `uploadEndpoint`    | `string`                                       | `'/api/files'` | API endpoint                                                                         |
| `maxFiles`          | `number`                                       | `1`            | Max file count                                                                       |
| `maxFileSize`       | `number`                                       | `undefined`    | Max size in bytes (UX hint)                                                          |
| `acceptedFileTypes` | `string[]`                                     | `undefined`    | MIME types (UX hint; the server sniffs)                                              |
| `autoUpload`        | `boolean`                                      | `false`        | Upload on select                                                                     |
| `disabled`          | `boolean`                                      | `false`        | Disable uploader                                                                     |
| `onUpload`          | `(files: File[]) => void`                      | -              | Custom upload handler                                                                |
| `onUploadComplete`  | `(files: UploadFile[]) => void`                | -              | Once per batch with the files that uploaded (`url`, `uploaded` set); skipped if none |
| `onUploadError`     | `(error: Error) => void`                       | -              | Error callback (the server's message: unsupported type, too large, over the quota)   |
| `onUploadProgress`  | `(progress: number, file: UploadFile) => void` | -              | Progress callback                                                                    |

### Hooks

```tsx
import { useDragAndDrop, useFileUpload } from '@ottabase/ottaupload';

const { files, isUploading, addFiles, uploadAll, removeFile, clearFiles, retryUpload } = useFileUpload({
    purpose: 'attachment',
    maxFiles: 5,
    autoUpload: true,
});

const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop } = useDragAndDrop({
    onDrop: (dropped) => addFiles(dropped),
    accept: ['image/*'],
    multiple: true,
});
```

### Vanilla JavaScript

For EditorJS tools, plain HTML, or any non-React context:

```typescript
import { uploadFile } from '@ottabase/ottaupload/utils';

const result = await uploadFile(file, {
    purpose: 'media', // default; endpoint defaults to /api/files
    maxFileSize: 10 * 1024 * 1024,
    acceptedFileTypes: ['image/*'],
    onProgress: (progress) => console.log(`${progress}%`),
    onSuccess: (response) => console.log(response.file?.url),
    onError: (error) => console.error(error.message),
});
```

## Validation helpers

```typescript
import {
    FILE_TYPES,
    formatFileSize,
    validateFiles,
    validateFileSize,
    validateFileType,
} from '@ottabase/ottaupload/validation';

validateFileType(file, ['image/*', FILE_TYPES.PDF]); // the browser's label: a UX check only
const { valid, errors } = validateFiles(files, { maxFiles: 5, maxFileSize: 10 * 1024 * 1024 });
formatFileSize(1048576); // "1 MB"
```

## Package structure

```
@ottabase/ottaupload  # Headless root: hooks + server, validation, types, utils (no rendered UI)
├── /client        # React components (FileUploader, FileUploadList, FileUploadItem)
├── /server        # The files service, sniffing, metadata stripping, serving, tokens
├── /validation    # Client-side validation and the upload config schema
├── /types         # Types (FilePurpose, FileRecord, FileView, FileStore, ...)
└── /utils         # Vanilla JS upload (non-React)
```

## License

MIT

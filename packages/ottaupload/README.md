# @ottabase/ottaupload

A file upload package with drag-and-drop UI, progress tracking, and multi-provider support for Cloudflare R2 and
Cloudflare Images.

## Features

- 🎨 **Clean UI** - Minimal shadcn/Notion-like design with dropzone and button variants
- 📤 **Drag & Drop** - Native drag-and-drop with visual feedback
- 📊 **Progress Tracking** - Real-time upload progress
- 🔄 **Multiple Files** - Batch upload with configurable limits
- ✅ **Validation** - File type and size validation with Zod schemas
- 🌐 **Multi-Provider** - Cloudflare R2 (all files) and Cloudflare Images (optimized images)
- 🪝 **React Hooks** - `useFileUpload` and `useDragAndDrop`
- 🎯 **Vanilla JS** - Non-React support for EditorJS and plain HTML
- 📦 **TypeScript** - Full type safety

## Installation

```bash
pnpm add @ottabase/ottaupload
```

## Quick Start

### React Component (Dropzone)

```tsx
import { FileUploader } from '@ottabase/ottaupload/client';

function App() {
    return (
        <FileUploader
            uploadEndpoint="/api/upload"
            maxFiles={5}
            maxFileSize={10 * 1024 * 1024} // 10MB
            acceptedFileTypes={['image/*', 'application/pdf']}
            autoUpload={true}
            onUploadComplete={(files) => console.log('Done!', files)}
        />
    );
}
```

### Button Variant

```tsx
<FileUploader variant="button" maxFiles={1} acceptedFileTypes={['image/*']} uploadEndpoint="/api/upload" />
```

### Vanilla JavaScript

```typescript
import { uploadFile } from '@ottabase/ottaupload/utils';

const result = await uploadFile(file, {
    endpoint: '/api/upload',
    maxFileSize: 10 * 1024 * 1024,
    onProgress: (progress) => console.log(`${progress}%`),
    onSuccess: (response) => console.log(response.url),
});
```

## Component API

### FileUploader Props

| Prop                | Type                                           | Default         | Description                      |
| ------------------- | ---------------------------------------------- | --------------- | -------------------------------- |
| `variant`           | `'dropzone' \| 'button'`                       | `'dropzone'`    | UI style                         |
| `maxFiles`          | `number`                                       | `1`             | Max file count                   |
| `maxFileSize`       | `number`                                       | `undefined`     | Max size in bytes                |
| `acceptedFileTypes` | `string[]`                                     | `undefined`     | MIME types (e.g., `['image/*']`) |
| `provider`          | `'r2' \| 'cloudflare-images'`                  | `'r2'`          | Upload provider                  |
| `uploadEndpoint`    | `string`                                       | `'/api/upload'` | API endpoint                     |
| `autoUpload`        | `boolean`                                      | `false`         | Auto-upload on select            |
| `disabled`          | `boolean`                                      | `false`         | Disable uploader                 |
| `onUpload`          | `(files: File[]) => void`                      | -               | Custom upload handler            |
| `onUploadComplete`  | `(files: UploadFile[]) => void`                | -               | Success callback                 |
| `onUploadError`     | `(error: Error) => void`                       | -               | Error callback                   |
| `onUploadProgress`  | `(progress: number, file: UploadFile) => void` | -               | Progress callback                |

## Providers

### Cloudflare R2 (Default)

For all file types. Requires `OBCF_R2` binding.

**Client:**

```tsx
<FileUploader uploadEndpoint="/api/upload" maxFiles={5} />
```

**Server:**

```typescript
import { uploadFileToR2 } from '@ottabase/ottaupload/server';
import { createR2Client } from '@ottabase/cf/r2';

const r2Client = createR2Client({ bucket: env.OBCF_R2 });
const result = await uploadFileToR2(file, r2Client, {
    maxFileSize: 50 * 1024 * 1024, // 50MB
});
```

### Cloudflare Images

For optimized image delivery with automatic variants.

**Environment:**

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

**Client:**

```tsx
<FileUploader provider="cloudflare-images" acceptedFileTypes={['image/*']} uploadEndpoint="/api/upload" />
```

**Server:**

```typescript
import { uploadFileToCloudflareImages } from '@ottabase/ottaupload/server';

const result = await uploadFileToCloudflareImages(
    file,
    {
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        apiToken: env.CLOUDFLARE_API_TOKEN,
        requireSignedURLs: false,
        metadata: { userId: 'user-123' },
    },
    {
        maxFileSize: 10 * 1024 * 1024,
    },
);
```

## Server Setup

### API Endpoint

```typescript
// cloudflare-worker.ts
import { uploadFileToR2, uploadFileToCloudflareImages } from '@ottabase/ottaupload/server';
import { createR2Client } from '@ottabase/cf/r2';

if (url.pathname === '/api/upload' && request.method === 'POST') {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const provider = formData.get('provider') || 'r2';

    if (provider === 'cloudflare-images') {
        const result = await uploadFileToCloudflareImages(file, {
            accountId: env.CLOUDFLARE_ACCOUNT_ID,
            apiToken: env.CLOUDFLARE_API_TOKEN,
        });
        return Response.json(result);
    }

    // R2 (default)
    const r2Client = createR2Client({ bucket: env.OBCF_R2 });
    const result = await uploadFileToR2(file, r2Client);
    return Response.json(result);
}
```

### File Operations

```typescript
// Upload
const result = await uploadFileToR2(file, r2Client);

// Download
import { getFileFromR2 } from '@ottabase/ottaupload/server';
const file = await getFileFromR2(key, r2Client);

// Delete
import { deleteFileFromR2 } from '@ottabase/ottaupload/server';
await deleteFileFromR2(key, r2Client);

// List
import { listFilesFromR2 } from '@ottabase/ottaupload/server';
const { files } = await listFilesFromR2(r2Client, { prefix: 'uploads/' });
```

## React Hooks

### useFileUpload

```tsx
import { useFileUpload } from '@ottabase/ottaupload/client';

const { files, isUploading, addFiles, uploadAll, removeFile, clearFiles, retryUpload } = useFileUpload({
    maxFiles: 5,
    maxFileSize: 10 * 1024 * 1024,
    uploadEndpoint: '/api/upload',
    autoUpload: true,
    onUploadComplete: (files) => console.log('Done!'),
});
```

### useDragAndDrop

```tsx
import { useDragAndDrop } from '@ottabase/ottaupload/client';

const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop } = useDragAndDrop({
    onDrop: (files) => console.log(files),
    accept: ['image/*'],
    multiple: true,
});
```

## Vanilla JavaScript

For EditorJS tools, plain HTML, or any non-React context:

```typescript
import { uploadFile, uploadFiles } from '@ottabase/ottaupload/utils';

// Single file
const result = await uploadFile(file, {
    endpoint: '/api/upload',
    provider: 'r2',
    maxFileSize: 10 * 1024 * 1024,
    acceptedFileTypes: ['image/*'],
    onProgress: (progress) => console.log(`${progress}%`),
    onSuccess: (response) => console.log(response.url),
    onError: (error) => console.error(error),
});

// Multiple files
const results = await uploadFiles([file1, file2], {
    endpoint: '/api/upload',
});
```

## Validation

### Validators

```typescript
import {
    validateFileSize,
    validateFileType,
    validateFiles,
    formatFileSize,
    generateFileKey,
    FILE_TYPES,
} from '@ottabase/ottaupload/validation';

// File size
validateFileSize(file, 10 * 1024 * 1024); // true/false

// File type
validateFileType(file, ['image/*', FILE_TYPES.PDF]); // true/false

// Multiple files
const { valid, errors } = validateFiles(files, {
    maxFiles: 5,
    maxFileSize: 10 * 1024 * 1024,
    acceptedFileTypes: ['image/*'],
});

// Utilities
formatFileSize(1048576); // "1 MB"
generateFileKey(file); // "my-file-1234567890-abc123.jpg"
generateFileKey(file, 'uploads'); // "uploads/my-file-1234567890-abc123.jpg"
```

### File Type Constants

```typescript
import { FILE_TYPES } from '@ottabase/ottaupload/validation';

FILE_TYPES.IMAGE_ALL; // 'image/*'
FILE_TYPES.IMAGE_JPEG; // 'image/jpeg'
FILE_TYPES.PDF; // 'application/pdf'
FILE_TYPES.VIDEO_ALL; // 'video/*'
FILE_TYPES.ZIP; // 'application/zip'
```

### Zod Schemas

```typescript
import { uploadConfigSchema, fileMetadataSchema, uploadResponseSchema } from '@ottabase/ottaupload/validation';

const config = uploadConfigSchema.parse({
    maxFiles: 5,
    maxFileSize: 10485760,
    autoUpload: true,
});
```

## Types

```typescript
import type {
    UploadFile,
    UploadConfig,
    UploadResponse,
    UploadProvider,
    UploadStatus,
    FileMetadata,
    CloudflareImagesConfig,
    CloudflareImagesResponse,
} from '@ottabase/ottaupload/types';
```

## Advanced Usage

### Custom Upload Handler

```tsx
<FileUploader
    onUpload={async (files) => {
        for (const file of files) {
            const result = await customUpload(file);
            console.log(result);
        }
    }}
/>
```

### Manual Control

```tsx
const { files, addFiles, uploadAll } = useFileUpload({ autoUpload: false });

<input type="file" onChange={(e) => addFiles(Array.from(e.target.files))} />
<button onClick={uploadAll}>Upload All</button>
```

### Retry Failed Uploads

```tsx
const { files, retryUpload } = useFileUpload();

{
    files.map((file) => (
        <div key={file.id}>
            {file.file.name} - {file.progress}%
            {file.status === 'error' && <button onClick={() => retryUpload(file.id)}>Retry</button>}
        </div>
    ));
}
```

## Package Structure

```
@ottabase/ottaupload
├── /client        # React components and hooks
├── /server        # Server-side utilities (R2, Cloudflare Images)
├── /validation    # Validation functions and Zod schemas
├── /types         # TypeScript type definitions
└── /utils         # Vanilla JS utilities (non-React)
```

## Provider Comparison

| Feature          | Cloudflare R2        | Cloudflare Images            |
| ---------------- | -------------------- | ---------------------------- |
| **File Types**   | All types            | Images only                  |
| **Optimization** | None                 | Automatic image optimization |
| **Variants**     | No                   | Multiple size variants       |
| **CDN**          | Manual setup         | Built-in global CDN          |
| **Use Case**     | General file storage | Optimized image delivery     |

## License

MIT

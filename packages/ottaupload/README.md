# @ottabase/ottaupload

Production-ready file upload package with drag-and-drop UI, progress tracking, and multi-provider support for Cloudflare R2 and Cloudflare Images.

## Features

- 🎨 **Clean UI** - Minimal shadcn/Notion-like design with dropzone and button variants
- 📤 **Drag & Drop** - Native drag-and-drop support with visual feedback
- 📊 **Progress Tracking** - Real-time upload progress with percentage display
- 🔄 **Multiple Files** - Batch upload support with configurable limits
- ✅ **Validation** - File type, size validation with Zod schemas
- 🌐 **Multi-Provider** - Cloudflare R2 (all files) and Cloudflare Images (optimized images)
- 🪝 **React Hooks** - `useFileUpload` and `useDragAndDrop` hooks
- 🎯 **Vanilla JS** - Non-React support for EditorJS tools and plain HTML
- 📦 **TypeScript** - Full type safety with TypeScript definitions
- 🔌 **Server Utils** - Ready-to-use server functions for R2 and Cloudflare Images

## Installation

```bash
pnpm add @ottabase/ottaupload
```

## Quick Start

### React Component

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

### Vanilla JavaScript

```typescript
import { uploadFile } from '@ottabase/ottaupload/utils';

const result = await uploadFile(file, {
  endpoint: '/api/upload',
  maxFileSize: 10 * 1024 * 1024,
  onProgress: (progress) => console.log(`${progress}%`),
});
```

## Component API

### FileUploader

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'dropzone' \| 'button'` | `'dropzone'` | UI style |
| `maxFiles` | `number` | `1` | Max file count |
| `maxFileSize` | `number` | `undefined` | Max size in bytes |
| `acceptedFileTypes` | `string[]` | `undefined` | MIME types (e.g., `['image/*']`) |
| `provider` | `'r2' \| 'cloudflare-images'` | `'r2'` | Upload provider |
| `uploadEndpoint` | `string` | `'/api/upload'` | API endpoint |
| `autoUpload` | `boolean` | `false` | Auto-upload on select |
| `disabled` | `boolean` | `false` | Disable uploader |
| `onUploadComplete` | `(files) => void` | - | Success callback |
| `onUploadError` | `(error) => void` | - | Error callback |

### Button Variant

```tsx
<FileUploader
  variant="button"
  maxFiles={1}
  acceptedFileTypes={['image/*']}
/>
```

## Providers

### Cloudflare R2 (Default)

For all file types. Requires `OBCF_R2` binding.

```tsx
<FileUploader uploadEndpoint="/api/upload" />
```

**Server:**
```typescript
import { uploadFileToR2 } from '@ottabase/ottaupload/server';
import { createR2Client } from '@ottabase/cf/r2';

const r2Client = createR2Client({ bucket: env.OBCF_R2 });
const result = await uploadFileToR2(file, r2Client, {
  maxFileSize: 50 * 1024 * 1024,
});
```

### Cloudflare Images

For optimized image delivery with automatic variants. Requires:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

```tsx
<FileUploader
  provider="cloudflare-images"
  acceptedFileTypes={['image/*']}
  uploadEndpoint="/api/upload"
/>
```

**Server:**
```typescript
import { uploadFileToCloudflareImages } from '@ottabase/ottaupload/server';

const result = await uploadFileToCloudflareImages(file, {
  accountId: env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: env.CLOUDFLARE_API_TOKEN,
  requireSignedURLs: false,
  metadata: { userId: 'user-123' }
}, {
  maxFileSize: 10 * 1024 * 1024,
});
```

## Server Setup

### API Endpoint

```typescript
// cloudflare-worker.ts
import { uploadFileToR2, uploadFileToCloudflareImages } from '@ottabase/ottaupload/server';

if (url.pathname === "/api/upload" && request.method === "POST") {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const provider = formData.get("provider") as string || "r2";

  if (provider === "cloudflare-images") {
    const result = await uploadFileToCloudflareImages(file, {
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CLOUDFLARE_API_TOKEN,
    });
    return jsonResponse({ success: true, url: result.url, key: result.key });
  }

  // R2 (default)
  const r2Client = createR2Client({ bucket: env.OBCF_R2 });
  const result = await uploadFileToR2(file, r2Client);
  return jsonResponse({ success: true, url: result.url, key: result.key });
}
```

### File Retrieval

```typescript
// R2
import { getFileFromR2 } from '@ottabase/ottaupload/server';
const file = await getFileFromR2(key, r2Client);

// Cloudflare Images
import { getFileFromCloudflareImages } from '@ottabase/ottaupload/server';
const image = await getFileFromCloudflareImages(imageId, config);
```

## React Hooks

### useFileUpload

```tsx
import { useFileUpload } from '@ottabase/ottaupload/client';

const {
  files,
  isUploading,
  addFiles,
  uploadAll,
  removeFile,
  clearFiles,
  retryUpload
} = useFileUpload({
  maxFiles: 5,
  maxFileSize: 10 * 1024 * 1024,
  uploadEndpoint: '/api/upload',
  provider: 'r2',
  autoUpload: true,
  onUploadComplete: (files) => console.log('Done!'),
  onUploadError: (error) => console.error(error),
});
```

### useDragAndDrop

```tsx
import { useDragAndDrop } from '@ottabase/ottaupload/client';

const { isDragging, dragHandlers } = useDragAndDrop({
  onFilesDropped: (files) => console.log(files),
  acceptedFileTypes: ['image/*'],
});

<div {...dragHandlers} className={isDragging ? 'highlight' : ''}>
  Drop files here
</div>
```

## Vanilla JavaScript

For non-React contexts (EditorJS, plain HTML):

```typescript
import { uploadFile, uploadFiles } from '@ottabase/ottaupload/utils';

// Single file
const result = await uploadFile(file, {
  endpoint: '/api/upload',
  provider: 'cloudflare-images',
  maxFileSize: 10 * 1024 * 1024,
  acceptedFileTypes: ['image/*'],
  onProgress: (progress) => console.log(`${progress}%`),
  onSuccess: (response) => console.log(response.url),
  onError: (error) => console.error(error),
});

// Multiple files
const results = await uploadFiles([file1, file2], {
  endpoint: '/api/upload',
  onProgress: (progress) => console.log(`${progress}%`),
});
```

### EditorJS Integration

```typescript
import { AdvancedImageTool } from '@ottabase/ottaeditor';

const editor = new EditorJS({
  tools: {
    image: {
      class: AdvancedImageTool,
      config: {
        provider: 'cloudflare-images',
        uploadEndpoint: '/api/upload',
        maxFileSize: 10 * 1024 * 1024,
      }
    }
  }
});
```

## Validation

### Built-in Validators

```typescript
import {
  validateFileSize,
  validateFileType,
  validateFiles,
  formatFileSize,
  generateFileKey
} from '@ottabase/ottaupload/validation';

// File size
const isValid = validateFileSize(file, 10 * 1024 * 1024);

// File type
const isImage = validateFileType(file, ['image/*']);

// Multiple files
const result = validateFiles(files, {
  maxFiles: 5,
  maxFileSize: 10 * 1024 * 1024,
  acceptedFileTypes: ['image/*', 'application/pdf']
});

// Utilities
const size = formatFileSize(1048576); // "1 MB"
const key = generateFileKey(file); // "2024/01/15/abc123-image.jpg"
```

### Zod Schemas

```typescript
import { fileUploadSchema } from '@ottabase/ottaupload/validation';

const result = fileUploadSchema.safeParse(file);
```

## Types

```typescript
import type {
  UploadFile,
  UploadConfig,
  UploadResponse,
  UploadProvider,
  FileMetadata,
  CloudflareImagesConfig,
  CloudflareImagesResponse
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

<button onClick={() => input.click()}>Select Files</button>
<button onClick={uploadAll}>Upload All</button>
```

### Retry Failed Uploads

```tsx
const { files, retryUpload } = useFileUpload();

{files.map(file => (
  <div key={file.id}>
    {file.status === 'error' && (
      <button onClick={() => retryUpload(file.id)}>Retry</button>
    )}
  </div>
))}
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

## License

MIT

# @ottabase/ottaupload

File upload package with drag-and-drop, progress tracking, and Cloudflare R2/Images integration.

## Features

- Drag-and-drop file upload with visual feedback
- Multiple file upload support (configurable)
- File type validation (configurable)
- File size validation
- Upload progress tracking
- Clean, minimal shadcn/Notion-like design
- TypeScript support
- Zod validation schemas
- Multiple provider support:
  - **Cloudflare R2** (default) - Object storage for all file types
  - **Cloudflare Images** - Optimized image delivery with automatic variants
- Database tracking via `@ottabase/db`

## Installation

```bash
pnpm add @ottabase/ottaupload
```

## Usage

### Basic File Uploader

```tsx
import { FileUploader } from '@ottabase/ottaupload/client';

function App() {
  return (
    <FileUploader
      onUpload={async (files) => {
        // Handle file upload
        console.log('Files to upload:', files);
      }}
      maxFiles={5}
      acceptedFileTypes={['image/*', 'application/pdf']}
      maxFileSize={10 * 1024 * 1024} // 10MB
    />
  );
}
```

### Browse Button Variant

```tsx
import { FileUploader } from '@ottabase/ottaupload/client';

function App() {
  return (
    <FileUploader
      variant="button"
      onUpload={async (files) => {
        // Handle file upload
      }}
    />
  );
}
```

## API

### FileUploader Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onUpload` | `(files: File[]) => Promise<void>` | Required | Callback when files are ready to upload |
| `variant` | `'dropzone' \| 'button'` | `'dropzone'` | Upload UI variant |
| `maxFiles` | `number` | `1` | Maximum number of files allowed |
| `acceptedFileTypes` | `string[]` | `undefined` | Accepted MIME types (e.g., `['image/*', 'application/pdf']`) |
| `maxFileSize` | `number` | `undefined` | Maximum file size in bytes |
| `provider` | `'r2' \| 'cloudflare-images'` | `'r2'` | Upload provider (R2 for all files, Cloudflare Images for optimized image delivery) |
| `disabled` | `boolean` | `false` | Disable the uploader |

## Provider Support

### Using Cloudflare R2 (Default)

R2 is the default provider for all file types. No configuration needed:

```tsx
import { FileUploader } from '@ottabase/ottaupload/client';

function App() {
  return (
    <FileUploader
      uploadEndpoint="/api/upload"
      maxFiles={5}
      autoUpload={true}
    />
  );
}
```

### Using Cloudflare Images

For image uploads, you can use Cloudflare Images for automatic optimization and delivery:

```tsx
import { FileUploader } from '@ottabase/ottaupload/client';

function App() {
  return (
    <FileUploader
      provider="cloudflare-images"
      uploadEndpoint="/api/upload"
      acceptedFileTypes={['image/*']}
      maxFiles={5}
      autoUpload={true}
    />
  );
}
```

### Server-Side Configuration

#### Cloudflare R2 Setup

```typescript
import { uploadFileToR2 } from '@ottabase/ottaupload/server';
import { createR2Client } from '@ottabase/cf/r2';

// Upload to R2
const r2Client = createR2Client({ bucket: env.OBCF_R2 });
const result = await uploadFileToR2(file, r2Client, {
  maxFileSize: 50 * 1024 * 1024, // 50MB
});
```

#### Cloudflare Images Setup

Configure environment variables:
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` - API token with Images permissions

```typescript
import { uploadFileToCloudflareImages } from '@ottabase/ottaupload/server';

// Upload to Cloudflare Images
const result = await uploadFileToCloudflareImages(file, {
  accountId: env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: env.CLOUDFLARE_API_TOKEN,
  requireSignedURLs: false,
  metadata: { userId: 'user-123' }
}, {
  maxFileSize: 10 * 1024 * 1024, // 10MB
});

if (result.success) {
  console.log('Image URL:', result.url); // Public variant URL
  console.log('Image ID:', result.key);
}
```

The API endpoint automatically handles both providers:

```typescript
// In your cloudflare-worker.ts
if (url.pathname === "/api/upload") {
  const formData = await request.formData();
  const file = formData.get("file");
  const provider = formData.get("provider") || "r2"; // Defaults to R2

  if (provider === "cloudflare-images") {
    // Upload to Cloudflare Images
  } else {
    // Upload to R2
  }
}
```

## Vanilla JavaScript Upload (Non-React)

For use in vanilla JavaScript contexts (e.g., EditorJS tools, plain HTML), use the utilities:

```typescript
import { uploadFile } from '@ottabase/ottaupload/utils';
import { validateFileType } from '@ottabase/ottaupload/validation';

// Upload file with progress tracking (R2 - default)
const result = await uploadFile(file, {
  endpoint: '/api/upload',
  provider: 'r2', // or 'cloudflare-images' for images
  maxFileSize: 10 * 1024 * 1024, // 10MB
  acceptedFileTypes: ['image/*'],
  onProgress: (progress) => {
    console.log(`Upload progress: ${progress}%`);
  },
  onSuccess: (response) => {
    console.log('Upload successful:', response.url);
  },
  onError: (error) => {
    console.error('Upload failed:', error.message);
  }
});

if (result.success) {
  console.log('File URL:', result.url);
}

// Upload to Cloudflare Images
const imageResult = await uploadFile(imageFile, {
  endpoint: '/api/upload',
  provider: 'cloudflare-images',
  acceptedFileTypes: ['image/*'],
  onProgress: (progress) => {
    console.log(`Uploading image: ${progress}%`);
  }
});
```

## License

MIT

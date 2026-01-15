# @ottabase/ottaupload

File upload package with drag-and-drop, progress tracking, and Cloudflare R2 integration.

## Features

- Drag-and-drop file upload with visual feedback
- Multiple file upload support (configurable)
- File type validation (configurable)
- File size validation
- Upload progress tracking
- Clean, minimal shadcn/Notion-like design
- TypeScript support
- Zod validation schemas
- Cloudflare R2 integration via `@ottabase/cf`
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
| `disabled` | `boolean` | `false` | Disable the uploader |

## Server Integration

```typescript
import { uploadFile, validateUpload } from '@ottabase/ottaupload/server';
import { fileUploadSchema } from '@ottabase/ottaupload/validation';

// Validate upload request
const result = fileUploadSchema.safeParse(request);

// Upload file to R2
const uploadResult = await uploadFile({
  file: file,
  r2Client: r2,
  bucket: 'my-bucket',
});
```

## Vanilla JavaScript Upload (Non-React)

For use in vanilla JavaScript contexts (e.g., EditorJS tools, plain HTML), use the utilities:

```typescript
import { uploadFile } from '@ottabase/ottaupload/utils';
import { validateFileType } from '@ottabase/ottaupload/validation';

// Upload file with progress tracking
const result = await uploadFile(file, {
  endpoint: '/api/upload',
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
```

## License

MIT

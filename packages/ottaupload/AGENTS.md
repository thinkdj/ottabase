# @ottabase/ottaupload — agent notes

File uploads: React drag-and-drop UI plus R2/Cloudflare Images server helpers. Full docs: ./README.md

## Use when

- Adding any upload flow: dropzone/button React component, upload hooks, vanilla JS uploader, or server-side R2 / Cloudflare Images handlers.
- NOT for direct R2 bucket ops without upload semantics — use @ottabase/cf instead.

## Imports

```typescript
import { FileUploader, FileUploadList, FileUploadItem } from '@ottabase/ottaupload/client';
import { useFileUpload, useDragAndDrop } from '@ottabase/ottaupload'; // root also re-exports all subpaths
import { uploadFile, uploadFiles } from '@ottabase/ottaupload/utils'; // vanilla JS, non-React
import {
    uploadFileToR2, getFileFromR2, deleteFileFromR2, listFilesFromR2,
    uploadFileToCloudflareImages, deleteFileFromCloudflareImages,
    createFileMetadata, parseFormDataFiles,
} from '@ottabase/ottaupload/server';
import { validateFiles, formatFileSize, generateFileKey, FILE_TYPES } from '@ottabase/ottaupload/validation';
```

## Canonical usage

```tsx
<FileUploader uploadEndpoint='/api/upload' maxFiles={5} acceptedFileTypes={['image/*']} />
```

```typescript
// Worker upload endpoint (R2, default provider)
import { uploadFileToR2 } from '@ottabase/ottaupload/server';
import { createR2Client } from '@ottabase/cf/r2';

const formData = await request.formData();
const file = formData.get('file') as File;
const r2Client = createR2Client({ bucket: env.OBCF_R2 });
const result = await uploadFileToR2(file, r2Client, { maxFileSize: 50 * 1024 * 1024 });
return Response.json(result);
```

## Gotchas

- react/react-dom are peer deps; /client and hooks need React installed.
- R2 provider needs the OBCF_R2 binding via createR2Client from @ottabase/cf/r2.
- Cloudflare Images provider needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN env vars.
- autoUpload defaults to false — selected files sit until upload is triggered.
- Server helpers return { success, error? } rather than throwing; wrap failures with errorResponse(...) from @ottabase/utils/http-errors in API routes.

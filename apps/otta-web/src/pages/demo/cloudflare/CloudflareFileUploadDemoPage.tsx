import { FileUploader } from '@ottabase/ottaupload/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { useState } from 'react';
import { toast } from 'sonner';
import { DemoPageHeader } from '../DemoPageHeader';

export function CloudflareFileUploadDemoPage() {
    const [uploadMode, setUploadMode] = useState<'dropzone' | 'button'>('dropzone');

    const handleUpload = async (files: File[]) => {
        console.log('Files to upload:', files);
    };

    // FileUploader uses XHR (not the global api client), so errors don't go through
    // the global onError/onUnauthorized handlers. Wire onUploadError to toast here.
    const handleUploadError = (error: Error) => {
        const message = error.message || 'Upload failed';
        const is401 = message.includes('401');
        toast.error(is401 ? 'Unauthorized' : 'Upload failed', {
            description: is401 ? 'You must be signed in to upload files.' : message,
        });
    };

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="File Upload Package"
                description="Demonstration of the @ottabase/ottaupload package with drag-and-drop, progress tracking, and Cloudflare R2 integration."
                backTo="/demo/cloudflare"
                backLabel="Back to Cloudflare Demos"
            />

            {/* Features */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Features</CardTitle>
                    <CardDescription>Key capabilities of the upload package</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="list-disc list-inside space-y-2 text-sm">
                        <li>Drag-and-drop file upload with visual feedback</li>
                        <li>Multiple file upload support (configurable)</li>
                        <li>File type and size validation using Zod</li>
                        <li>Upload progress tracking with real-time updates</li>
                        <li>Clean, minimal shadcn/Notion-like design</li>
                        <li>Cloudflare R2 integration via @ottabase/cf</li>
                        <li>TypeScript support with full type safety</li>
                        <li>Configurable UI variants (dropzone or button)</li>
                    </ul>
                </CardContent>
            </Card>

            {/* Mode Selector */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Upload Mode</CardTitle>
                    <CardDescription>Choose between dropzone or button upload variant</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="inline-flex rounded-lg bg-muted/40 p-0.5">
                        <button
                            type="button"
                            onClick={() => setUploadMode('dropzone')}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors duration-normal ${
                                uploadMode === 'dropzone'
                                    ? 'bg-background text-foreground ring-1 ring-border'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Dropzone
                        </button>
                        <button
                            type="button"
                            onClick={() => setUploadMode('button')}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors duration-normal ${
                                uploadMode === 'button'
                                    ? 'bg-background text-foreground ring-1 ring-border'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Button
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Single File Upload */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Single File Upload</CardTitle>
                    <CardDescription>Upload a single file with automatic upload</CardDescription>
                </CardHeader>
                <CardContent>
                    <FileUploader
                        variant={uploadMode}
                        maxFiles={1}
                        maxFileSize={10 * 1024 * 1024} // 10MB
                        autoUpload={true}
                        uploadEndpoint="/api/upload"
                        onUploadError={handleUploadError}
                    />
                </CardContent>
            </Card>

            {/* Multiple File Upload */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Multiple File Upload</CardTitle>
                    <CardDescription>Upload up to 5 files with manual upload trigger</CardDescription>
                </CardHeader>
                <CardContent>
                    <FileUploader
                        variant={uploadMode}
                        maxFiles={5}
                        maxFileSize={10 * 1024 * 1024} // 10MB
                        autoUpload={false}
                        uploadEndpoint="/api/upload"
                        onUploadError={handleUploadError}
                    />
                </CardContent>
            </Card>

            {/* Image-Only Upload */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Image-Only Upload</CardTitle>
                    <CardDescription>Upload images only with file type validation</CardDescription>
                </CardHeader>
                <CardContent>
                    <FileUploader
                        variant={uploadMode}
                        maxFiles={3}
                        maxFileSize={5 * 1024 * 1024} // 5MB
                        acceptedFileTypes={['image/*']}
                        autoUpload={true}
                        uploadEndpoint="/api/upload"
                        onUploadError={handleUploadError}
                    />
                </CardContent>
            </Card>

            {/* Custom Handler */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Custom Upload Handler</CardTitle>
                    <CardDescription>Use a custom upload handler instead of automatic upload</CardDescription>
                </CardHeader>
                <CardContent>
                    <FileUploader variant={uploadMode} maxFiles={3} onUpload={handleUpload} />
                    <p className="text-xs text-muted-foreground mt-2">
                        Check the browser console to see the uploaded files
                    </p>
                </CardContent>
            </Card>

            {/* Usage Example */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Usage Example</CardTitle>
                    <CardDescription>How to use the FileUploader component in your code</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs ring-1 ring-border">
                        <code>{`import { FileUploader } from '@ottabase/ottaupload/client';

function MyComponent() {
  return (
    <FileUploader
      variant="dropzone"
      maxFiles={5}
      maxFileSize={10 * 1024 * 1024}
      acceptedFileTypes={['image/*', 'application/pdf']}
      autoUpload={true}
      uploadEndpoint="/api/upload"
    />
  );
}`}</code>
                    </pre>
                </CardContent>
            </Card>

            {/* Package Information */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Package Details</CardTitle>
                    <CardDescription>Information about the @ottabase/ottaupload package</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4 text-sm">
                        <div>
                            <h4 className="font-semibold mb-1">Package Name</h4>
                            <code className="rounded bg-background px-2 py-1 ring-1 ring-border">
                                @ottabase/ottaupload
                            </code>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-1">Key Dependencies</h4>
                            <ul className="list-disc list-inside text-muted-foreground">
                                <li>@ottabase/cf - Cloudflare R2 integration</li>
                                <li>@ottabase/db - Database integration</li>
                                <li>zod - Schema validation</li>
                                <li>React - UI components</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-1">Exports</h4>
                            <ul className="list-disc list-inside text-muted-foreground">
                                <li>
                                    <code>@ottabase/ottaupload/client</code> - React components
                                </li>
                                <li>
                                    <code>@ottabase/ottaupload/server</code> - Server utilities
                                </li>
                                <li>
                                    <code>@ottabase/ottaupload/validation</code> - Zod schemas
                                </li>
                                <li>
                                    <code>@ottabase/ottaupload/types</code> - TypeScript types
                                </li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

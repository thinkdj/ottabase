import { FileUploader } from '@ottabase/ottaupload/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

export function CloudflareFileUploadDemoPage() {
    const [uploadMode, setUploadMode] = useState<'dropzone' | 'button'>('dropzone');

    const handleUpload = async (files: File[]) => {
        console.log('Files to upload:', files);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <Link
                    to="/demo/cloudflare"
                    className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
                >
                    ← Back to Cloudflare Demos
                </Link>
                <h1 className="text-4xl font-bold mb-2">File Upload Package</h1>
                <p className="text-muted-foreground">
                    Demonstration of the @ottabase/ottaupload package with drag-and-drop, progress tracking, and
                    Cloudflare R2 integration.
                </p>
            </div>

            {/* Features */}
            <Card>
                <CardHeader>
                    <CardTitle>Features</CardTitle>
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
            <Card>
                <CardHeader>
                    <CardTitle>Upload Mode</CardTitle>
                    <CardDescription>Choose between dropzone or button upload variant</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setUploadMode('dropzone')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                uploadMode === 'dropzone'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Dropzone
                        </button>
                        <button
                            type="button"
                            onClick={() => setUploadMode('button')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                uploadMode === 'button'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Button
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Single File Upload */}
            <Card>
                <CardHeader>
                    <CardTitle>Single File Upload</CardTitle>
                    <CardDescription>Upload a single file with automatic upload</CardDescription>
                </CardHeader>
                <CardContent>
                    <FileUploader
                        variant={uploadMode}
                        maxFiles={1}
                        maxFileSize={10 * 1024 * 1024} // 10MB
                        autoUpload={true}
                        uploadEndpoint="/api/upload"
                    />
                </CardContent>
            </Card>

            {/* Multiple File Upload */}
            <Card>
                <CardHeader>
                    <CardTitle>Multiple File Upload</CardTitle>
                    <CardDescription>Upload up to 5 files with manual upload trigger</CardDescription>
                </CardHeader>
                <CardContent>
                    <FileUploader
                        variant={uploadMode}
                        maxFiles={5}
                        maxFileSize={10 * 1024 * 1024} // 10MB
                        autoUpload={false}
                        uploadEndpoint="/api/upload"
                    />
                </CardContent>
            </Card>

            {/* Image-Only Upload */}
            <Card>
                <CardHeader>
                    <CardTitle>Image-Only Upload</CardTitle>
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
                    />
                </CardContent>
            </Card>

            {/* Custom Handler */}
            <Card>
                <CardHeader>
                    <CardTitle>Custom Upload Handler</CardTitle>
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
            <Card>
                <CardHeader>
                    <CardTitle>Usage Example</CardTitle>
                    <CardDescription>How to use the FileUploader component in your code</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
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
            <Card>
                <CardHeader>
                    <CardTitle>Package Details</CardTitle>
                    <CardDescription>Information about the @ottabase/ottaupload package</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4 text-sm">
                        <div>
                            <h4 className="font-semibold mb-1">Package Name</h4>
                            <code className="bg-gray-100 px-2 py-1 rounded">@ottabase/ottaupload</code>
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

export default function R2DemoPage() {
  return (
    <div className="min-h-screen bg-[#FBFBFA] p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-semibold text-gray-900">
            R2 Storage Demo
          </h1>
          <p className="text-gray-600">
            Object storage for file uploads and downloads
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-3 text-sm font-medium text-blue-900">Coming Soon</h3>
          <p className="mb-4 text-sm text-blue-700">
            This demo will showcase:
          </p>
          <ul className="space-y-2 text-sm text-blue-700">
            <li>• File upload to R2 bucket</li>
            <li>• File download from R2</li>
            <li>• List objects in bucket</li>
            <li>• Delete objects</li>
            <li>• Multipart upload for large files</li>
          </ul>
        </div>

        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Quick Start
          </h3>
          <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`import { createR2Client } from '@ottabase/cf/r2';

const r2 = createR2Client({ bucket: env.MY_BUCKET });

// Upload file
await r2.put('path/to/file.pdf', fileBuffer, {
  httpMetadata: { contentType: 'application/pdf' }
});

// Download file
const result = await r2.get('path/to/file.pdf');
if (result.success && result.data) {
  const content = await result.data.arrayBuffer();
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}

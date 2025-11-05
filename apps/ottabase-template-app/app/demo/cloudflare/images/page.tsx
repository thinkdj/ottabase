export default function ImagesDemoPage() {
  return (
    <div className="min-h-screen bg-[#FBFBFA] p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-semibold text-gray-900">
            Images Demo
          </h1>
          <p className="text-gray-600">
            Image upload, transformation, and optimization
          </p>
        </div>

        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-3 text-sm font-medium text-blue-900">
            Configuration Required
          </h3>
          <p className="mb-4 text-sm text-blue-700">
            Cloudflare Images requires API authentication (unlike other Worker bindings).
            To use Images in your application:
          </p>
          <ol className="space-y-2 text-sm text-blue-700">
            <li>1. Enable Cloudflare Images in your dashboard</li>
            <li>2. Get your Account ID from Cloudflare dashboard</li>
            <li>3. Create an API token with Images permissions</li>
            <li>4. Add credentials to your environment variables</li>
          </ol>
        </div>

        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Setup Instructions
          </h3>
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <p className="mb-2 font-medium text-gray-900">
                1. Add to your .env file:
              </p>
              <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`CF_ACCOUNT_ID=your-account-id
CF_API_TOKEN=your-api-token`}
              </pre>
            </div>

            <div>
              <p className="mb-2 font-medium text-gray-900">
                2. Initialize the Images client:
              </p>
              <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`import { createImagesClient } from '@ottabase/cf/images';

const images = createImagesClient({
  accountId: process.env.CF_ACCOUNT_ID!,
  apiToken: process.env.CF_API_TOKEN!
});`}
              </pre>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Usage Examples
          </h3>

          <div className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium text-gray-900">
                Upload an image
              </p>
              <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`// Upload from file
const result = await images.upload(imageFile, {
  id: 'custom-id', // optional
  requireSignedURLs: false,
  metadata: {
    alt: 'Product photo',
    category: 'products'
  }
});

if (result.success) {
  console.log('Image ID:', result.data.id);
  console.log('Variants:', result.data.variants);
}`}
              </pre>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-900">
                Get delivery URL
              </p>
              <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`// Get URL for a specific variant
const url = images.getDeliveryUrl(imageId, 'public');

// Custom variant with transformations
const customUrl = images.getDeliveryUrl(imageId, 'public', {
  width: 800,
  height: 600,
  fit: 'cover'
});`}
              </pre>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-900">
                Get image details
              </p>
              <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`const result = await images.get(imageId);

if (result.success) {
  console.log('Filename:', result.data.filename);
  console.log('Uploaded:', result.data.uploaded);
  console.log('Metadata:', result.data.metadata);
}`}
              </pre>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-900">
                List images
              </p>
              <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`const result = await images.list({
  page: 1,
  perPage: 50
});

if (result.success) {
  console.log('Images:', result.data.images);
  console.log('Total:', result.data.total);
}`}
              </pre>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-900">
                Delete an image
              </p>
              <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`const result = await images.delete(imageId);

if (result.success) {
  console.log('Image deleted successfully');
}`}
              </pre>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Features
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Automatic image optimization (WebP, AVIF)</li>
            <li>• On-the-fly resizing and transformations</li>
            <li>• Global CDN delivery</li>
            <li>• Custom variants for different use cases</li>
            <li>• Metadata support for image organization</li>
            <li>• Optional signed URLs for private images</li>
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            API Route Example
          </h3>
          <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`// app/api/images/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createImagesClient } from '@ottabase/cf/images';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  const images = createImagesClient({
    accountId: process.env.CF_ACCOUNT_ID!,
    apiToken: process.env.CF_API_TOKEN!
  });

  const result = await images.upload(file, {
    metadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString()
    }
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: result.data.id,
    url: images.getDeliveryUrl(result.data.id, 'public')
  });
}`}
          </pre>
        </div>

        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Implementation Notes
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Uses @ottabase/cf Images wrapper for type-safe operations</li>
            <li>• Requires API token (not a Worker binding)</li>
            <li>• Best used server-side to protect API credentials</li>
            <li>• Supports both direct uploads and URL-based uploads</li>
            <li>• Delivery URLs are publicly accessible (unless signed)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

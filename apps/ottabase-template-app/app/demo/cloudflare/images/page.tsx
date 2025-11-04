export default function ImagesDemoPage() {
  return (
    <div className="min-h-screen bg-[#FBFBFA] p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-semibold text-gray-900">
            Images Demo
          </h1>
          <p className="text-gray-600">
            Image upload, transformation, and optimization
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-3 text-sm font-medium text-blue-900">Coming Soon</h3>
          <p className="mb-4 text-sm text-blue-700">
            This demo will showcase:
          </p>
          <ul className="space-y-2 text-sm text-blue-700">
            <li>• Upload images to Cloudflare Images</li>
            <li>• Automatic image optimization</li>
            <li>• Generate delivery URLs</li>
            <li>• Custom variants (sizes/crops)</li>
            <li>• List and manage images</li>
          </ul>
        </div>

        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Quick Start
          </h3>
          <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`import { createImagesClient } from '@ottabase/cf/images';

const images = createImagesClient({
  accountId: env.CF_ACCOUNT_ID,
  apiToken: env.CF_API_TOKEN
});

// Upload image
const result = await images.upload(imageFile, {
  metadata: { alt: 'Product photo' }
});

// Get delivery URL
const url = images.getDeliveryUrl(
  result.data.id,
  'public'
);`}
          </pre>
        </div>
      </div>
    </div>
  );
}

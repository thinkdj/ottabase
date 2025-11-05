import Link from 'next/link';

export default function CloudflareDemoPage() {
  const demos = [
    {
      name: 'D1 Database',
      description: 'SQLite database with CRUD operations',
      href: '/demo/cloudflare/d1',
    },
    {
      name: 'KV Storage',
      description: 'Key-value storage with TTL support',
      href: '/demo/cloudflare/kv',
    },
    {
      name: 'R2 Storage',
      description: 'Object storage for file uploads',
      href: '/demo/cloudflare/r2',
    },
    {
      name: 'Images',
      description: 'Image upload and transformation',
      href: '/demo/cloudflare/images',
    },
    {
      name: 'Hyperdrive',
      description: 'Database connection pooling and acceleration',
      href: '/demo/cloudflare/hyperdrive',
    },
    {
      name: 'Queues',
      description: 'Message queue processing',
      href: '/demo/cloudflare/queues',
    },
    {
      name: 'Rate Limiting',
      description: 'Request throttling and protection',
      href: '/demo/cloudflare/rate-limiting',
    },
    {
      name: 'Realtime Pub/Sub',
      description: 'WebSocket-based real-time messaging with offline support',
      href: '/demo/cloudflare/realtime',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FBFBFA] p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-semibold text-gray-900">
            Cloudflare Features
          </h1>
          <p className="text-gray-600">
            Explore working examples of all Cloudflare bindings with @ottabase/cf
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {demos.map((demo) => (
            <Link
              key={demo.href}
              href={demo.href}
              className="group block rounded-lg border border-gray-200 bg-white p-6 transition-all hover:border-gray-300 hover:shadow-sm"
            >
              <h2 className="mb-2 text-lg font-medium text-gray-900 group-hover:text-gray-700">
                {demo.name}
              </h2>
              <p className="text-sm text-gray-500">{demo.description}</p>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-2 text-sm font-medium text-blue-900">
            Setup Required
          </h3>
          <p className="text-sm text-blue-700">
            Make sure you&apos;ve configured your Cloudflare bindings in{' '}
            <code className="rounded bg-blue-100 px-1 py-0.5">
              wrangler.jsonc
            </code>
            . See the{' '}
            <Link
              href="/docs/cloudflare-features"
              className="font-medium underline"
            >
              documentation
            </Link>{' '}
            for setup instructions.
          </p>
        </div>
      </div>
    </div>
  );
}

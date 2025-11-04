export default function RateLimitingDemoPage() {
  return (
    <div className="min-h-screen bg-[#FBFBFA] p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-semibold text-gray-900">
            Rate Limiting Demo
          </h1>
          <p className="text-gray-600">
            Request throttling and protection
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-3 text-sm font-medium text-blue-900">Coming Soon</h3>
          <p className="mb-4 text-sm text-blue-700">
            This demo will showcase:
          </p>
          <ul className="space-y-2 text-sm text-blue-700">
            <li>• Rate limit per user/IP</li>
            <li>• Custom rate limit windows</li>
            <li>• Check remaining requests</li>
            <li>• Handle 429 responses</li>
            <li>• Reset time information</li>
          </ul>
        </div>

        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Quick Start
          </h3>
          <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`import { createRateLimitingClient } from '@ottabase/cf/rate-limiting';

const limiter = createRateLimitingClient({
  rateLimiter: env.RATE_LIMITER
});

// Check rate limit
const result = await limiter.limit({
  key: \`user:\${userId}\`
});

if (!result.data.success) {
  return new Response('Too many requests', {
    status: 429,
    headers: {
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': result.data.resetAfter.toString()
    }
  });
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}

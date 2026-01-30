'use client';

import { useState } from 'react';
import Link from 'next/link';

interface RateLimitResult {
    success: boolean;
    message?: string;
    error?: string;
    limit: number;
    remaining: number;
    resetAfter: number;
}

export default function RateLimitingDemoPage() {
    const [key, setKey] = useState('demo-user-1');
    const [result, setResult] = useState<RateLimitResult | null>(null);
    const [requestCount, setRequestCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTestLimit = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/cloudflare/rate-limiting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key }),
            });

            const data = await response.json();

            if (response.status === 429) {
                setResult({
                    success: false,
                    error: data.error,
                    limit: data.limit,
                    remaining: data.remaining,
                    resetAfter: data.resetAfter,
                });
            } else if (!response.ok) {
                setError(data.error || 'Failed to test rate limit');
                setResult(null);
            } else {
                setResult({
                    success: true,
                    message: data.message,
                    limit: data.limit,
                    remaining: data.remaining,
                    resetAfter: data.resetAfter,
                });
            }

            setRequestCount((prev) => prev + 1);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    const handleRapidTest = async () => {
        setRequestCount(0);
        for (let i = 0; i < 15; i++) {
            await handleTestLimit();
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    };

    return (
        <div className="min-h-screen bg-[#FBFBFA] p-8">
            <div className="mx-auto max-w-3xl">
                <Link
                    href="/demo/cloudflare"
                    className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-8"
                >
                    ← Back to Cloudflare Features
                </Link>

                <div className="mb-8">
                    <h1 className="mb-2 text-3xl font-semibold text-gray-900">Rate Limiting Demo</h1>
                    <p className="text-gray-600">Request throttling and protection</p>
                </div>

                <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <h3 className="mb-2 text-sm font-medium text-blue-900">🔄 Local Development Fallback</h3>
                    <p className="text-sm text-blue-700">
                        <strong>Rate limiting uses KV-based simulation locally</strong> since Cloudflare's Rate Limiting
                        API requires production deployment. The KV fallback provides accurate rate limiting behavior (10
                        requests per 60 seconds). In production, this automatically uses Cloudflare's distributed Rate
                        Limiting API.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                <div className="mb-8 space-y-6 rounded-lg border border-gray-200 bg-white p-6">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-900">
                            Rate Limit Key (user ID, IP, etc.)
                        </label>
                        <input
                            type="text"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="user-123"
                            disabled={loading}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                        />
                        <p className="mt-1 text-xs text-gray-500">Different keys have separate rate limits</p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleTestLimit}
                            disabled={loading || !key}
                            className="flex-1 rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
                        >
                            {loading ? 'Testing...' : 'Test Rate Limit'}
                        </button>
                        <button
                            onClick={handleRapidTest}
                            disabled={loading || !key}
                            className="flex-1 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                        >
                            Rapid Test (15 requests)
                        </button>
                    </div>

                    {result && (
                        <div
                            className={`rounded-lg border p-4 ${
                                result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                            }`}
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <span
                                    className={`text-sm font-medium ${
                                        result.success ? 'text-green-900' : 'text-red-900'
                                    }`}
                                >
                                    {result.success ? '✓ Request Allowed' : '✗ Rate Limit Exceeded'}
                                </span>
                                <span className={`text-xs ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                                    Request #{requestCount}
                                </span>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className={result.success ? 'text-green-700' : 'text-red-700'}>Limit:</span>
                                    <span
                                        className={`font-medium ${result.success ? 'text-green-900' : 'text-red-900'}`}
                                    >
                                        {result.limit} requests
                                    </span>
                                </div>

                                <div className="flex justify-between text-sm">
                                    <span className={result.success ? 'text-green-700' : 'text-red-700'}>
                                        Remaining:
                                    </span>
                                    <span
                                        className={`font-medium ${result.success ? 'text-green-900' : 'text-red-900'}`}
                                    >
                                        {result.remaining} requests
                                    </span>
                                </div>

                                <div className="flex justify-between text-sm">
                                    <span className={result.success ? 'text-green-700' : 'text-red-700'}>
                                        Reset after:
                                    </span>
                                    <span
                                        className={`font-medium ${result.success ? 'text-green-900' : 'text-red-900'}`}
                                    >
                                        {result.resetAfter} seconds
                                    </span>
                                </div>

                                {/* Progress bar */}
                                <div className="mt-3">
                                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                                        <div
                                            className={`h-full transition-all ${
                                                result.success ? 'bg-green-500' : 'bg-red-500'
                                            }`}
                                            style={{
                                                width: `${(result.remaining / result.limit) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-gray-600">
                                        {result.remaining} of {result.limit} requests remaining
                                    </p>
                                </div>
                            </div>

                            {!result.success && (
                                <p className="mt-3 text-sm text-red-700">
                                    {result.error || 'Too many requests. Please try again later.'}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="mb-3 text-sm font-medium text-gray-900">How It Works</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                        <li>• Rate limits are configured per binding in wrangler.jsonc</li>
                        <li>• Each key (user ID, IP, etc.) has independent rate limits</li>
                        <li>• Requests return 429 status when limit is exceeded</li>
                        <li>• Response headers include limit, remaining, and reset info</li>
                        <li>• Limits reset automatically after the time window</li>
                    </ul>
                </div>

                <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="mb-3 text-sm font-medium text-gray-900">Implementation Notes</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                        <li>• Uses @ottabase/cf Rate Limiting wrapper for type-safe operations</li>
                        <li>• Supports custom keys for different rate limit scopes</li>
                        <li>• Returns detailed rate limit information in responses</li>
                        <li>• Local dev: Simulated with KV storage (10 req/60s)</li>
                        <li>• Production: Uses real Cloudflare Rate Limiting binding</li>
                        <li>• Perfect for protecting APIs from abuse</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

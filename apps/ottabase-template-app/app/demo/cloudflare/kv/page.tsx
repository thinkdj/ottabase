'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function KVDemoPage() {
    const [key, setKey] = useState('');
    const [value, setValue] = useState('');
    const [ttl, setTtl] = useState('');
    const [result, setResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSet = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!key || !value) return;

        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/cloudflare/kv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key,
                    value,
                    ttl: ttl ? parseInt(ttl) : undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to set value');
            }

            setResult('Value set successfully!');
            setValue('');
            setTtl('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const handleGet = async () => {
        if (!key) return;

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/cloudflare/kv?key=${encodeURIComponent(key)}`);

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to get value');
            }

            const data = await response.json();
            setResult(data.value ? `Value: ${data.value}` : 'Key not found');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!key) return;

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/cloudflare/kv?key=${encodeURIComponent(key)}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete value');
            }

            setResult('Value deleted successfully!');
            setKey('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FBFBFA] p-8">
            <div className="mx-auto max-w-2xl">
                <Link
                    href="/demo/cloudflare"
                    className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-8"
                >
                    ← Back to Cloudflare Features
                </Link>

                <div className="mb-8">
                    <h1 className="mb-2 text-3xl font-semibold text-gray-900">KV Storage Demo</h1>
                    <p className="text-gray-600">Key-value storage with optional TTL (Time To Live)</p>
                </div>

                <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
                    <h3 className="mb-2 text-sm font-medium text-green-900">✅ Full Local Development Support</h3>
                    <p className="text-sm text-green-700">
                        <strong>KV works perfectly in local Windows development</strong> via Wrangler's local KV. All
                        operations including TTL, JSON storage, and metadata work identically in local dev and
                        production.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {result && (
                    <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
                        <p className="text-sm text-green-700">{result}</p>
                    </div>
                )}

                <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-900">Key</label>
                        <input
                            type="text"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="my-key"
                            disabled={loading}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                        />
                    </div>

                    <form onSubmit={handleSet} className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-900">Value</label>
                            <textarea
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder="my-value"
                                disabled={loading}
                                rows={3}
                                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-900">
                                TTL (seconds, optional)
                            </label>
                            <input
                                type="number"
                                value={ttl}
                                onChange={(e) => setTtl(e.target.value)}
                                placeholder="3600"
                                disabled={loading}
                                min="1"
                                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !key || !value}
                            className="w-full rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
                        >
                            Set Value
                        </button>
                    </form>

                    <div className="flex gap-2">
                        <button
                            onClick={handleGet}
                            disabled={loading || !key}
                            className="flex-1 rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:bg-gray-100"
                        >
                            Get Value
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={loading || !key}
                            className="flex-1 rounded-lg bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-red-400"
                        >
                            Delete
                        </button>
                    </div>
                </div>

                <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="mb-3 text-sm font-medium text-gray-900">Implementation Notes</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                        <li>• Uses @ottabase/cf KV wrapper for type-safe operations</li>
                        <li>• Supports optional TTL for auto-expiring values</li>
                        <li>• Stores text values (JSON stringify for objects)</li>
                        <li>• Global edge network for low-latency reads</li>
                        <li>• Works locally with wrangler</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

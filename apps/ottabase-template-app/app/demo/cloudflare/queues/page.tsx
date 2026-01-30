'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface QueueMessage {
    key: string;
    userId?: string;
    action?: string;
    data?: unknown;
    sentAt: string;
    type: 'single' | 'batch';
}

export default function QueuesDemoPage() {
    const [userId, setUserId] = useState('');
    const [action, setAction] = useState('send-email');
    const [customData, setCustomData] = useState('');
    const [batchCount, setBatchCount] = useState(3);
    const [messages, setMessages] = useState<QueueMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadMessages = async () => {
        try {
            const response = await fetch('/api/cloudflare/queues');

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to load messages');
            }

            const data = await response.json();
            setMessages(data.messages || []);
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    };

    useEffect(() => {
        loadMessages();
        const interval = setInterval(loadMessages, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, []);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            const message: Record<string, unknown> = {
                action,
            };

            if (userId) {
                message.userId = userId;
            }

            if (customData) {
                try {
                    message.data = JSON.parse(customData);
                } catch {
                    message.data = customData;
                }
            }

            const response = await fetch('/api/cloudflare/queues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to send message');
            }

            setSuccess('Message sent to queue successfully!');
            setUserId('');
            setCustomData('');
            await loadMessages();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const handleSendBatch = async () => {
        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            const batch = Array.from({ length: batchCount }, (_, i) => ({
                userId: `user-${i + 1}`,
                action: 'batch-task',
                data: { taskNumber: i + 1 },
            }));

            const response = await fetch('/api/cloudflare/queues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to send batch');
            }

            setSuccess(`Sent ${batchCount} messages to queue successfully!`);
            await loadMessages();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FBFBFA] p-8">
            <div className="mx-auto max-w-4xl">
                <Link
                    href="/demo/cloudflare"
                    className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-8"
                >
                    ← Back to Cloudflare Features
                </Link>

                <div className="mb-8">
                    <h1 className="mb-2 text-3xl font-semibold text-gray-900">Queues Demo</h1>
                    <p className="text-gray-600">Async message queue processing</p>
                </div>

                <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                    <h3 className="mb-2 text-sm font-medium text-yellow-900">⚠️ Local Development Limitations</h3>
                    <p className="text-sm text-yellow-700">
                        <strong>Sending messages works locally</strong> via Wrangler. However, queue consumers (batch
                        processing) have limited support on Windows. Message delivery and consumer handlers work fully
                        in production on Cloudflare.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
                        <p className="text-sm text-green-700">{success}</p>
                    </div>
                )}

                <div className="mb-8 grid gap-6 md:grid-cols-2">
                    <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
                        <h2 className="text-lg font-semibold text-gray-900">Send Single Message</h2>

                        <form onSubmit={handleSendMessage} className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-900">
                                    User ID (optional)
                                </label>
                                <input
                                    type="text"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    placeholder="user-123"
                                    disabled={loading}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-900">Action</label>
                                <select
                                    value={action}
                                    onChange={(e) => setAction(e.target.value)}
                                    disabled={loading}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                                >
                                    <option value="send-email">send-email</option>
                                    <option value="process-order">process-order</option>
                                    <option value="generate-report">generate-report</option>
                                    <option value="sync-data">sync-data</option>
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-900">
                                    Custom Data (JSON, optional)
                                </label>
                                <textarea
                                    value={customData}
                                    onChange={(e) => setCustomData(e.target.value)}
                                    placeholder='{"key": "value"}'
                                    disabled={loading}
                                    rows={3}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-mono focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !action}
                                className="w-full rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
                            >
                                Send Message
                            </button>
                        </form>
                    </div>

                    <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
                        <h2 className="text-lg font-semibold text-gray-900">Send Batch</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-900">
                                    Number of Messages
                                </label>
                                <input
                                    type="number"
                                    value={batchCount}
                                    onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
                                    min="1"
                                    max="100"
                                    disabled={loading}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                                />
                            </div>

                            <div className="rounded-lg bg-gray-50 p-4">
                                <p className="mb-2 text-xs font-medium text-gray-700">Preview:</p>
                                <pre className="overflow-x-auto text-xs text-gray-600">
                                    {JSON.stringify(
                                        {
                                            userId: 'user-1',
                                            action: 'batch-task',
                                            data: { taskNumber: 1 },
                                        },
                                        null,
                                        2,
                                    )}
                                </pre>
                                <p className="mt-2 text-xs text-gray-500">...and {batchCount - 1} more messages</p>
                            </div>

                            <button
                                onClick={handleSendBatch}
                                disabled={loading || batchCount < 1}
                                className="w-full rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                            >
                                Send Batch ({batchCount} messages)
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">Recent Messages</h2>
                        <button
                            onClick={loadMessages}
                            disabled={loading}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:bg-gray-100"
                        >
                            Refresh
                        </button>
                    </div>

                    <p className="text-xs text-gray-500">
                        Messages are stored in KV for demo purposes and expire after 1 hour
                    </p>

                    {messages.length === 0 ? (
                        <p className="text-sm text-gray-500">No messages sent yet</p>
                    ) : (
                        <div className="space-y-2">
                            {messages.map((msg) => (
                                <div key={msg.key} className="rounded-lg border border-gray-200 p-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="mb-1 flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-900">
                                                    {msg.action || 'No action'}
                                                </span>
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                        msg.type === 'batch'
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-green-100 text-green-700'
                                                    }`}
                                                >
                                                    {msg.type}
                                                </span>
                                            </div>
                                            {msg.userId && <p className="text-xs text-gray-600">User: {msg.userId}</p>}
                                            {msg.data ? (
                                                <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                                                    {JSON.stringify(msg.data, null, 2)}
                                                </pre>
                                            ) : null}
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {new Date(msg.sentAt).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="mb-3 text-sm font-medium text-gray-900">Implementation Notes</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                        <li>• Uses @ottabase/cf Queues wrapper for type-safe operations</li>
                        <li>• Supports single and batch message sending</li>
                        <li>• Messages stored in KV for demo visibility (1 hour TTL)</li>
                        <li>• In production, messages are consumed by queue handlers</li>
                        <li>• Works locally with wrangler</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

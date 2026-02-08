import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createKVClient } from '@ottabase/cf/kv';
import { createQueuesClient } from '@ottabase/cf/queues';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// POST /api/cloudflare/queues - Send message(s) to queue
export async function POST(request: NextRequest) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_QUEUE) {
            return NextResponse.json({ error: 'Queue binding not configured' }, { status: 500 });
        }

        const body = await request.json();
        const { message, batch } = body;

        const queue = createQueuesClient({ queue: env.OBCF_QUEUE });

        if (batch && Array.isArray(batch)) {
            // Send batch of messages
            const messages = batch.map((msg: unknown) => ({
                body: msg,
            }));

            const result = await queue.sendBatch(messages);

            if (!result.success) {
                return NextResponse.json(
                    { error: 'Failed to send batch', details: result.error.message },
                    { status: 500 },
                );
            }

            // Store sent messages in KV for demo purposes (to display in UI)
            if (env.OBCF_KV) {
                try {
                    const kv = createKVClient({ namespace: env.OBCF_KV });
                    const timestamp = Date.now();

                    for (let i = 0; i < batch.length; i++) {
                        const key = `queue:message:${timestamp}:${i}`;
                        await kv.put(
                            key,
                            JSON.stringify({
                                ...batch[i],
                                sentAt: Date.now(),
                                type: 'batch',
                            }),
                            { expirationTtl: 3600 },
                        ); // Expire after 1 hour
                    }
                } catch (kvError) {
                    console.warn('Failed to store message in KV:', kvError);
                }
            }

            return NextResponse.json({
                success: true,
                message: `Sent ${batch.length} messages to queue`,
                count: batch.length,
            });
        }

        if (message) {
            // Send single message
            const result = await queue.send(message);

            if (!result.success) {
                return NextResponse.json(
                    { error: 'Failed to send message', details: result.error.message },
                    { status: 500 },
                );
            }

            // Store sent message in KV for demo purposes
            if (env.OBCF_KV) {
                try {
                    const kv = createKVClient({ namespace: env.OBCF_KV });
                    const key = `queue:message:${Date.now()}`;
                    await kv.put(
                        key,
                        JSON.stringify({
                            ...message,
                            sentAt: Date.now(),
                            type: 'single',
                        }),
                        { expirationTtl: 3600 },
                    );
                } catch (kvError) {
                    console.warn('Failed to store message in KV:', kvError);
                }
            }

            return NextResponse.json({
                success: true,
                message: 'Message sent to queue',
            });
        }

        return NextResponse.json({ error: 'Either message or batch is required' }, { status: 400 });
    } catch (error) {
        console.error('Queue POST error:', error);
        return NextResponse.json(
            {
                error: 'Failed to send message',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}

// GET /api/cloudflare/queues - Get recent messages (from KV for demo)
export async function GET() {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_KV) {
            return NextResponse.json({ error: 'KV binding not configured' }, { status: 500 });
        }

        const kv = createKVClient({ namespace: env.OBCF_KV });
        const listResult = await kv.list({ prefix: 'queue:message:' });

        if (!listResult.success) {
            return NextResponse.json({ error: 'Failed to list messages' }, { status: 500 });
        }

        const messages = [];
        for (const key of listResult.data.keys.slice(0, 20)) {
            const result = await kv.get(key.name);
            if (result.success && result.data) {
                try {
                    const message = JSON.parse(result.data as string);
                    messages.push({
                        key: key.name,
                        ...message,
                    });
                } catch {
                    // Skip invalid JSON
                }
            }
        }

        // Sort by sentAt descending
        messages.sort((a, b) => Number(b.sentAt) - Number(a.sentAt));

        return NextResponse.json({ messages });
    } catch (error) {
        console.error('Queue GET error:', error);
        return NextResponse.json(
            {
                error: 'Failed to get messages',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}

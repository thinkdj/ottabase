import { createKVClient } from '@ottabase/cf/kv';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { readJson } from '../lib/utils';
import { dispatch, dispatchBatch } from '@ottabase/queue';
import { incrementDispatchStats } from '../../ottabase/queue';
import type { CloudflareEnv } from '../../cloudflare-env';

export interface CloudflareQueueContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

export async function handleCloudflareQueue(context: CloudflareQueueContext): Promise<Response> {
    const { request, env } = context;

    if (request.method === 'POST') {
        if (!env.OBCF_QUEUE) {
            return errorResponse('Queue binding not configured', 500, {
                code: 'CONFIG_ERROR',
            });
        }

        const body = await readJson<{
            type?: string;
            payload?: unknown;
            message?: { action?: string; userId?: string; data?: unknown };
            batch?: Array<{ action?: string; userId?: string; data?: unknown }>;
            delay?: number;
        }>(request);

        if (body.type && body.payload !== undefined) {
            const result = await dispatch(
                env.OBCF_QUEUE,
                body.type,
                body.payload,
                body.delay ? { delay: body.delay } : undefined,
            );

            if (!result.success) {
                return errorResponse('Failed to dispatch job', 500, { details: result.error.message });
            }

            if (env.OBCF_KV) {
                try {
                    const kv = createKVClient({ namespace: env.OBCF_KV as any });
                    const key = `queue:message:${Date.now()}`;
                    await kv.put(
                        key,
                        JSON.stringify({
                            action: body.type,
                            data: body.payload,
                            sentAt: Date.now(),
                            type: 'single',
                        }),
                        { expirationTtl: 3600 },
                    );
                } catch {
                    // ignore
                }
            }

            await incrementDispatchStats(env, body.type);

            return jsonResponse({
                success: true,
                message: `Job dispatched: ${body.type}`,
            });
        }

        if (Array.isArray(body.batch)) {
            const jobs = body.batch.map((msg) => ({
                type: msg.action || 'batch-task',
                payload: { userId: msg.userId, data: msg.data, ...msg },
            }));

            const result = await dispatchBatch(env.OBCF_QUEUE, jobs);
            if (!result.success) {
                return errorResponse('Failed to dispatch batch', 500, {
                    details: result.error.message,
                });
            }

            if (env.OBCF_KV) {
                try {
                    const kv = createKVClient({ namespace: env.OBCF_KV as any });
                    const timestamp = Date.now();
                    for (let i = 0; i < body.batch.length; i++) {
                        const key = `queue:message:${timestamp}:${i}`;
                        await kv.put(
                            key,
                            JSON.stringify({
                                ...(body.batch[i] as any),
                                sentAt: Date.now(),
                                type: 'batch',
                            }),
                            { expirationTtl: 3600 },
                        );
                    }
                } catch {
                    // ignore
                }
            }

            const jobTypeCounts = jobs.reduce(
                (acc, job) => {
                    acc[job.type] = (acc[job.type] || 0) + 1;
                    return acc;
                },
                {} as Record<string, number>,
            );

            for (const [jobType, count] of Object.entries(jobTypeCounts)) {
                await incrementDispatchStats(env, jobType, count);
            }

            return jsonResponse({
                success: true,
                message: `Dispatched ${body.batch.length} jobs to queue`,
                count: body.batch.length,
            });
        }

        if (body.message) {
            const msg = body.message;
            const jobType = msg.action || 'batch-task';
            const payload = {
                userId: msg.userId,
                data: msg.data,
                action: msg.action,
            };

            const result = await dispatch(env.OBCF_QUEUE, jobType, payload);
            if (!result.success) {
                return errorResponse('Failed to dispatch job', 500, {
                    details: result.error.message,
                });
            }

            if (env.OBCF_KV) {
                try {
                    const kv = createKVClient({ namespace: env.OBCF_KV as any });
                    const key = `queue:message:${Date.now()}`;
                    await kv.put(
                        key,
                        JSON.stringify({
                            ...(msg as any),
                            sentAt: Date.now(),
                            type: 'single',
                        }),
                        { expirationTtl: 3600 },
                    );
                } catch {
                    // ignore
                }
            }

            await incrementDispatchStats(env, jobType);

            return jsonResponse({
                success: true,
                message: 'Job dispatched to queue',
            });
        }

        return errorResponse('Either { type, payload } or { message } or { batch } is required', 400);
    }

    if (request.method === 'GET') {
        if (!env.OBCF_KV) {
            return errorResponse('KV binding not configured', 500, {
                code: 'CONFIG_ERROR',
            });
        }

        const kv = createKVClient({ namespace: env.OBCF_KV as any });
        const listResult = await kv.list({ prefix: 'queue:message:' });
        if (!listResult.success) {
            return errorResponse('Failed to list messages', 500);
        }

        const messages: any[] = [];
        for (const key of listResult.data.keys.slice(0, 20)) {
            const result = await kv.get(key.name);
            if (result.success && result.data) {
                try {
                    const message = JSON.parse(result.data as string);
                    messages.push({ key: key.name, ...message });
                } catch {
                    // ignore
                }
            }
        }

        messages.sort((a, b) => Number(b.sentAt) - Number(a.sentAt));

        return jsonResponse({ messages });
    }

    return errorResponse('Method not allowed', 405, {
        code: 'METHOD_NOT_ALLOWED',
    });
}

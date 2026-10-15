import type { BrowserRun, DurableObjectStorage } from '@cloudflare/workers-types';
import { describe, expect, it, vi } from 'vitest';
import { AlarmQueue, type AlarmStorage } from '../durable-alarms';
import { createAiClient } from '../ai';
import { createBrowserClient, type BrowserRunLike } from '../browser';
import { createVectorizeClient } from '../vectorize';
import { createWorkflowsClient } from '../workflows';

describe('VectorizeClient', () => {
    const index = {
        upsert: vi.fn(async () => ({ mutationId: 'm1' })),
        insert: vi.fn(async () => ({ mutationId: 'm2' })),
        query: vi.fn(async () => ({ matches: [{ id: 'a', score: 0.9 }], count: 1 })),
        queryById: vi.fn(async () => ({ matches: [], count: 0 })),
        getByIds: vi.fn(async () => []),
        deleteByIds: vi.fn(async () => ({ mutationId: 'm3' })),
        describe: vi.fn(async () => {
            throw new Error('index gone');
        }),
    };
    const client = createVectorizeClient({ index: index as never, namespace: 'org_1' });

    it('stamps the namespace on writes and queries, unless a vector or query names its own', async () => {
        await client.upsert([
            { id: 'a', values: [1, 2] },
            { id: 'b', values: [3, 4], namespace: 'shared' },
        ]);
        expect(index.upsert).toHaveBeenCalledWith([
            { id: 'a', values: [1, 2], namespace: 'org_1' },
            { id: 'b', values: [3, 4], namespace: 'shared' },
        ]);
        const result = await client.query([1, 2], { topK: 3 });
        expect(result).toEqual({ success: true, data: { matches: [{ id: 'a', score: 0.9 }], count: 1 } });
        expect(index.query).toHaveBeenCalledWith([1, 2], { namespace: 'org_1', topK: 3 });
        await client.scoped('org_2').queryById('a');
        expect(index.queryById).toHaveBeenCalledWith('a', { namespace: 'org_2' });
    });

    it('folds a throwing binding into a failed Result and refuses a missing binding', async () => {
        const described = await client.describe();
        expect(described.success).toBe(false);
        if (!described.success) expect(described.error.message).toBe('index gone');
        expect(() => createVectorizeClient({ index: undefined as never })).toThrow(/binding is required/);
    });
});

describe('AiClient', () => {
    const ai = {
        run: vi.fn(async (model: string, inputs: { text?: string[]; messages?: unknown[] }) =>
            model.includes('bge')
                ? { shape: [inputs.text!.length, 3], data: inputs.text!.map((_, i) => [i, i, i]) }
                : { response: 'hello' },
        ),
    };
    const client = createAiClient({ ai: ai as never, gateway: { id: 'gw' } });

    it('embeds in input order and passes the gateway option', async () => {
        expect(await client.embed(['a', 'b'])).toEqual({
            success: true,
            data: [
                [0, 0, 0],
                [1, 1, 1],
            ],
        });
        expect(ai.run).toHaveBeenLastCalledWith(
            '@cf/baai/bge-base-en-v1.5',
            { text: ['a', 'b'] },
            { gateway: { id: 'gw' } },
        );
        expect(await client.embed([])).toEqual({ success: true, data: [] });
    });

    it('generates text from a prompt with a system message, and flags a malformed response', async () => {
        expect(await client.generateText('hi', { system: 'be brief', maxTokens: 10 })).toEqual({
            success: true,
            data: 'hello',
        });
        expect(ai.run).toHaveBeenLastCalledWith(
            '@cf/meta/llama-3.1-8b-instruct',
            {
                messages: [
                    { role: 'system', content: 'be brief' },
                    { role: 'user', content: 'hi' },
                ],
                max_tokens: 10,
            },
            { gateway: { id: 'gw' } },
        );
        ai.run.mockResolvedValueOnce({ nope: true } as never);
        const bad = await client.generateText([{ role: 'user', content: 'x' }]);
        expect(bad.success).toBe(false);
        ai.run.mockResolvedValueOnce({ data: [[1]] } as never);
        const short = await client.embed(['a', 'b']);
        expect(short.success).toBe(false);
    });
});

describe('BrowserClient', () => {
    const browser: BrowserRunLike = {
        quickAction: vi.fn(async (action: string) => {
            if (action === 'pdf') {
                return new Response(new Uint8Array([37, 80, 68, 70]), {
                    status: 200,
                    headers: { 'content-type': 'application/pdf', 'X-Browser-Ms-Used': '120' },
                });
            }
            if (action === 'links') return Response.json({ result: ['https://a.test', 'https://b.test'] });
            if (action === 'markdown') return new Response('# Title', { headers: { 'content-type': 'text/markdown' } });
            return Response.json({ error: 'blocked' }, { status: 422 });
        }),
    };
    const client = createBrowserClient({ browser });

    it('returns bytes, text or parsed JSON with the billed browser time', async () => {
        const pdf = await client.pdf({ html: '<h1>Invoice</h1>' }, { pdfOptions: { format: 'a4' } });
        expect(pdf.success).toBe(true);
        if (pdf.success) {
            expect(new Uint8Array(pdf.data.data)).toEqual(new Uint8Array([37, 80, 68, 70]));
            expect(pdf.data).toMatchObject({ contentType: 'application/pdf', msUsed: 120 });
        }
        expect(browser.quickAction).toHaveBeenCalledWith('pdf', {
            html: '<h1>Invoice</h1>',
            pdfOptions: { format: 'a4' },
        });
        const links = await client.links({ url: 'https://x.test' });
        expect(links.success && links.data.data).toEqual(['https://a.test', 'https://b.test']);
        const md = await client.markdown({ url: 'https://x.test' });
        expect(md.success && md.data.data).toBe('# Title');
    });

    it('turns a non-2xx into a failed Result carrying status and body', async () => {
        const shot = await client.screenshot({ url: 'https://x.test' });
        expect(shot.success).toBe(false);
        if (!shot.success)
            expect((shot.error as { details?: unknown }).details).toMatchObject({
                status: 422,
                body: '{"error":"blocked"}',
            });
    });

    it('accepts the real binding type', () => {
        const typed: BrowserRunLike = {} as BrowserRun;
        expect(typed).toBeDefined();
    });
});

describe('WorkflowsClient', () => {
    const instances = new Map<
        string,
        {
            id: string;
            status: ReturnType<typeof vi.fn>;
            pause: ReturnType<typeof vi.fn>;
            sendEvent: ReturnType<typeof vi.fn>;
        }
    >();
    const instance = (id: string) => {
        const made = {
            id,
            status: vi.fn(async () => ({ status: 'running' })),
            pause: vi.fn(async () => {}),
            sendEvent: vi.fn(async () => {}),
        };
        instances.set(id, made);
        return made;
    };
    const workflow = {
        create: vi.fn(async (options?: { id?: string }) => instance(options?.id ?? 'wf_auto')),
        createBatch: vi.fn(async (batch: Array<{ id?: string }>) =>
            batch.map((options, i) => instance(options.id ?? `wf_${i}`)),
        ),
        get: vi.fn(async (id: string) => {
            const found = instances.get(id);
            if (!found) throw new Error(`instance.not_found: ${id}`);
            return found;
        }),
    };
    const client = createWorkflowsClient<{ orderId: string }>({ workflow: workflow as never });

    it('starts instances (idempotent by id), reads status, steers and sends events', async () => {
        expect(await client.start({ orderId: 'o1' }, { id: 'order-o1' })).toEqual({
            success: true,
            data: { id: 'order-o1' },
        });
        expect(workflow.create).toHaveBeenCalledWith({ id: 'order-o1', params: { orderId: 'o1' } });
        expect(
            await client.startBatch([{ params: { orderId: 'o2' } }, { id: 'x', params: { orderId: 'o3' } }]),
        ).toEqual({ success: true, data: ['wf_0', 'x'] });
        expect(await client.status('order-o1')).toEqual({ success: true, data: { status: 'running' } });
        expect(await client.pause('order-o1')).toEqual({ success: true, data: undefined });
        await client.sendEvent('order-o1', 'paid', { amount: 5 });
        expect(instances.get('order-o1')!.sendEvent).toHaveBeenCalledWith({ type: 'paid', payload: { amount: 5 } });
        const missing = await client.status('nope');
        expect(missing.success).toBe(false);
    });
});

describe('AlarmQueue', () => {
    function fakeStorage(): AlarmStorage & { alarm: number | null; data: Map<string, unknown> } {
        const data = new Map<string, unknown>();
        const self = {
            data,
            alarm: null as number | null,
            async get<T>(key: string) {
                return data.get(key) as T | undefined;
            },
            async put<T>(key: string, value: T) {
                data.set(key, value);
            },
            async delete(key: string) {
                return data.delete(key);
            },
            async getAlarm() {
                return self.alarm;
            },
            async setAlarm(at: number | Date) {
                self.alarm = typeof at === 'number' ? at : at.getTime();
            },
            async deleteAlarm() {
                self.alarm = null;
            },
        };
        return self;
    }

    it('keeps the real alarm on the earliest entry through schedule, reschedule and cancel', async () => {
        const storage = fakeStorage();
        const queue = new AlarmQueue<{ kind: string }>(storage);
        await queue.schedule('cleanup', 3_000, { kind: 'cleanup' });
        await queue.schedule('retry', 1_000, { kind: 'retry' });
        expect(storage.alarm).toBe(1_000);
        await queue.schedule('retry', 5_000, { kind: 'retry' }); // moved later: cleanup is now first
        expect(storage.alarm).toBe(3_000);
        expect((await queue.list()).map((entry) => entry.id)).toEqual(['cleanup', 'retry']);
        expect(await queue.cancel('cleanup')).toBe(true);
        expect(await queue.cancel('cleanup')).toBe(false);
        expect(storage.alarm).toBe(5_000);
        expect(await queue.get('retry')).toEqual({ id: 'retry', at: 5_000, payload: { kind: 'retry' } });
    });

    it('due() hands back what is ready, soonest first, and re-arms for the rest or clears when empty', async () => {
        const storage = fakeStorage();
        const queue = new AlarmQueue(storage);
        await queue.schedule('b', 2_000);
        await queue.schedule('a', 1_000);
        await queue.schedule('c', 9_000);
        expect(await queue.due(500)).toEqual([]); // woken early: still armed for 'a'
        expect(storage.alarm).toBe(1_000);
        expect((await queue.due(2_000)).map((entry) => entry.id)).toEqual(['a', 'b']);
        expect(storage.alarm).toBe(9_000);
        expect((await queue.due(10_000)).map((entry) => entry.id)).toEqual(['c']);
        expect(storage.alarm).toBeNull();
        expect(storage.data.size).toBe(0);
    });

    it('accepts the real storage type', () => {
        const typed: AlarmStorage = {} as DurableObjectStorage;
        expect(typed).toBeDefined();
    });
});

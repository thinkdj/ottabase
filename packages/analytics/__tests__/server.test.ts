import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetVisitorIdResolver, setVisitorIdResolver } from '../src/identity';
import { handleAnalyticsTrack } from '../src/server';

/** Create a mock Request with JSON body and optional headers. */
function mockRequest(body: unknown, headers: Record<string, string> = {}): Request {
    return {
        json: () => Promise.resolve(body),
        headers: {
            get: (name: string) => {
                const map: Record<string, string> = {
                    'cf-connecting-ip': '1.2.3.4',
                    'user-agent': 'TestAgent',
                    'cf-connecting-country': 'US',
                    ...headers,
                };
                return map[name.toLowerCase()] ?? null;
            },
        },
    } as unknown as Request;
}

describe('handleAnalyticsTrack', () => {
    let mockDataset: { writeDataPoint: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockDataset = { writeDataPoint: vi.fn() };
        // Use a sync resolver to avoid crypto dependency issues in tests
        setVisitorIdResolver(() => 'test-visitor-id');
    });

    afterEach(() => {
        resetVisitorIdResolver();
    });

    it('returns 503 when dataset is undefined', async () => {
        const req = mockRequest({ event: 'test' });
        const res = await handleAnalyticsTrack({ request: req, dataset: undefined });

        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body).toEqual({ error: 'Analytics not configured' });
    });

    it('returns 400 for invalid JSON body', async () => {
        const req = {
            json: () => Promise.reject(new Error('parse error')),
            headers: { get: () => null },
        } as unknown as Request;

        const res = await handleAnalyticsTrack({ request: req, dataset: mockDataset as any });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toEqual({ error: 'Invalid JSON body' });
    });

    it('returns 400 when event is missing', async () => {
        const req = mockRequest({ metadata: ['test'] });
        const res = await handleAnalyticsTrack({ request: req, dataset: mockDataset as any });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toEqual({ error: 'event is required' });
    });

    it('returns 400 when event is not a string', async () => {
        const req = mockRequest({ event: 123 });
        const res = await handleAnalyticsTrack({ request: req, dataset: mockDataset as any });

        expect(res.status).toBe(400);
    });

    it('writes a data point and returns 200 on success', async () => {
        const req = mockRequest({ event: 'page_view', appId: 'my-app', value: 2 });
        const res = await handleAnalyticsTrack({
            request: req,
            dataset: mockDataset as any,
            userId: 'user-42',
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual({ ok: true });

        // Verify writeDataPoint was called
        expect(mockDataset.writeDataPoint).toHaveBeenCalledTimes(1);
        const call = mockDataset.writeDataPoint.mock.calls[0][0];
        expect(call.indexes).toEqual(['page_view']);
        expect(call.blobs[0]).toBe('my-app'); // appId
        expect(call.blobs[1]).toBe('user-42'); // userId
        expect(call.blobs[5]).toBe('test-visitor-id'); // visitorId
        expect(call.doubles).toEqual([2]);
    });

    it('uses defaultAppId when appId is not in body', async () => {
        const req = mockRequest({ event: 'click' });
        await handleAnalyticsTrack({
            request: req,
            dataset: mockDataset as any,
            defaultAppId: 'default-app',
        });

        const call = mockDataset.writeDataPoint.mock.calls[0][0];
        expect(call.blobs[0]).toBe('default-app');
    });

    it('passes metadata through to trackCoreEvent', async () => {
        const req = mockRequest({ event: 'click', metadata: ['/pricing', 'cta'] });
        await handleAnalyticsTrack({
            request: req,
            dataset: mockDataset as any,
        });

        const call = mockDataset.writeDataPoint.mock.calls[0][0];
        // metadata starts at blob7 (after visitorId at blob6)
        expect(call.blobs[6]).toBe('/pricing');
        expect(call.blobs[7]).toBe('cta');
    });
});

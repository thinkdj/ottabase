import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractRequestContext, trackCoreEvent, trackEvent } from '../src/track';

describe('trackEvent', () => {
    let mockDataset: { writeDataPoint: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockDataset = { writeDataPoint: vi.fn() };
    });

    it('writes a data point with index and blobs', () => {
        trackEvent({
            dataset: mockDataset as any,
            index: 'my-code',
            blobs: ['US', 'Mozilla/5.0'],
            doubles: [1],
        });

        expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
            indexes: ['my-code'],
            blobs: ['US', 'Mozilla/5.0'],
            doubles: [1],
        });
    });

    it('defaults doubles to [1] when omitted', () => {
        trackEvent({
            dataset: mockDataset as any,
            index: 'test',
        });

        expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
            indexes: ['test'],
            blobs: [],
            doubles: [1],
        });
    });

    it('uses "unknown" as index when empty string provided', () => {
        trackEvent({
            dataset: mockDataset as any,
            index: '',
        });

        expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
            indexes: ['unknown'],
            blobs: [],
            doubles: [1],
        });
    });

    it('does not throw when dataset is falsy', () => {
        expect(() => {
            trackEvent({ dataset: null as any, index: 'test' });
        }).not.toThrow();
    });

    it('does not throw when writeDataPoint fails', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockDataset.writeDataPoint.mockImplementation(() => {
            throw new Error('WAE write failed');
        });

        expect(() => {
            trackEvent({ dataset: mockDataset as any, index: 'test' });
        }).not.toThrow();

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[analytics]'), expect.any(Error));
        warnSpy.mockRestore();
    });
});

describe('trackCoreEvent', () => {
    let mockDataset: { writeDataPoint: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockDataset = { writeDataPoint: vi.fn() };
    });

    it('maps named fields to blob slots in correct order', () => {
        trackCoreEvent({
            dataset: mockDataset as any,
            event: 'page_view',
            appId: 'my-app',
            userId: 'user-123',
            country: 'DE',
            userAgent: 'Firefox/130',
            referer: 'https://google.com',
            visitorId: 'abc123hash',
        });

        expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
            indexes: ['page_view'],
            blobs: ['my-app', 'user-123', 'DE', 'Firefox/130', 'https://google.com', 'abc123hash'],
            doubles: [1],
        });
    });

    it('appends metadata strings as blob7–blob11 (after visitorId)', () => {
        trackCoreEvent({
            dataset: mockDataset as any,
            event: 'button_click',
            appId: 'app',
            visitorId: 'v1',
            metadata: ['/pricing', 'cta-signup', 'campaign-1'],
        });

        const call = mockDataset.writeDataPoint.mock.calls[0][0];
        // blob1=appId, blob2-5=defaults, blob6=visitorId, blob7-9=metadata
        expect(call.blobs).toEqual(['app', '', 'unknown', '', '', 'v1', '/pricing', 'cta-signup', 'campaign-1']);
    });

    it('limits metadata to 5 entries', () => {
        trackCoreEvent({
            dataset: mockDataset as any,
            event: 'test',
            visitorId: 'v1',
            metadata: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        });

        const call = mockDataset.writeDataPoint.mock.calls[0][0];
        // 6 fixed blobs (including visitorId) + 5 metadata (capped) = 11 total
        expect(call.blobs.length).toBe(11);
    });

    it('defaults visitorId to empty string when omitted', () => {
        trackCoreEvent({
            dataset: mockDataset as any,
            event: 'test',
            appId: 'app',
        });

        const call = mockDataset.writeDataPoint.mock.calls[0][0];
        // blob6 should be '' when visitorId is not provided
        expect(call.blobs[5]).toBe('');
    });

    it('uses custom value for double1', () => {
        trackCoreEvent({
            dataset: mockDataset as any,
            event: 'purchase',
            value: 49.99,
        });

        expect(mockDataset.writeDataPoint).toHaveBeenCalledWith(expect.objectContaining({ doubles: [49.99] }));
    });

    it('truncates userAgent to 200 chars', () => {
        const longUA = 'A'.repeat(300);
        trackCoreEvent({
            dataset: mockDataset as any,
            event: 'test',
            userAgent: longUA,
        });

        const call = mockDataset.writeDataPoint.mock.calls[0][0];
        expect(call.blobs[3].length).toBe(200);
    });
});

describe('extractRequestContext', () => {
    it('extracts country, userAgent, and referer from request headers', () => {
        const mockRequest = {
            headers: new Map([
                ['cf-connecting-country', 'IN'],
                ['user-agent', 'TestAgent/1.0'],
                ['referer', 'https://example.com'],
            ]),
        } as unknown as Request;

        // Use a real Request-like object with get()
        const headers = {
            get: (name: string) => {
                const map: Record<string, string> = {
                    'cf-connecting-country': 'IN',
                    'user-agent': 'TestAgent/1.0',
                    referer: 'https://example.com',
                };
                return map[name] ?? null;
            },
        };
        const request = { headers } as unknown as Request;

        const ctx = extractRequestContext(request);
        expect(ctx).toEqual({
            country: 'IN',
            userAgent: 'TestAgent/1.0',
            referer: 'https://example.com',
        });
    });

    it('returns defaults when headers are missing', () => {
        const request = {
            headers: { get: () => null },
        } as unknown as Request;

        const ctx = extractRequestContext(request);
        expect(ctx).toEqual({
            country: 'unknown',
            userAgent: '',
            referer: '',
        });
    });
});

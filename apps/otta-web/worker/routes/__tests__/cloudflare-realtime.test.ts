import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSession: vi.fn(),
    enforceRateLimit: vi.fn(),
    broadcast: vi.fn(),
    getStats: vi.fn(),
    broadcasterRooms: [] as string[],
}));

vi.mock('@ottabase/auth/backend', () => ({ getSession: mocks.getSession }));
vi.mock('../../lib/auth-utils', () => ({ getAuthOptions: vi.fn(() => ({})) }));
vi.mock('../../lib/rate-limiting', () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock('@ottabase/cf-realtime/server', () => ({
    RealtimeBroadcaster: class {
        constructor(_namespace: unknown, room: string) {
            mocks.broadcasterRooms.push(room);
        }
        broadcast = mocks.broadcast;
        getStats = mocks.getStats;
    },
}));

import { handleRealtimeBroadcast, handleRealtimeStats, handleRealtimeWebsocket } from '../cloudflare-realtime';

function makeNamespace() {
    const stubFetch = vi.fn(async () => new Response('upgraded'));
    return {
        idFromName: vi.fn((name: string) => `id:${name}`),
        get: vi.fn(() => ({ fetch: stubFetch })),
        stubFetch,
    };
}

function context(request: Request, namespace = makeNamespace()) {
    return {
        request,
        env: { OBCF_REALTIME: namespace } as any,
        url: new URL(request.url),
        route: '',
        method: request.method,
        withAuthCors: (response: Response) => response,
        corsHeaders: {},
        namespace,
    } as any;
}

function broadcastRequest(body: unknown) {
    return new Request('https://app.example.com/api/cloudflare/realtime/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

describe('realtime demo routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.broadcasterRooms.length = 0;
        mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
        mocks.enforceRateLimit.mockResolvedValue(null);
        mocks.broadcast.mockResolvedValue({ success: true });
        mocks.getStats.mockResolvedValue({ totalConnections: 1, channels: [], offlineMessagesQueued: 0 });
    });

    it('refuses anonymous callers on every route', async () => {
        mocks.getSession.mockResolvedValue(null);
        const ws = new Request('https://app.example.com/api/cloudflare/realtime/ws', {
            headers: { Upgrade: 'websocket' },
        });

        expect((await handleRealtimeWebsocket(context(ws)))?.status).toBe(401);
        expect((await handleRealtimeBroadcast(context(broadcastRequest({})))).status).toBe(401);
        expect(
            (await handleRealtimeStats(context(new Request('https://app.example.com/api/cloudflare/realtime/stats'))))
                .status,
        ).toBe(401);
    });

    it("connects a signed-in user's socket to their own room", async () => {
        const namespace = makeNamespace();
        const ws = new Request('https://app.example.com/api/cloudflare/realtime/ws', {
            headers: { Upgrade: 'websocket' },
        });

        const response = await handleRealtimeWebsocket(context(ws, namespace));

        expect(await response?.text()).toBe('upgraded');
        expect(namespace.idFromName).toHaveBeenCalledWith('user:user-1');
        expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            'realtime:connect:user-1',
        );
    });

    it('broadcasts and reports stats in the caller’s room only', async () => {
        const sent = await handleRealtimeBroadcast(
            context(broadcastRequest({ channels: ['news'], event: 'hello', data: { a: 1 } })),
        );
        await handleRealtimeStats(context(new Request('https://app.example.com/api/cloudflare/realtime/stats')));

        expect(sent.status).toBe(200);
        expect(mocks.broadcasterRooms).toEqual(['user:user-1', 'user:user-1']);
        expect(mocks.broadcast).toHaveBeenCalledWith(expect.objectContaining({ channels: ['news'], event: 'hello' }));
    });

    it('stops a broadcast at the rate limit', async () => {
        mocks.enforceRateLimit.mockResolvedValue(new Response('slow down', { status: 429 }));

        const response = await handleRealtimeBroadcast(context(broadcastRequest({ channels: ['a'], event: 'e' })));

        expect(response.status).toBe(429);
        expect(mocks.broadcast).not.toHaveBeenCalled();
    });

    it('bounds the fan-out: channel count, name length and payload size', async () => {
        const tooMany = Array.from({ length: 11 }, (_, i) => `c${i}`);
        const cases = [
            broadcastRequest({ channels: tooMany, event: 'e' }),
            broadcastRequest({ channels: ['x'.repeat(65)], event: 'e' }),
            broadcastRequest({ channels: ['a'], event: 'e'.repeat(65) }),
            broadcastRequest({ channels: ['a'], event: 'e', data: 'x'.repeat(9000) }),
            broadcastRequest('not json'),
        ];

        for (const request of cases) {
            const response = await handleRealtimeBroadcast(context(request));
            expect([400, 413]).toContain(response.status);
        }
        expect(mocks.broadcast).not.toHaveBeenCalled();
    });
});

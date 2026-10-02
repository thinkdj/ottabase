import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real Actor base needs the Workers runtime; RealtimeActor only uses its constructor.
vi.mock('@cloudflare/actors', () => ({
    Actor: class {
        constructor(..._args: unknown[]) {}
    },
}));

const { RealtimeActor } = await import('../server/RealtimeActor');

function createState() {
    let alarm: number | null = null;
    const store = new Map<string, unknown>();
    return {
        storage: {
            get: vi.fn(async (key: string) => store.get(key)),
            put: vi.fn(async (key: string, value: unknown) => void store.set(key, value)),
            getAlarm: vi.fn(async () => alarm),
            setAlarm: vi.fn(async (time: number) => void (alarm = time)),
        },
    };
}

function createActor() {
    const state = createState();
    const actor = new RealtimeActor(state as never, {}) as any;
    return { actor, state };
}

function addClient(actor: any, clientId: string, channels: string[] = []) {
    const sent: any[] = [];
    actor.connections.set(clientId, { readyState: 1, send: (m: string) => sent.push(JSON.parse(m)) });
    actor.clientInfo.set(clientId, { clientId, channels: new Set(channels), connectedAt: 0, lastSeenAt: 0 });
    return sent;
}

function broadcast(actor: any, body: Record<string, unknown>) {
    return actor.fetch(
        new Request('https://actor/broadcast', {
            method: 'POST',
            body: JSON.stringify({ type: 'broadcast', event: 'e', data: {}, ...body }),
        }),
    );
}

describe('RealtimeActor', () => {
    beforeEach(() => {
        vi.stubGlobal('WebSocket', { OPEN: 1 });
    });

    it('arms the first cleanup alarm when an offline message is queued', async () => {
        const { actor, state } = createActor();
        addClient(actor, 'c1', ['news']);

        await broadcast(actor, { channels: ['news'], persistForOffline: true });

        expect(state.storage.setAlarm).toHaveBeenCalledTimes(1);
    });

    it('honours a per-broadcast ttl for offline messages', async () => {
        const { actor } = createActor();
        addClient(actor, 'c1', ['news']);
        const before = Date.now();

        await broadcast(actor, { channels: ['news'], persistForOffline: true, ttl: 60 });

        const [queued] = actor.offlineMessages.get('c1');
        expect(queued.expiresAt - before).toBeLessThanOrEqual(60_000 + 1_000);
    });

    it('enforces maxConnectionsPerChannel on subscribe', async () => {
        const { actor } = createActor();
        actor.config = { ...actor.config, maxConnectionsPerChannel: 1 };
        addClient(actor, 'c1', ['news']);
        const sent = addClient(actor, 'c2');

        await actor.handleSubscribe('c2', { type: 'subscribe', channel: 'news', timestamp: 0 });

        expect(actor.clientInfo.get('c2').channels.has('news')).toBe(false);
        expect(sent[0]).toMatchObject({ type: 'error' });
    });

    it('stops re-arming the alarm once no offline messages remain', async () => {
        const { actor, state } = createActor();

        await actor.alarm();

        expect(state.storage.setAlarm).not.toHaveBeenCalled();
    });
});

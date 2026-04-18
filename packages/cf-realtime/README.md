# @ottabase/cf-realtime

A **Pusher alternative** for real-time pub/sub using **Cloudflare Actors** (Durable Objects). Build scalable, real-time
applications with WebSocket support, offline message queuing, and TypeScript-first API.

## Features

- **Real-time WebSocket connections** with auto-reconnect
- **Channel-based pub/sub** (subscribe to `org-1201`, `user-22`, `system`, etc.)
- **Offline message queuing** — messages are delivered when clients reconnect
- **TypeScript-first** with full type safety
- **Powered by Cloudflare Durable Objects** for global scale
- **Pusher-like API** for easy migration
- **Server-side broadcasting** to all online subscribers
- **Built-in stats and monitoring**

## Installation

```bash
pnpm add @ottabase/cf-realtime
```

## Quick Start

### 1. Server Setup (Cloudflare Worker)

Export `RealtimeActor` from your worker entry point so Cloudflare registers the Durable Object class:

```typescript
// cloudflare-worker.ts
import { RealtimeBroadcaster } from '@ottabase/cf-realtime/server';

// Re-export the Durable Object class (required by Cloudflare)
export { RealtimeActor } from '@ottabase/cf-realtime/server';

interface CloudflareEnv {
    OBCF_REALTIME: DurableObjectNamespace;
    API_KEYS: KVNamespace;
}

export default {
    async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
        const url = new URL(request.url);

        // WebSocket upgrade — forward to the Durable Object
        if (url.pathname === '/realtime' && request.headers.get('Upgrade') === 'websocket') {
            const id = env.OBCF_REALTIME.idFromName('global');
            const stub = env.OBCF_REALTIME.get(id);
            return stub.fetch(request);
        }

        // Broadcast endpoint — requires authentication + channel-level authorization
        if (url.pathname === '/api/broadcast' && request.method === 'POST') {
            const publisher = await validatePublisher(request, env);
            if (!publisher) {
                return new Response('Unauthorized', { status: 401 });
            }

            const body = await request.json<any>();
            const channels = Array.isArray(body.channels) ? body.channels : [];
            if (channels.length === 0) {
                return new Response('channels array is required', { status: 400 });
            }

            const event = typeof body.event === 'string' ? body.event.trim() : '';
            if (!event) {
                return new Response('event is required', { status: 400 });
            }

            const allowedChannels = new Set(publisher.allowedChannels);

            // Enforce per-channel publish permissions derived from the caller's session/API key
            if (channels.some((channel) => !allowedChannels.has(channel))) {
                return new Response('Forbidden', { status: 403 });
            }

            const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);

            const result = await broadcaster.broadcast({
                channels,
                event,
                data: body.data,
                persistForOffline: body.persistForOffline ?? false,
            });

            return Response.json(result);
        }

        return new Response('Not Found', { status: 404 });
    },
};

type Publisher = { allowedChannels: string[] };

// Validate an API key/session and return which channels the caller may publish to
async function validatePublisher(request: Request, env: CloudflareEnv): Promise<Publisher | null> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return null;

    const trimmed = authHeader.trim();
    const [scheme, ...rest] = trimmed.split(/\s+/);
    if (!scheme || scheme.toLowerCase() !== 'bearer') return null;

    const token = rest.join(' ');
    if (!token) return null;

    // Example: look up an API key that encodes allowed channels (KV/DB/custom auth)
    // Return null to reject callers without publish permissions.
    const apiKey = await env.API_KEYS?.get<Publisher>(token, 'json');
    return apiKey ?? null;
}
```

### 2. Wrangler Configuration

```jsonc
// wrangler.jsonc
{
    "durable_objects": {
        "bindings": [{ "name": "OBCF_REALTIME", "class_name": "RealtimeActor" }],
    },
    "kv_namespaces": [{ "binding": "API_KEYS", "id": "your-api-keys-kv" }],
    "migrations": [{ "tag": "v1", "new_classes": ["RealtimeActor"] }],
}
```

Provision a KV namespace for publisher API keys (each value should include `allowedChannels`):

```bash
wrangler kv namespace create API_KEYS
wrangler kv key put --binding=API_KEYS "server-1" '{"allowedChannels":["org-1201","system"]}'
```

Then call the broadcast endpoint from your backend with the API key:

```typescript
await fetch('https://your-worker.workers.dev/api/broadcast', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.REALTIME_PUBLISH_KEY}`,
    },
    body: JSON.stringify({ channels: ['org-1201'], event: 'update', data: {} }),
});
```

> **Never expose `/api/broadcast` without authentication and channel-level authorization.** Anyone who can reach the
> endpoint could inject arbitrary events into any channel unless you enforce publish scopes.

### 3. Client Usage (Browser/Node.js)

```typescript
import { RealtimeClient } from '@ottabase/cf-realtime';

// Create client
const client = new RealtimeClient({
    url: 'wss://your-worker.workers.dev/realtime',
    clientId: 'user-123', // Optional, auto-generated if not provided
    autoReconnect: true,
    debug: true,
});

// Connect
await client.connect();

// Subscribe to channels
const unsubscribe = client.subscribe('org-1201', (event, data, metadata) => {
    console.log(`Received ${event}:`, data, metadata);

    if (event === 'user-joined') {
        console.log(`User ${data.userId} joined!`);
    }
});

// Subscribe to multiple channels
client.subscribe('user-22', (event, data) => {
    console.log('User-specific message:', data);
});

client.subscribe('system', (event, data, metadata) => {
    // Handle system updates
    if (metadata?.offline) {
        // This message was queued while we were offline
        console.log('Received offline message:', data);
    }
});

// Listen to connection state
client.onStateChange((state) => {
    console.log('Connection state:', state);
    // states: connecting, connected, disconnected, reconnecting, failed
});

// Handle errors
client.onError((error) => {
    console.error('Realtime error:', error);
});

// Unsubscribe
unsubscribe();

// Or unsubscribe from all channels
client.unsubscribeAll();

// Disconnect
client.disconnect();
```

## Server-Side Broadcasting

Send messages to channels from your backend:

```typescript
import { RealtimeBroadcaster } from '@ottabase/cf-realtime/server';

// In your Cloudflare Worker
const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);

// Broadcast to specific channels
await broadcaster.broadcast({
    channels: ['org-1201', 'org-users-all'],
    event: 'notification',
    data: {
        title: 'New Feature Released!',
        message: 'Check out our new dashboard',
    },
    persistForOffline: true, // Queue for offline users
    metadata: {
        priority: 'high',
    },
});

// Send to a single channel (shorthand)
await broadcaster.send('user-22', 'message', { text: 'Hello!' }, { persistForOffline: true });

// Get stats
const stats = await broadcaster.getStats();
console.log(stats);
// {
//   totalConnections: 150,
//   channels: [
//     { channel: "org-1201", subscriberCount: 45 },
//     { channel: "user-22", subscriberCount: 1 },
//   ],
//   offlineMessagesQueued: 23
// }

// Health check
const health = await broadcaster.health();
console.log(health); // { status: "ok", connections: 150 }
```

## Channel Patterns

Use channels to organize your real-time data:

```typescript
// Organization-level
client.subscribe('org-1201', handler);

// User-specific
client.subscribe('user-22', handler);

// Group/Team
client.subscribe('group-50', handler);

// All users in an org
client.subscribe('org-users-all', handler);

// System-wide broadcasts
client.subscribe('system', handler);

// Custom patterns
client.subscribe('notifications:user:123', handler);
client.subscribe('chat:room:456', handler);
```

## Offline Message Queuing

Messages can be queued for offline clients and delivered when they reconnect:

```typescript
// Server-side: Send message with offline persistence
await broadcaster.send(
    'user-22',
    'system-update',
    {
        action: 'update-profile',
        data: { theme: 'dark' },
    },
    {
        persistForOffline: true,
        metadata: { ttl: 86400 }, // 24 hours
    },
);

// Client-side: Handle offline messages
client.subscribe('system-update', (event, data, metadata) => {
    if (metadata?.offline) {
        // This message was queued while we were offline
        console.log('Processing queued action:', data.action);

        // Perform the action
        if (data.action === 'update-profile') {
            updateUserProfile(data.data);
        }
    }
});
```

## API Reference

### Client API

#### `RealtimeClient`

```typescript
constructor(config: ClientConfig)

connect(): Promise<void>
disconnect(): void

subscribe(channel: string, handler: MessageHandler): () => void
unsubscribe(channel: string, handler?: MessageHandler): void
unsubscribeAll(): void

onStateChange(handler: ConnectionStateHandler): () => void
onError(handler: ErrorHandler): () => void

getState(): ConnectionState
getClientId(): string
```

### Server API

#### `RealtimeBroadcaster`

```typescript
constructor(actorNamespace: DurableObjectNamespace, actorId?: string)

broadcast(options: BroadcastOptions): Promise<{ success: boolean; error?: string }>
send(channel: string, event: string, data: any, options?: {...}): Promise<{...}>

getStats(): Promise<any>
health(): Promise<{ status: string; connections: number }>
```

## Configuration

### Client Configuration

```typescript
interface ClientConfig {
    url: string; // WebSocket URL
    clientId?: string; // Client identifier (auto-generated if not provided)
    autoReconnect?: boolean; // Auto-reconnect on disconnect (default: true)
    reconnectInterval?: number; // Initial reconnect delay in ms (default: 3000)
    maxReconnectAttempts?: number; // Max reconnect attempts (default: 10)
    pingInterval?: number; // Ping interval in ms (default: 30000)
    debug?: boolean; // Enable debug logging (default: false)
}
```

### Server Configuration

```typescript
interface ServerConfig {
    maxConnectionsPerChannel?: number; // Max connections per channel (default: 1000)
    offlineMessageTTL?: number; // Default TTL for offline messages in seconds (default: 86400)
    maxOfflineMessages?: number; // Max messages to queue per client (default: 100)
    enablePersistence?: boolean; // Enable offline message persistence (default: true)
}
```

## Examples

### Real-time Chat

```typescript
// Client
const client = new RealtimeClient({
    url: 'wss://your-worker.workers.dev/realtime',
    clientId: currentUserId,
});

await client.connect();

client.subscribe(`chat:room:${roomId}`, (event, data) => {
    if (event === 'message') {
        displayMessage(data);
    }

    if (event === 'user-typing') {
        showTypingIndicator(data.userId);
    }
});

// Server - Broadcasting new message
await broadcaster.send(`chat:room:${roomId}`, 'message', {
    userId: senderId,
    text: messageText,
    timestamp: Date.now(),
});
```

### Live Notifications

```typescript
// Subscribe to user-specific notifications
client.subscribe(`notifications:user:${userId}`, (event, data, metadata) => {
    showNotification(data.title, data.message);

    // Handle offline notifications
    if (metadata?.offline) {
        // Was queued while offline - mark as read
        markAsRead(data.id);
    }
});

// Server - Send notification
await broadcaster.send(
    `notifications:user:${userId}`,
    'notification',
    {
        id: notificationId,
        title: 'New Comment',
        message: 'Someone commented on your post',
    },
    { persistForOffline: true },
);
```

### Collaborative Editing

```typescript
// Subscribe to document changes
client.subscribe(`document:${docId}`, (event, data) => {
    if (event === 'update') {
        applyOperationalTransform(data.operations);
    }

    if (event === 'cursor-move') {
        updateRemoteCursor(data.userId, data.position);
    }
});

// Server - Broadcast document changes
await broadcaster.send(`document:${docId}`, 'update', {
    operations: [
        /* OT operations */
    ],
    userId: editorId,
    version: docVersion,
});
```

## Migration from Pusher

cf-realtime provides a Pusher-like API, making migration straightforward:

| Pusher                                   | cf-realtime                              |
| ---------------------------------------- | ---------------------------------------- |
| `pusher.subscribe(channel, callback)`    | `client.subscribe(channel, callback)`    |
| `pusher.unsubscribe(channel)`            | `client.unsubscribe(channel)`            |
| `pusher.trigger(channel, event, data)`   | `broadcaster.send(channel, event, data)` |
| `pusher.connection.bind('state_change')` | `client.onStateChange(handler)`          |

## Performance

- **WebSocket Hibernation**: Cloudflare Durable Objects support WebSocket hibernation, reducing costs for idle
  connections
- **Global Distribution**: Durable Objects are automatically distributed globally
- **Auto-scaling**: Scales automatically with your traffic
- **Low Latency**: Messages delivered in milliseconds

## License

MIT

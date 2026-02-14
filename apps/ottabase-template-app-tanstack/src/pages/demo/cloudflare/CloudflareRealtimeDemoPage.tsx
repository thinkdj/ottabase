import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { api, ApiError, isApiError } from '@/lib/api';
import { ConnectionState, RealtimeClient } from '@ottabase/cf-realtime';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea, toast } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

interface Message {
    id: string;
    channel: string;
    event: string;
    data: unknown;
    timestamp: number;
    isOffline?: boolean;
}

interface Stats {
    totalConnections: number;
    channels: { channel: string; subscriberCount: number }[];
    offlineMessagesQueued: number;
}

export function CloudflareRealtimeDemoPage() {
    const [client, setClient] = useState<RealtimeClient | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
    const [subscribedChannels, setSubscribedChannels] = useState<string[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [serviceError, setServiceError] = useState<ApiError | null>(null);

    const [channelToSubscribe, setChannelToSubscribe] = useState('');
    const [broadcastChannel, setBroadcastChannel] = useState('');
    const [broadcastEvent, setBroadcastEvent] = useState('notification');
    const [broadcastData, setBroadcastData] = useState('{"message":"Hello!"}');
    const [persistOffline, setPersistOffline] = useState(false);

    const clientRef = useRef<RealtimeClient | null>(null);

    const handleConnect = async () => {
        try {
            setError(null);

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/api/cloudflare/realtime/ws`;

            const realtimeClient = new RealtimeClient({
                url: wsUrl,
                clientId: `demo-${Math.random().toString(36).slice(2, 11)}`,
                autoReconnect: true,
                debug: true,
            });

            realtimeClient.onStateChange((state) => {
                setConnectionState(state);
            });

            realtimeClient.onError((err) => {
                setError(err.message);
            });

            await realtimeClient.connect();
            setClient(realtimeClient);
            clientRef.current = realtimeClient;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
            setError(errorMessage);
            toast.error('Connection failed', { description: errorMessage });
        }
    };

    const handleDisconnect = () => {
        if (client) {
            client.disconnect();
            setClient(null);
            clientRef.current = null;
            setSubscribedChannels([]);
            setConnectionState(ConnectionState.DISCONNECTED);
        }
    };

    const handleSubscribe = () => {
        if (!client || !channelToSubscribe) return;

        const channel = channelToSubscribe.trim();
        if (subscribedChannels.includes(channel)) {
            setError(`Already subscribed to ${channel}`);
            return;
        }

        client.subscribe(channel, (event, data, metadata) => {
            const message: Message = {
                id: `msg-${Date.now()}-${Math.random()}`,
                channel,
                event,
                data,
                timestamp: Date.now(),
                isOffline: metadata?.offline || false,
            };

            setMessages((prev) => [message, ...prev].slice(0, 50));
        });

        setSubscribedChannels((prev) => [...prev, channel]);
        setChannelToSubscribe('');
        setError(null);
    };

    const handleUnsubscribe = (channel: string) => {
        if (!client) return;
        client.unsubscribe(channel);
        setSubscribedChannels((prev) => prev.filter((c) => c !== channel));
    };

    const handleBroadcast = async () => {
        try {
            setError(null);

            const channels = broadcastChannel
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean);
            if (channels.length === 0) {
                setError('Please enter at least one channel');
                return;
            }

            let data: unknown;
            try {
                data = JSON.parse(broadcastData);
            } catch {
                data = broadcastData;
            }

            await api('/api/cloudflare/realtime/broadcast', {
                method: 'POST',
                body: {
                    channels,
                    event: broadcastEvent,
                    data,
                    persistForOffline: persistOffline,
                },
            });

            await fetchStats();
        } catch (err) {
            // API errors are automatically shown via toast by the global handler
            // Just update local error state for inline display
            const errorMessage = isApiError(err) ? err.message : 'Failed to broadcast';
            setError(errorMessage);
        }
    };

    const fetchStats = async () => {
        try {
            const data = await api<Stats>('/api/cloudflare/realtime/stats');
            setStats(data);
            setServiceError(null);
        } catch (err) {
            if (isApiError(err) && err.status === 501) {
                setServiceError(err);
                setStats(null);
            }
            // Other errors are silently ignored (network errors, etc.)
        }
    };

    useEffect(() => {
        void fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        return () => {
            if (clientRef.current) clientRef.current.disconnect();
        };
    }, []);

    return (
        <div className="space-y-6">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo/cloudflare">← Back to Cloudflare Features</Link>
            </Button>

            <div>
                <h1 className="mb-2 text-3xl font-semibold">Realtime Pub/Sub Demo</h1>
                <p className="text-muted-foreground">WebSocket-based real-time messaging with offline support</p>
            </div>

            {serviceError ? (
                <ApiErrorDisplay error={serviceError} />
            ) : (
                <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">
                        Durable Objects may require deployment to test (depending on your local Wrangler setup).
                    </p>
                </div>
            )}

            {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Connection</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="rounded-lg border bg-muted/50 p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Status: {connectionState}</span>
                                    <div
                                        className={`h-2 w-2 rounded-full ${
                                            connectionState === ConnectionState.CONNECTED
                                                ? 'bg-primary'
                                                : 'bg-muted-foreground'
                                        }`}
                                    />
                                </div>
                            </div>

                            {!client ? (
                                <Button onClick={handleConnect} className="w-full" disabled={!!serviceError}>
                                    {serviceError ? 'Service Unavailable' : 'Connect'}
                                </Button>
                            ) : (
                                <Button onClick={handleDisconnect} variant="destructive" className="w-full">
                                    Disconnect
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Subscribe to Channel</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Input
                                value={channelToSubscribe}
                                onChange={(e) => setChannelToSubscribe(e.target.value)}
                                placeholder="e.g., org-1201, user-22, system"
                                disabled={!client}
                                onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
                            />

                            <Button
                                onClick={handleSubscribe}
                                disabled={!client || !channelToSubscribe}
                                className="w-full"
                            >
                                Subscribe
                            </Button>

                            {subscribedChannels.length > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Subscribed ({subscribedChannels.length}):
                                    </p>
                                    {subscribedChannels.map((channel) => (
                                        <div
                                            key={channel}
                                            className="flex items-center justify-between rounded-lg bg-muted p-2"
                                        >
                                            <span className="text-sm">{channel}</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleUnsubscribe(channel)}
                                            >
                                                Unsubscribe
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Broadcast Message</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Channels (comma-separated)</label>
                                <Input
                                    value={broadcastChannel}
                                    onChange={(e) => setBroadcastChannel(e.target.value)}
                                    placeholder="org-1201, user-22"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Event Name</label>
                                <Input
                                    value={broadcastEvent}
                                    onChange={(e) => setBroadcastEvent(e.target.value)}
                                    placeholder="notification"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Data (JSON)</label>
                                <Textarea
                                    value={broadcastData}
                                    onChange={(e) => setBroadcastData(e.target.value)}
                                    placeholder='{"message":"Hello!"}'
                                    rows={3}
                                />
                            </div>

                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={persistOffline}
                                    onChange={(e) => setPersistOffline(e.target.checked)}
                                    className="h-4 w-4 rounded border-input"
                                />
                                <span className="text-sm text-muted-foreground">Persist for offline clients</span>
                            </label>

                            <Button
                                onClick={handleBroadcast}
                                disabled={!broadcastChannel || !broadcastEvent || !!serviceError}
                                className="w-full"
                            >
                                Broadcast
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Messages ({messages.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="max-h-96 space-y-2 overflow-y-auto">
                                {messages.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-muted-foreground">
                                        No messages yet. Subscribe and broadcast.
                                    </p>
                                ) : (
                                    messages.map((msg) => (
                                        <div key={msg.id} className="rounded-lg border bg-muted/50 p-3">
                                            <div className="mb-1 flex items-center justify-between">
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    {msg.channel}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <p className="mb-1 text-sm font-medium">{msg.event}</p>
                                            <pre className="overflow-x-auto text-xs">
                                                {JSON.stringify(msg.data, null, 2)}
                                            </pre>
                                            {msg.isOffline ? (
                                                <span className="mt-1 inline-block rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                    Offline Message
                                                </span>
                                            ) : null}
                                        </div>
                                    ))
                                )}
                            </div>

                            {messages.length > 0 ? (
                                <Button onClick={() => setMessages([])} variant="outline" className="w-full">
                                    Clear Messages
                                </Button>
                            ) : null}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">System Stats</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {serviceError ? (
                                <p className="text-sm text-muted-foreground">
                                    Stats unavailable - service not configured
                                </p>
                            ) : stats ? (
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total Connections:</span>
                                        <span className="font-medium">{stats.totalConnections}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Active Channels:</span>
                                        <span className="font-medium">{stats.channels.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Offline Messages:</span>
                                        <span className="font-medium">{stats.offlineMessagesQueued}</span>
                                    </div>

                                    {stats.channels.length > 0 ? (
                                        <div className="pt-2">
                                            <p className="mb-2 text-sm font-medium text-muted-foreground">
                                                Channel Details:
                                            </p>
                                            <div className="space-y-2">
                                                {stats.channels.map((ch) => (
                                                    <div
                                                        key={ch.channel}
                                                        className="flex justify-between rounded bg-muted px-3 py-2 text-xs"
                                                    >
                                                        <span>{ch.channel}</span>
                                                        <span className="text-muted-foreground">
                                                            {ch.subscriberCount} subscriber
                                                            {ch.subscriberCount !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Loading stats...</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { RealtimeClient, ConnectionState } from '@ottabase/cf-realtime';

interface Message {
  id: string;
  channel: string;
  event: string;
  data: any;
  timestamp: number;
  isOffline?: boolean;
}

interface Stats {
  totalConnections: number;
  channels: { channel: string; subscriberCount: number }[];
  offlineMessagesQueued: number;
}

export default function RealtimeDemoPage() {
  const [client, setClient] = useState<RealtimeClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [subscribedChannels, setSubscribedChannels] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [channelToSubscribe, setChannelToSubscribe] = useState('');
  const [broadcastChannel, setBroadcastChannel] = useState('');
  const [broadcastEvent, setBroadcastEvent] = useState('notification');
  const [broadcastData, setBroadcastData] = useState('{"message":"Hello!"}');
  const [persistOffline, setPersistOffline] = useState(false);

  const clientRef = useRef<RealtimeClient | null>(null);

  // Connect to realtime
  const handleConnect = async () => {
    try {
      setError(null);

      // Determine WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/cloudflare/realtime/ws`;

      const realtimeClient = new RealtimeClient({
        url: wsUrl,
        clientId: `demo-${Math.random().toString(36).substr(2, 9)}`,
        autoReconnect: true,
        debug: true,
      });

      // Listen to connection state changes
      realtimeClient.onStateChange((state) => {
        setConnectionState(state);
      });

      // Listen to errors
      realtimeClient.onError((err) => {
        setError(err.message);
        console.error('Realtime error:', err);
      });

      await realtimeClient.connect();
      setClient(realtimeClient);
      clientRef.current = realtimeClient;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  };

  // Disconnect
  const handleDisconnect = () => {
    if (client) {
      client.disconnect();
      setClient(null);
      clientRef.current = null;
      setSubscribedChannels([]);
      setConnectionState(ConnectionState.DISCONNECTED);
    }
  };

  // Subscribe to a channel
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

      setMessages((prev) => [message, ...prev].slice(0, 50)); // Keep last 50 messages
    });

    setSubscribedChannels((prev) => [...prev, channel]);
    setChannelToSubscribe('');
    setError(null);
  };

  // Unsubscribe from a channel
  const handleUnsubscribe = (channel: string) => {
    if (!client) return;

    client.unsubscribe(channel);
    setSubscribedChannels((prev) => prev.filter((c) => c !== channel));
  };

  // Broadcast a message
  const handleBroadcast = async () => {
    try {
      setError(null);

      const channels = broadcastChannel.split(',').map((c) => c.trim()).filter(Boolean);
      if (channels.length === 0) {
        setError('Please enter at least one channel');
        return;
      }

      let data;
      try {
        data = JSON.parse(broadcastData);
      } catch {
        data = broadcastData;
      }

      const response = await fetch('/api/cloudflare/realtime/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channels,
          event: broadcastEvent,
          data,
          persistForOffline: persistOffline,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to broadcast');
      }

      // Refresh stats after broadcast
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to broadcast');
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/cloudflare/realtime/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  // Auto-refresh stats
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  const getStateColor = (state: ConnectionState) => {
    switch (state) {
      case ConnectionState.CONNECTED:
        return 'text-green-600 bg-green-50 border-green-200';
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case ConnectionState.DISCONNECTED:
        return 'text-gray-600 bg-gray-50 border-gray-200';
      case ConnectionState.FAILED:
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-semibold text-gray-900">
            Realtime Pub/Sub Demo
          </h1>
          <p className="text-gray-600">
            WebSocket-based real-time messaging with offline support
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Connection & Channels */}
          <div className="space-y-6">
            {/* Connection Status */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-medium text-gray-900">Connection</h2>

              <div className={`mb-4 rounded-lg border p-3 ${getStateColor(connectionState)}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Status: {connectionState}
                  </span>
                  <div className={`h-2 w-2 rounded-full ${
                    connectionState === ConnectionState.CONNECTED ? 'bg-green-600' : 'bg-gray-400'
                  }`} />
                </div>
              </div>

              <div className="flex gap-2">
                {!client ? (
                  <button
                    onClick={handleConnect}
                    className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
                  >
                    Connect
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnect}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* Subscribe to Channel */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-medium text-gray-900">Subscribe to Channel</h2>

              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={channelToSubscribe}
                    onChange={(e) => setChannelToSubscribe(e.target.value)}
                    placeholder="e.g., org-1201, user-22, system"
                    disabled={!client}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                  />
                </div>

                <button
                  onClick={handleSubscribe}
                  disabled={!client || !channelToSubscribe}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
                >
                  Subscribe
                </button>
              </div>

              {/* Subscribed Channels */}
              {subscribedChannels.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Subscribed ({subscribedChannels.length}):
                  </p>
                  {subscribedChannels.map((channel) => (
                    <div
                      key={channel}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                    >
                      <span className="text-sm text-gray-700">{channel}</span>
                      <button
                        onClick={() => handleUnsubscribe(channel)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Unsubscribe
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Broadcast Message */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-medium text-gray-900">Broadcast Message</h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Channels (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={broadcastChannel}
                    onChange={(e) => setBroadcastChannel(e.target.value)}
                    placeholder="org-1201, user-22"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Event Name
                  </label>
                  <input
                    type="text"
                    value={broadcastEvent}
                    onChange={(e) => setBroadcastEvent(e.target.value)}
                    placeholder="notification"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Data (JSON)
                  </label>
                  <textarea
                    value={broadcastData}
                    onChange={(e) => setBroadcastData(e.target.value)}
                    placeholder='{"message":"Hello!"}'
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none"
                  />
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={persistOffline}
                    onChange={(e) => setPersistOffline(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">
                    Persist for offline clients
                  </span>
                </label>

                <button
                  onClick={handleBroadcast}
                  disabled={!broadcastChannel || !broadcastEvent}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                >
                  Broadcast
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Messages & Stats */}
          <div className="space-y-6">
            {/* Messages */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-medium text-gray-900">
                Messages ({messages.length})
              </h2>

              <div className="max-h-96 space-y-2 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-8">
                    No messages yet. Subscribe to a channel and broadcast a message to see them here.
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg border p-3 ${
                        msg.isOffline
                          ? 'border-yellow-200 bg-yellow-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">
                          {msg.channel}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mb-1 text-sm font-medium text-gray-900">
                        {msg.event}
                      </p>
                      <pre className="text-xs text-gray-700 overflow-x-auto">
                        {JSON.stringify(msg.data, null, 2)}
                      </pre>
                      {msg.isOffline && (
                        <span className="mt-1 inline-block rounded bg-yellow-200 px-2 py-0.5 text-xs text-yellow-800">
                          Offline Message
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>

              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Clear Messages
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-medium text-gray-900">
                System Stats
              </h2>

              {stats ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Connections:</span>
                    <span className="font-medium text-gray-900">
                      {stats.totalConnections}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Active Channels:</span>
                    <span className="font-medium text-gray-900">
                      {stats.channels.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Offline Messages:</span>
                    <span className="font-medium text-gray-900">
                      {stats.offlineMessagesQueued}
                    </span>
                  </div>

                  {stats.channels.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-sm font-medium text-gray-700">
                        Channel Details:
                      </p>
                      <div className="space-y-2">
                        {stats.channels.map((ch) => (
                          <div
                            key={ch.channel}
                            className="flex justify-between rounded bg-gray-50 px-3 py-2 text-xs"
                          >
                            <span className="text-gray-700">{ch.channel}</span>
                            <span className="text-gray-500">
                              {ch.subscriberCount} subscriber{ch.subscriberCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Loading stats...</p>
              )}
            </div>
          </div>
        </div>

        {/* Implementation Notes */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Implementation Notes
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Uses @ottabase/cf-realtime package built on Cloudflare Actors</li>
            <li>• WebSocket connections with auto-reconnect and exponential backoff</li>
            <li>• Channel-based pub/sub (subscribe to org-*, user-*, system, etc.)</li>
            <li>• Offline message queuing - messages delivered when clients reconnect</li>
            <li>• Global Durable Object instance for demo (can scale to multiple instances)</li>
            <li>• Works locally with wrangler dev and in production on Cloudflare</li>
            <li>• Try disconnecting and reconnecting to test offline message delivery</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

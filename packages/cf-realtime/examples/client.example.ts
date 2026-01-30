/**
 * Example client usage for cf-realtime
 *
 * This demonstrates various client patterns and use cases.
 */

import { ConnectionState, RealtimeClient } from '@ottabase/cf-realtime';

// ============================================================================
// EXAMPLE 1: Basic Connection and Subscription
// ============================================================================

async function basicExample() {
    const client = new RealtimeClient({
        url: 'wss://your-worker.workers.dev/realtime',
        clientId: 'user-123',
        debug: true,
    });

    // Connect to server
    await client.connect();

    // Subscribe to a channel
    client.subscribe('org-1201', (event, data, metadata) => {
        console.log(`Event: ${event}`, data, metadata);
    });

    // Later, disconnect
    // client.disconnect();
}

// ============================================================================
// EXAMPLE 2: Multiple Channels with Different Handlers
// ============================================================================

async function multipleChannelsExample() {
    const client = new RealtimeClient({
        url: 'wss://your-worker.workers.dev/realtime',
    });

    await client.connect();

    // Organization updates
    client.subscribe('org-1201', (event, data) => {
        console.log('Organization update:', event, data);
    });

    // User-specific messages
    client.subscribe('user-22', (event, data) => {
        console.log('User message:', event, data);
    });

    // Group notifications
    client.subscribe('group-50', (event, data) => {
        console.log('Group notification:', event, data);
    });

    // System-wide broadcasts
    client.subscribe('system', (event, data, metadata) => {
        if (event === 'maintenance') {
            showMaintenanceNotice(data.message);
        }
    });
}

// ============================================================================
// EXAMPLE 3: Connection State Management
// ============================================================================

async function connectionStateExample() {
    const client = new RealtimeClient({
        url: 'wss://your-worker.workers.dev/realtime',
        autoReconnect: true,
        maxReconnectAttempts: 5,
    });

    // Listen to state changes
    client.onStateChange((state: ConnectionState) => {
        switch (state) {
            case 'connecting':
                showStatus('Connecting...');
                break;
            case 'connected':
                showStatus('Connected!');
                break;
            case 'disconnected':
                showStatus('Disconnected');
                break;
            case 'reconnecting':
                showStatus('Reconnecting...');
                break;
            case 'failed':
                showStatus('Connection failed');
                break;
        }
    });

    // Error handling
    client.onError((error) => {
        console.error('Realtime error:', error);
        logErrorToService(error);
    });

    await client.connect();
}

// ============================================================================
// EXAMPLE 4: Chat Application
// ============================================================================

interface ChatMessage {
    userId: string;
    username: string;
    text: string;
    timestamp: number;
}

async function chatExample(roomId: string, currentUserId: string) {
    const client = new RealtimeClient({
        url: 'wss://your-worker.workers.dev/realtime',
        clientId: currentUserId,
    });

    await client.connect();

    // Subscribe to chat room
    client.subscribe(`chat:room:${roomId}`, (event, data: ChatMessage, metadata) => {
        if (event === 'message') {
            // Display the message
            displayChatMessage({
                userId: data.userId,
                username: data.username,
                text: data.text,
                timestamp: data.timestamp,
                isOffline: metadata?.offline || false,
            });
        }

        if (event === 'user-typing') {
            showTypingIndicator(data.username);
        }

        if (event === 'user-joined') {
            showNotification(`${data.username} joined the chat`);
        }

        if (event === 'user-left') {
            showNotification(`${data.username} left the chat`);
        }
    });

    // Handle offline messages
    console.log('Catching up on messages sent while you were offline...');
}

// ============================================================================
// EXAMPLE 5: Notification System
// ============================================================================

interface Notification {
    id: string;
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high';
    actionUrl?: string;
}

async function notificationExample(userId: string) {
    const client = new RealtimeClient({
        url: 'wss://your-worker.workers.dev/realtime',
        clientId: userId,
    });

    await client.connect();

    // Subscribe to user notifications
    client.subscribe(`notifications:user:${userId}`, (event, data: Notification, metadata) => {
        if (event === 'notification') {
            // Check if this was queued while offline
            const isOffline = metadata?.offline || false;

            // Show notification
            showNotification({
                title: data.title,
                message: data.message,
                priority: data.priority,
                actionUrl: data.actionUrl,
                badge: isOffline ? 'Missed' : 'New',
            });

            // Play sound for high priority (only if not offline)
            if (data.priority === 'high' && !isOffline) {
                playNotificationSound();
            }

            // Mark as read
            markNotificationAsRead(data.id);
        }
    });

    // System notifications
    client.subscribe('system', (event, data) => {
        if (event === 'system-update') {
            // Perform action based on system update
            handleSystemUpdate(data);
        }
    });
}

// ============================================================================
// EXAMPLE 6: Collaborative Document Editing
// ============================================================================

interface DocumentOperation {
    type: 'insert' | 'delete' | 'format';
    position: number;
    content?: string;
    userId: string;
    version: number;
}

interface CursorPosition {
    userId: string;
    username: string;
    position: number;
    color: string;
}

async function collaborativeEditingExample(documentId: string, userId: string) {
    const client = new RealtimeClient({
        url: 'wss://your-worker.workers.dev/realtime',
        clientId: userId,
    });

    await client.connect();

    // Subscribe to document updates
    client.subscribe(`document:${documentId}`, (event, data) => {
        if (event === 'operation') {
            const operation = data as DocumentOperation;

            // Apply operational transformation
            applyOperationalTransform(operation);

            // Update UI
            updateDocumentView();
        }

        if (event === 'cursor-move') {
            const cursor = data as CursorPosition;

            // Show remote cursor
            if (cursor.userId !== userId) {
                updateRemoteCursor(cursor);
            }
        }

        if (event === 'user-joined') {
            showCollaborator(data.userId, data.username);
        }

        if (event === 'user-left') {
            removeCollaborator(data.userId);
        }
    });
}

// ============================================================================
// EXAMPLE 7: Dynamic Subscriptions
// ============================================================================

async function dynamicSubscriptionsExample() {
    const client = new RealtimeClient({
        url: 'wss://your-worker.workers.dev/realtime',
    });

    await client.connect();

    const activeSubscriptions = new Map<string, () => void>();

    // Function to subscribe to a channel
    function subscribeToChannel(channel: string) {
        if (activeSubscriptions.has(channel)) {
            console.log(`Already subscribed to ${channel}`);
            return;
        }

        const unsubscribe = client.subscribe(channel, (event, data) => {
            console.log(`[${channel}] ${event}:`, data);
        });

        activeSubscriptions.set(channel, unsubscribe);
        console.log(`Subscribed to ${channel}`);
    }

    // Function to unsubscribe from a channel
    function unsubscribeFromChannel(channel: string) {
        const unsubscribe = activeSubscriptions.get(channel);
        if (unsubscribe) {
            unsubscribe();
            activeSubscriptions.delete(channel);
            console.log(`Unsubscribed from ${channel}`);
        }
    }

    // Example: User navigates to different orgs
    subscribeToChannel('org-1201');

    // Later, user switches to different org
    unsubscribeFromChannel('org-1201');
    subscribeToChannel('org-5000');

    // User joins a group
    subscribeToChannel('group-789');

    // Cleanup all subscriptions on logout
    function cleanup() {
        activeSubscriptions.forEach((unsubscribe) => unsubscribe());
        activeSubscriptions.clear();
        client.disconnect();
    }
}

// ============================================================================
// EXAMPLE 8: React Hook Integration
// ============================================================================

import { createElement, useCallback, useEffect, useState } from 'react';

function useRealtime(url: string, clientId?: string) {
    const [client, setClient] = useState<RealtimeClient | null>(null);
    const [state, setState] = useState<ConnectionState>('disconnected');

    useEffect(() => {
        const realtimeClient = new RealtimeClient({
            url,
            clientId,
            autoReconnect: true,
            debug: process.env.NODE_ENV === 'development',
        });

        realtimeClient.onStateChange(setState);

        realtimeClient.connect();
        setClient(realtimeClient);

        return () => {
            realtimeClient.disconnect();
        };
    }, [url, clientId]);

    const subscribe = useCallback(
        (channel: string, handler: (event: string, data: any, metadata?: any) => void) => {
            if (!client) return () => {};
            return client.subscribe(channel, handler);
        },
        [client],
    );

    return { client, state, subscribe };
}

// Usage in React component
function ChatComponent({ roomId }: { roomId: string }) {
    const { state, subscribe } = useRealtime('wss://your-worker.workers.dev/realtime');
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    useEffect(() => {
        const unsubscribe = subscribe(`chat:room:${roomId}`, (event, data) => {
            if (event === 'message') {
                setMessages((prev) => [...prev, data]);
            }
        });

        return unsubscribe;
    }, [roomId, subscribe]);

    return createElement(
        'div',
        null,
        createElement('div', null, `Connection: ${state}`),
        ...messages.map((msg, i) => createElement('div', { key: i }, `${msg.username}: ${msg.text}`)),
    );
}

// ============================================================================
// Helper Functions (mock implementations)
// ============================================================================

function showStatus(message: string) {
    console.log('Status:', message);
}

function logErrorToService(error: Error) {
    console.error('Logging error:', error);
}

function displayChatMessage(message: any) {
    console.log('Chat message:', message);
}

function showTypingIndicator(username: string) {
    console.log(`${username} is typing...`);
}

function showNotification(message: any) {
    console.log('Notification:', message);
}

function showMaintenanceNotice(message: string) {
    console.log('Maintenance:', message);
}

function markNotificationAsRead(id: string) {
    console.log('Mark as read:', id);
}

function playNotificationSound() {
    console.log('Playing sound...');
}

function handleSystemUpdate(data: any) {
    console.log('System update:', data);
}

function applyOperationalTransform(operation: DocumentOperation) {
    console.log('Applying operation:', operation);
}

function updateDocumentView() {
    console.log('Updating document view');
}

function updateRemoteCursor(cursor: CursorPosition) {
    console.log('Remote cursor:', cursor);
}

function showCollaborator(userId: string, username: string) {
    console.log(`Collaborator joined: ${username}`);
}

function removeCollaborator(userId: string) {
    console.log(`Collaborator left: ${userId}`);
}

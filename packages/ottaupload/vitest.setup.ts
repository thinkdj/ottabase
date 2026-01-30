import { vi } from 'vitest';

// Mock crypto.randomUUID for Node environment
if (typeof crypto === 'undefined') {
    global.crypto = {
        randomUUID: () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        },
    } as Crypto;
}

// Mock XMLHttpRequest for tests
class MockXMLHttpRequest {
    public status = 200;
    public responseText = '';
    public upload = {
        addEventListener: vi.fn(),
    };
    private listeners: Record<string, Function[]> = {};

    addEventListener(event: string, handler: Function) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(handler);
    }

    open = vi.fn();
    send = vi.fn((data: FormData) => {
        // Simulate successful upload
        setTimeout(() => {
            this.responseText = JSON.stringify({
                success: true,
                url: '/uploads/test-file.txt',
                key: 'test-file-123.txt',
            });
            this.trigger('load');
        }, 10);
    });

    trigger(event: string) {
        if (this.listeners[event]) {
            this.listeners[event].forEach((handler) => handler());
        }
    }
}

// @ts-ignore
global.XMLHttpRequest = MockXMLHttpRequest;

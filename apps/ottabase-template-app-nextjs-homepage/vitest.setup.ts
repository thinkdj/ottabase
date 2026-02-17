import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { createElement } from 'react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
    cleanup();
});

// Mock Next.js router
vi.mock('next/router', () => ({
    useRouter: () => ({
        push: vi.fn(),
        pathname: '/',
        query: {},
        asPath: '/',
        isReady: true,
        replace: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        prefetch: vi.fn(),
    }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/',
}));

// Mock next/image
vi.mock('next/image', () => ({
    default: ({ src, alt, ...props }: any) => createElement('img', { src, alt, ...props }),
}));

// Mock Cloudflare Bindings for worker context
beforeAll(() => {
    // Mock global fetch for tests
    global.fetch = vi.fn();

    // Mock Cloudflare bindings in global scope
    (global as any).OBCF_D1 = {
        prepare: vi.fn().mockReturnValue({
            bind: vi.fn().mockReturnValue({}),
            all: vi.fn(),
            first: vi.fn(),
            run: vi.fn(),
        }),
    };

    (global as any).OBCF_KV = {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
    };

    (global as any).OBCF_R2 = {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
    };

    (global as any).OBCF_QUEUE = {
        send: vi.fn(),
        sendBatch: vi.fn(),
    };

    (global as any).OBCF_RATE_LIMITER = {
        limit: vi.fn().mockResolvedValue({ success: true }),
    };
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() {
        return [];
    }
    unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
} as any;

afterAll(() => {
    vi.clearAllMocks();
});

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
    cleanup();
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

// Suppress console errors in tests (optional - remove if you want to see them)
const originalError = console.error;
beforeAll(() => {
    console.error = (...args: any[]) => {
        if (
            typeof args[0] === 'string' &&
            (args[0].includes('Warning: ReactDOM.render') ||
                args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
        ) {
            return;
        }
        originalError.call(console, ...args);
    };

    // Attempt to mock AuditLog.create without awaiting import to avoid
    // blocking the global beforeAll hook if the module has heavy side effects.
    import('./packages/ottaorm/src/models/AuditLog')
        .then((AuditLogModule) => {
            if (AuditLogModule?.AuditLog && typeof AuditLogModule.AuditLog.create === 'function') {
                vi.spyOn(AuditLogModule.AuditLog, 'create').mockResolvedValue({} as any);
            }
        })
        .catch(() => {
            // ignore if module not present or import fails
        });
});

afterAll(() => {
    console.error = originalError;
});

import { beforeAll, afterAll, vi } from 'vitest';

// Mock crypto.randomUUID if not available
beforeAll(() => {
  if (!global.crypto) {
    global.crypto = {
      randomUUID: () => Math.random().toString(36).substring(2, 15),
    } as any;
  }
});

// Mock XMLHttpRequest for upload tests
global.XMLHttpRequest = class XMLHttpRequest {
  upload = {
    addEventListener: vi.fn(),
  };
  addEventListener = vi.fn();
  open = vi.fn();
  send = vi.fn();
  status = 200;
  responseText = JSON.stringify({ success: true, url: 'http://example.com/file.jpg', key: 'test-key' });
} as any;

afterAll(() => {
  vi.clearAllMocks();
});

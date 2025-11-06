/**
 * Mock WebSocket implementation for testing
 */

import { vi } from "vitest";

export class MockWebSocket {
  public readyState: number = 0; // CONNECTING
  public url: string;
  public onopen: ((event: any) => void) | null = null;
  public onclose: ((event: any) => void) | null = null;
  public onerror: ((event: any) => void) | null = null;
  public onmessage: ((event: any) => void) | null = null;

  // Mock methods
  public send = vi.fn();
  public close = vi.fn();

  // Helper methods for testing
  private messageQueue: any[] = [];

  constructor(url: string) {
    this.url = url;
  }

  // Simulate connection opening
  simulateOpen() {
    this.readyState = 1; // OPEN
    if (this.onopen) {
      this.onopen({ type: "open" });
    }
  }

  // Simulate connection closing
  simulateClose(code: number = 1000, reason: string = "Normal closure") {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ type: "close", code, reason });
    }
  }

  // Simulate error
  simulateError(error: any = new Error("WebSocket error")) {
    if (this.onerror) {
      this.onerror({ type: "error", error });
    }
  }

  // Simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({
        type: "message",
        data: typeof data === "string" ? data : JSON.stringify(data),
      });
    }
  }

  // Get sent messages
  getSentMessages() {
    return this.send.mock.calls.map((call) => {
      const data = call[0];
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    });
  }

  // Clear sent messages
  clearSentMessages() {
    this.send.mockClear();
  }
}

// Mock WebSocket constants
MockWebSocket.prototype.CONNECTING = 0;
MockWebSocket.prototype.OPEN = 1;
MockWebSocket.prototype.CLOSING = 2;
MockWebSocket.prototype.CLOSED = 3;

/**
 * Create a mock WebSocket constructor for testing
 */
export function createMockWebSocketConstructor() {
  let instances: MockWebSocket[] = [];

  const MockWSConstructor = vi.fn((url: string) => {
    const instance = new MockWebSocket(url);
    instances.push(instance);
    return instance;
  });

  // Helper to get all created instances
  MockWSConstructor.getInstances = () => instances;

  // Helper to get the last created instance
  MockWSConstructor.getLastInstance = () => instances[instances.length - 1];

  // Helper to clear instances
  MockWSConstructor.clearInstances = () => {
    instances = [];
  };

  return MockWSConstructor;
}

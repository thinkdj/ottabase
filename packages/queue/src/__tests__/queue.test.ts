import { describe, it, expect, vi, beforeEach } from "vitest";
import { createJob, createDispatcher, Dispatcher } from "../job";
import { createRegistry, HandlerRegistry, createProcessor } from "../processor";
import type { QueuedJob, JobContext, DispatchOptions, DedupeStore } from "../types";

describe("Queue Package", () => {
  describe("Job Creation", () => {
    it("should create a job with type and payload", () => {
      const job = createJob("send-email", { to: "user@example.com" });

      expect(job.type).toBe("send-email");
      expect(job.payload).toEqual({ to: "user@example.com" });
      expect(job.meta).toBeDefined();
      expect(job.meta?.id).toBeDefined();
      expect(job.meta?.dispatchedAt).toBeDefined();
    });

    it("should include options in job metadata", () => {
      const options: DispatchOptions = {
        maxAttempts: 5,
        tags: ["important", "email"],
      };
      const job = createJob("send-email", { to: "test@example.com" }, options);

      expect(job.meta?.maxAttempts).toBe(5);
      expect(job.meta?.tags).toEqual(["important", "email"]);
    });

    it("should generate unique job IDs", () => {
      const job1 = createJob("task", {});
      const job2 = createJob("task", {});

      expect(job1.meta?.id).not.toBe(job2.meta?.id);
    });

    it("should include priority in job metadata", () => {
      const job = createJob("task", {}, { priority: "high" });
      expect(job.meta?.priority).toBe("high");
    });

    it("should include chained jobs in metadata", () => {
      const job = createJob("task", {}, {
        then: [
          { type: "follow-up", payload: { id: 1 } },
          { type: "notify", payload: { id: 2 }, delay: 60 },
        ],
      });

      expect(job.meta?.chain).toHaveLength(2);
      expect(job.meta?.chain?.[0].type).toBe("follow-up");
      expect(job.meta?.chain?.[1].delay).toBe(60);
    });
  });

  describe("Handler Registry", () => {
    let registry: HandlerRegistry<unknown>;

    beforeEach(() => {
      registry = createRegistry();
    });

    it("should register handlers for job types", () => {
      const handler = vi.fn();
      registry.register("send-email", handler);

      expect(registry.has("send-email")).toBe(true);
      expect(registry.get("send-email")?.handler).toBe(handler);
    });

    it("should support chained registration", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registry
        .register("send-email", handler1)
        .register("process-order", handler2);

      expect(registry.has("send-email")).toBe(true);
      expect(registry.has("process-order")).toBe(true);
    });

    it("should list all registered types", () => {
      registry
        .register("type-a", vi.fn())
        .register("type-b", vi.fn())
        .register("type-c", vi.fn());

      const types = registry.types();
      expect(types).toHaveLength(3);
      expect(types).toContain("type-a");
      expect(types).toContain("type-b");
      expect(types).toContain("type-c");
    });

    it("should set default handler", () => {
      const defaultHandler = vi.fn();
      registry.setDefault(defaultHandler);

      expect(registry.getDefault()).toBe(defaultHandler);
    });

    it("should return undefined for unregistered types", () => {
      expect(registry.get("nonexistent")).toBeUndefined();
      expect(registry.has("nonexistent")).toBe(false);
    });

    it("should register handler with options", () => {
      const handler = vi.fn();
      registry.register("task", handler, { maxAttempts: 10 });

      const registered = registry.get("task");
      expect(registered?.options?.maxAttempts).toBe(10);
    });
  });

  describe("Dispatcher", () => {
    it("should create dispatcher with queue config", () => {
      const mockQueue = { send: vi.fn(), sendBatch: vi.fn() };
      const dispatcher = createDispatcher({ queue: mockQueue as any });

      expect(dispatcher).toBeInstanceOf(Dispatcher);
    });

    it("should dispatch single job", async () => {
      const mockSend = vi.fn().mockResolvedValue({ success: true });
      const mockQueue = { send: mockSend, sendBatch: vi.fn() };
      const dispatcher = createDispatcher({ queue: mockQueue as any });

      const result = await dispatcher.dispatch("send-email", { to: "test@example.com" });

      expect(result.success).toBe(true);
    });

    it("should dispatch batch of jobs", async () => {
      const mockSendBatch = vi.fn().mockResolvedValue({ success: true });
      const mockQueue = { send: vi.fn(), sendBatch: mockSendBatch };
      const dispatcher = createDispatcher({ queue: mockQueue as any });

      const result = await dispatcher.dispatchBatch([
        { type: "task-1", payload: { id: 1 } },
        { type: "task-2", payload: { id: 2 } },
      ]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(2);
      }
    });

    it("should handle dispatch errors gracefully", async () => {
      const mockQueue = {
        send: vi.fn().mockRejectedValue(new Error("Queue unavailable")),
        sendBatch: vi.fn(),
      };
      const dispatcher = createDispatcher({ queue: mockQueue as any });

      const result = await dispatcher.dispatch("task", {});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe("Deduplication", () => {
    it("should dispatch job when no duplicate exists", async () => {
      const mockQueue = { send: vi.fn().mockResolvedValue({ success: true }), sendBatch: vi.fn() };
      const mockDedupeStore: DedupeStore = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };

      const dispatcher = createDispatcher({
        queue: mockQueue as any,
        dedupeStore: mockDedupeStore,
      });

      const result = await dispatcher.dispatch("sync-user", { userId: 123 }, {
        uniqueKey: "user-123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dispatched).toBe(true);
      }
      expect(mockDedupeStore.get).toHaveBeenCalledWith("dedupe:sync-user:user-123");
      expect(mockDedupeStore.put).toHaveBeenCalled();
    });

    it("should skip dispatch when duplicate exists", async () => {
      const mockQueue = { send: vi.fn(), sendBatch: vi.fn() };
      const mockDedupeStore: DedupeStore = {
        get: vi.fn().mockResolvedValue("1234567890"),
        put: vi.fn(),
      };

      const dispatcher = createDispatcher({
        queue: mockQueue as any,
        dedupeStore: mockDedupeStore,
      });

      const result = await dispatcher.dispatch("sync-user", { userId: 123 }, {
        uniqueKey: "user-123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dispatched).toBe(false);
      }
      expect(mockQueue.send).not.toHaveBeenCalled();
    });

    it("should use custom TTL for deduplication", async () => {
      const mockQueue = { send: vi.fn().mockResolvedValue({ success: true }), sendBatch: vi.fn() };
      const mockDedupeStore: DedupeStore = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };

      const dispatcher = createDispatcher({
        queue: mockQueue as any,
        dedupeStore: mockDedupeStore,
      });

      await dispatcher.dispatch("task", {}, {
        uniqueKey: "key-1",
        uniqueFor: 600, // 10 minutes
      });

      expect(mockDedupeStore.put).toHaveBeenCalledWith(
        "dedupe:task:key-1",
        expect.any(String),
        { expirationTtl: 600 }
      );
    });

    it("should dispatch without uniqueKey even with dedupeStore", async () => {
      const mockQueue = { send: vi.fn().mockResolvedValue({ success: true }), sendBatch: vi.fn() };
      const mockDedupeStore: DedupeStore = {
        get: vi.fn(),
        put: vi.fn(),
      };

      const dispatcher = createDispatcher({
        queue: mockQueue as any,
        dedupeStore: mockDedupeStore,
      });

      const result = await dispatcher.dispatch("task", {});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dispatched).toBe(true);
      }
      expect(mockDedupeStore.get).not.toHaveBeenCalled();
    });
  });

  describe("Priority Queues", () => {
    it("should create dispatcher with priority queues", () => {
      const mockHighQueue = { send: vi.fn(), sendBatch: vi.fn() };
      const mockNormalQueue = { send: vi.fn(), sendBatch: vi.fn() };
      const mockLowQueue = { send: vi.fn(), sendBatch: vi.fn() };

      const dispatcher = createDispatcher({
        priorityQueues: {
          high: mockHighQueue as any,
          normal: mockNormalQueue as any,
          low: mockLowQueue as any,
        },
      });

      expect(dispatcher).toBeInstanceOf(Dispatcher);
    });

    it("should route high priority jobs to high queue", async () => {
      const mockHighQueue = { send: vi.fn().mockResolvedValue({ success: true }), sendBatch: vi.fn() };
      const mockNormalQueue = { send: vi.fn(), sendBatch: vi.fn() };

      const dispatcher = createDispatcher({
        priorityQueues: {
          high: mockHighQueue as any,
          normal: mockNormalQueue as any,
        },
      });

      await dispatcher.dispatch("urgent", { alert: true }, { priority: "high" });

      expect(mockHighQueue.send).toHaveBeenCalled();
      expect(mockNormalQueue.send).not.toHaveBeenCalled();
    });

    it("should route low priority jobs to low queue", async () => {
      const mockNormalQueue = { send: vi.fn(), sendBatch: vi.fn() };
      const mockLowQueue = { send: vi.fn().mockResolvedValue({ success: true }), sendBatch: vi.fn() };

      const dispatcher = createDispatcher({
        priorityQueues: {
          normal: mockNormalQueue as any,
          low: mockLowQueue as any,
        },
      });

      await dispatcher.dispatch("cleanup", {}, { priority: "low" });

      expect(mockLowQueue.send).toHaveBeenCalled();
      expect(mockNormalQueue.send).not.toHaveBeenCalled();
    });

    it("should use default priority when not specified", async () => {
      const mockHighQueue = { send: vi.fn(), sendBatch: vi.fn() };
      const mockNormalQueue = { send: vi.fn().mockResolvedValue({ success: true }), sendBatch: vi.fn() };

      const dispatcher = createDispatcher({
        priorityQueues: {
          high: mockHighQueue as any,
          normal: mockNormalQueue as any,
        },
        defaultPriority: "normal",
      });

      await dispatcher.dispatch("task", {});

      expect(mockNormalQueue.send).toHaveBeenCalled();
      expect(mockHighQueue.send).not.toHaveBeenCalled();
    });

    it("should batch dispatch to respective priority queues", async () => {
      const mockHighQueue = { send: vi.fn(), sendBatch: vi.fn().mockResolvedValue({ success: true }) };
      const mockNormalQueue = { send: vi.fn(), sendBatch: vi.fn().mockResolvedValue({ success: true }) };

      const dispatcher = createDispatcher({
        priorityQueues: {
          high: mockHighQueue as any,
          normal: mockNormalQueue as any,
        },
        defaultPriority: "normal",
      });

      const result = await dispatcher.dispatchBatch([
        { type: "urgent", payload: {}, options: { priority: "high" } },
        { type: "normal-task", payload: {} },
        { type: "another-urgent", payload: {}, options: { priority: "high" } },
      ]);

      expect(result.success).toBe(true);
      expect(mockHighQueue.sendBatch).toHaveBeenCalled();
      expect(mockNormalQueue.sendBatch).toHaveBeenCalled();

      // Check high queue got 2 jobs
      const highBatchCall = mockHighQueue.sendBatch.mock.calls[0][0];
      expect(highBatchCall).toHaveLength(2);

      // Check normal queue got 1 job
      const normalBatchCall = mockNormalQueue.sendBatch.mock.calls[0][0];
      expect(normalBatchCall).toHaveLength(1);
    });
  });

  describe("Job Chaining", () => {
    it("should dispatch chained jobs after successful processing", async () => {
      const handler = vi.fn();
      const registry = createRegistry().register("main-job", handler);

      const mockChainQueue = { send: vi.fn().mockResolvedValue({ success: true }), sendBatch: vi.fn() };
      const processor = createProcessor(registry, {
        chainQueue: mockChainQueue as any,
      });

      const mockMessage = {
        body: {
          type: "main-job",
          payload: { id: 1 },
          meta: {
            chain: [
              { type: "follow-up", payload: { parentId: 1 } },
              { type: "notify", payload: { parentId: 1 }, delay: 60 },
            ],
          },
        },
        ack: vi.fn(),
        retry: vi.fn(),
        attempts: 1,
      };

      await processor.process({ messages: [mockMessage], queue: "test" } as any, {});

      expect(handler).toHaveBeenCalled();
      expect(mockChainQueue.send).toHaveBeenCalledTimes(2);

      // Check first chained job
      const firstCall = mockChainQueue.send.mock.calls[0][0];
      expect(firstCall.type).toBe("follow-up");

      // Check second chained job has delay
      const secondCall = mockChainQueue.send.mock.calls[1];
      expect(secondCall[0].type).toBe("notify");
      expect(secondCall[1]).toEqual({ delaySeconds: 60 });
    });

    it("should not dispatch chained jobs if handler fails", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));
      const registry = createRegistry().register("failing-job", handler);

      const mockChainQueue = { send: vi.fn(), sendBatch: vi.fn() };
      const processor = createProcessor(registry, {
        chainQueue: mockChainQueue as any,
      });

      const mockMessage = {
        body: {
          type: "failing-job",
          payload: {},
          meta: {
            chain: [{ type: "should-not-run", payload: {} }],
            maxAttempts: 1,
          },
        },
        ack: vi.fn(),
        retry: vi.fn(),
        attempts: 1,
      };

      await processor.process({ messages: [mockMessage], queue: "test" } as any, {});

      expect(mockChainQueue.send).not.toHaveBeenCalled();
    });

    it("should warn if chained jobs exist but no chainQueue configured", async () => {
      const handler = vi.fn();
      const registry = createRegistry().register("job-with-chain", handler);
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const processor = createProcessor(registry); // No chainQueue

      const mockMessage = {
        body: {
          type: "job-with-chain",
          payload: {},
          meta: {
            chain: [{ type: "chained", payload: {} }],
          },
        },
        ack: vi.fn(),
        retry: vi.fn(),
        attempts: 1,
      };

      await processor.process({ messages: [mockMessage], queue: "test" } as any, {});

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("no chainQueue configured")
      );

      consoleWarn.mockRestore();
    });
  });

  describe("Queue Processor", () => {
    it("should create processor with registry", () => {
      const registry = createRegistry();
      const processor = createProcessor(registry);

      expect(processor).toBeDefined();
    });

    it("should process messages with registered handlers", async () => {
      const handler = vi.fn();
      const registry = createRegistry().register("test-job", handler);
      const processor = createProcessor(registry);

      const mockMessage = {
        body: { type: "test-job", payload: { data: "test" } },
        ack: vi.fn(),
        retry: vi.fn(),
        attempts: 1,
      };

      const mockBatch = {
        messages: [mockMessage],
        queue: "test-queue",
      };

      await processor.process(mockBatch as any, {});

      expect(handler).toHaveBeenCalled();
      expect(mockMessage.ack).toHaveBeenCalled();
    });

    it("should call default handler for unknown job types", async () => {
      const defaultHandler = vi.fn();
      const registry = createRegistry().setDefault(defaultHandler);
      const processor = createProcessor(registry);

      const mockMessage = {
        body: { type: "unknown-type", payload: {} },
        ack: vi.fn(),
        retry: vi.fn(),
        attempts: 1,
      };

      await processor.process({ messages: [mockMessage], queue: "test" } as any, {});

      expect(defaultHandler).toHaveBeenCalled();
    });

    it("should retry on handler failure when under max attempts", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));
      const registry = createRegistry().register("failing-job", handler);
      const processor = createProcessor(registry);

      const mockMessage = {
        body: { type: "failing-job", payload: {} },
        ack: vi.fn(),
        retry: vi.fn(),
        attempts: 1,
      };

      await processor.process({ messages: [mockMessage], queue: "test" } as any, {});

      expect(mockMessage.retry).toHaveBeenCalled();
      expect(mockMessage.ack).not.toHaveBeenCalled();
    });

    it("should not double-ack when handler explicitly calls ack", async () => {
      const handler = vi.fn().mockImplementation((job, ctx) => {
        ctx.ack(); // Handler explicitly acks
      });
      const registry = createRegistry().register("explicit-ack", handler);
      const processor = createProcessor(registry);

      const mockMessage = {
        body: { type: "explicit-ack", payload: {} },
        ack: vi.fn(),
        retry: vi.fn(),
        attempts: 1,
      };

      await processor.process({ messages: [mockMessage], queue: "test" } as any, {});

      // Should only be called once (by handler), not twice
      expect(mockMessage.ack).toHaveBeenCalledTimes(1);
    });

    it("should respect handler explicit retry and not auto-ack", async () => {
      const handler = vi.fn().mockImplementation((job, ctx) => {
        ctx.retry(); // Handler wants to retry later
        // Returns normally without throwing
      });
      const registry = createRegistry().register("explicit-retry", handler);
      const processor = createProcessor(registry);

      const mockMessage = {
        body: { type: "explicit-retry", payload: {} },
        ack: vi.fn(),
        retry: vi.fn(),
        attempts: 1,
      };

      await processor.process({ messages: [mockMessage], queue: "test" } as any, {});

      // Should retry (called by handler), not ack
      expect(mockMessage.retry).toHaveBeenCalledTimes(1);
      expect(mockMessage.ack).not.toHaveBeenCalled();
    });

    it("should ack and call onFailure after max attempts", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));
      const onFailure = vi.fn();
      const registry = createRegistry().register("failing-job", handler);
      const processor = createProcessor(registry, { onFailure });

      const mockMessage = {
        body: { type: "failing-job", payload: {}, meta: { maxAttempts: 3 } },
        ack: vi.fn(),
        retry: vi.fn(),
        attempts: 3,
      };

      await processor.process({ messages: [mockMessage], queue: "test" } as any, {});

      expect(onFailure).toHaveBeenCalled();
      expect(mockMessage.ack).toHaveBeenCalled();
      expect(mockMessage.retry).not.toHaveBeenCalled();
    });

    it("should call lifecycle hooks", async () => {
      const onBeforeProcess = vi.fn();
      const onAfterProcess = vi.fn();
      const handler = vi.fn();

      const registry = createRegistry().register("test-job", handler);
      const processor = createProcessor(registry, {
        onBeforeProcess,
        onAfterProcess,
      });

      const mockMessage = {
        body: { type: "test-job", payload: {} },
        ack: vi.fn(),
        retry: vi.fn(),
        attempts: 1,
      };

      await processor.process({ messages: [mockMessage], queue: "test" } as any, { test: true });

      expect(onBeforeProcess).toHaveBeenCalled();
      expect(onAfterProcess).toHaveBeenCalled();
    });

    it("should pass env to lifecycle hooks", async () => {
      const onAfterProcess = vi.fn();
      const handler = vi.fn();

      const registry = createRegistry().register("test-job", handler);
      const processor = createProcessor(registry, { onAfterProcess });

      const env = { DB: "test-db", KV: "test-kv" };
      const mockMessage = {
        body: { type: "test-job", payload: {} },
        ack: vi.fn(),
        retry: vi.fn(),
        attempts: 1,
      };

      await processor.process({ messages: [mockMessage], queue: "test" } as any, env);

      expect(onAfterProcess).toHaveBeenCalledWith(
        expect.any(Object),
        env
      );
    });
  });

  describe("Job Context", () => {
    it("should provide env in job context", async () => {
      let capturedCtx: JobContext<{ testEnv: string }> | undefined;

      const handler = vi.fn().mockImplementation((job, ctx) => {
        capturedCtx = ctx;
      });

      const registry = createRegistry<{ testEnv: string }>().register("test", handler);
      const processor = createProcessor(registry);

      const mockMessage = {
        body: { type: "test", payload: {} },
        ack: vi.fn(),
        retry: vi.fn(),
        attempts: 2,
      };

      await processor.process(
        { messages: [mockMessage], queue: "test" } as any,
        { testEnv: "value" }
      );

      expect(capturedCtx?.env).toEqual({ testEnv: "value" });
      expect(capturedCtx?.attempt).toBe(2);
    });
  });

  describe("Type Safety", () => {
    it("should support typed payloads", () => {
      interface EmailPayload {
        to: string;
        subject: string;
        body?: string;
      }

      const job = createJob<EmailPayload>("send-email", {
        to: "test@example.com",
        subject: "Hello",
      });

      expect(job.payload.to).toBe("test@example.com");
      expect(job.payload.subject).toBe("Hello");
    });

    it("should support typed environment", () => {
      interface Env {
        DB: unknown;
        KV: unknown;
      }

      const registry = createRegistry<Env>();
      expect(registry).toBeDefined();
    });
  });
});

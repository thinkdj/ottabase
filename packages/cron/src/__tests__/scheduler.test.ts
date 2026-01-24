import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Scheduler,
  createScheduler,
  TaskRepository,
  ScheduledTaskRecord,
} from "../scheduler";

// Mock task data
const createMockTask = (overrides: Partial<ScheduledTaskRecord> = {}): ScheduledTaskRecord => ({
  id: "task-1",
  name: "test-task",
  description: "Test task",
  schedule: "* * * * *",
  taskType: "handler",
  task: "test:handler",
  payload: null,
  isActive: true,
  lastRunAt: null,
  nextRunAt: new Date(Date.now() - 1000), // Due
  lastStatus: null,
  lastError: null,
  runCount: 0,
  failCount: 0,
  ...overrides,
});

// Mock repository
const createMockRepository = (tasks: ScheduledTaskRecord[] = []): TaskRepository => ({
  getDueTasks: vi.fn().mockResolvedValue(tasks),
  acquireLock: vi.fn().mockResolvedValue(true), // Default: lock acquired
  markCompleted: vi.fn().mockResolvedValue(undefined),
  markFailed: vi.fn().mockResolvedValue(undefined),
});

// Mock execution context that collects promises for awaiting
const createMockCtx = () => {
  const promises: Promise<unknown>[] = [];
  return {
    waitUntil: vi.fn((p: Promise<unknown>) => {
      promises.push(p);
    }),
    async flush() {
      await Promise.all(promises);
    },
  };
};

interface TestEnv {
  DB: { query: () => Promise<void> };
}

describe("Scheduler", () => {
  let mockEnv: TestEnv;

  beforeEach(() => {
    mockEnv = {
      DB: { query: vi.fn().mockResolvedValue(undefined) },
    };
  });

  describe("createScheduler", () => {
    it("should create a Scheduler instance", () => {
      const scheduler = createScheduler<TestEnv>();
      expect(scheduler).toBeInstanceOf(Scheduler);
    });
  });

  describe("handler registration", () => {
    it("should register a handler", () => {
      const scheduler = createScheduler<TestEnv>().handler(
        "test:handler",
        async () => {}
      );

      expect(scheduler.hasHandler("test:handler")).toBe(true);
      expect(scheduler.hasHandler("unknown")).toBe(false);
    });

    it("should support chainable API", () => {
      const scheduler = createScheduler<TestEnv>()
        .handler("handler1", async () => {})
        .handler("handler2", async () => {})
        .handler("handler3", async () => {});

      expect(scheduler.getHandlers()).toHaveLength(3);
    });

    it("should register handler with description", () => {
      const scheduler = createScheduler<TestEnv>().handler(
        "cleanup",
        async () => {},
        "Cleans up old data"
      );

      const handlers = scheduler.getHandlers();
      expect(handlers[0].description).toBe("Cleans up old data");
    });
  });

  describe("tick", () => {
    it("should execute due task", async () => {
      const handlerFn = vi.fn();
      const task = createMockTask();
      const repository = createMockRepository([task]);
      const ctx = createMockCtx();

      const scheduler = createScheduler<TestEnv>().handler(
        "test:handler",
        handlerFn
      );

      await scheduler.tick(mockEnv, ctx, repository);
      await ctx.flush();

      expect(repository.getDueTasks).toHaveBeenCalled();
      expect(repository.acquireLock).toHaveBeenCalledWith(task.id);
      expect(handlerFn).toHaveBeenCalled();
      expect(repository.markCompleted).toHaveBeenCalled();
    });

    it("should pass context to handler", async () => {
      const handlerFn = vi.fn();
      const task = createMockTask({
        payload: JSON.stringify({ userId: "123" }),
      });
      const repository = createMockRepository([task]);
      const ctx = createMockCtx();

      const scheduler = createScheduler<TestEnv>().handler(
        "test:handler",
        handlerFn
      );

      await scheduler.tick(mockEnv, ctx, repository);
      await ctx.flush();

      const context = handlerFn.mock.calls[0][0];
      expect(context.env).toBe(mockEnv);
      expect(context.taskId).toBe(task.id);
      expect(context.taskName).toBe(task.name);
      expect(context.schedule).toBe(task.schedule);
      expect(context.payload).toEqual({ userId: "123" });
    });

    it("should skip task with no registered handler", async () => {
      const task = createMockTask({ task: "unknown:handler" });
      const repository = createMockRepository([task]);
      const ctx = createMockCtx();

      const scheduler = createScheduler<TestEnv>();
      const result = await scheduler.tick(mockEnv, ctx, repository);

      expect(result.skipped).toBe(1);
      expect(result.executed).toBe(0);
    });

    it("should skip non-handler task types", async () => {
      const task = createMockTask({ taskType: "command" });
      const repository = createMockRepository([task]);
      const ctx = createMockCtx();

      const scheduler = createScheduler<TestEnv>().handler(
        "test:handler",
        async () => {}
      );

      const result = await scheduler.tick(mockEnv, ctx, repository);

      expect(result.skipped).toBe(1);
    });

    it("should handle multiple due tasks", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const tasks = [
        createMockTask({ id: "1", task: "handler1" }),
        createMockTask({ id: "2", task: "handler2" }),
      ];
      const repository = createMockRepository(tasks);
      const ctx = createMockCtx();

      const scheduler = createScheduler<TestEnv>()
        .handler("handler1", handler1)
        .handler("handler2", handler2);

      await scheduler.tick(mockEnv, ctx, repository);
      await ctx.flush();

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it("should return empty result when no tasks due", async () => {
      const repository = createMockRepository([]);
      const ctx = createMockCtx();

      const scheduler = createScheduler<TestEnv>();
      const result = await scheduler.tick(mockEnv, ctx, repository);

      expect(result.executed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should mark task as failed on error", async () => {
      const error = new Error("Task failed");
      const handlerFn = vi.fn().mockRejectedValue(error);
      const task = createMockTask();
      const repository = createMockRepository([task]);
      const ctx = createMockCtx();

      const scheduler = createScheduler<TestEnv>().handler(
        "test:handler",
        handlerFn
      );

      await scheduler.tick(mockEnv, ctx, repository);
      await ctx.flush();

      expect(repository.markFailed).toHaveBeenCalledWith(
        task.id,
        "Task failed",
        expect.any(Date)
      );
    });

    it("should call onError hook when provided", async () => {
      const error = new Error("Task failed");
      const handlerFn = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();
      const task = createMockTask();
      const repository = createMockRepository([task]);
      const ctx = createMockCtx();

      const scheduler = createScheduler<TestEnv>({ onError }).handler(
        "test:handler",
        handlerFn
      );

      await scheduler.tick(mockEnv, ctx, repository);
      await ctx.flush();

      expect(onError).toHaveBeenCalledWith(error, expect.any(Object));
    });
  });

  describe("hooks", () => {
    it("should call onBeforeTask hook", async () => {
      const order: string[] = [];
      const onBeforeTask = vi.fn(() => {
        order.push("before");
      });
      const handlerFn = vi.fn(() => {
        order.push("handler");
      });

      const task = createMockTask();
      const repository = createMockRepository([task]);
      const ctx = createMockCtx();

      const scheduler = createScheduler<TestEnv>({ onBeforeTask }).handler(
        "test:handler",
        handlerFn
      );

      await scheduler.tick(mockEnv, ctx, repository);
      await ctx.flush();

      expect(order).toEqual(["before", "handler"]);
    });

    it("should call onAfterTask hook", async () => {
      const order: string[] = [];
      const onAfterTask = vi.fn(() => {
        order.push("after");
      });
      const handlerFn = vi.fn(() => {
        order.push("handler");
      });

      const task = createMockTask();
      const repository = createMockRepository([task]);
      const ctx = createMockCtx();

      const scheduler = createScheduler<TestEnv>({ onAfterTask }).handler(
        "test:handler",
        handlerFn
      );

      await scheduler.tick(mockEnv, ctx, repository);
      await ctx.flush();

      expect(order).toEqual(["handler", "after"]);
    });
  });

  describe("runTask", () => {
    it("should manually run a task", async () => {
      const handlerFn = vi.fn();
      const scheduler = createScheduler<TestEnv>().handler(
        "test:handler",
        handlerFn
      );

      await scheduler.runTask("test:handler", mockEnv, { foo: "bar" });

      expect(handlerFn).toHaveBeenCalled();
      const context = handlerFn.mock.calls[0][0];
      expect(context.taskId).toBe("manual");
      expect(context.payload).toEqual({ foo: "bar" });
    });

    it("should throw for unknown handler", async () => {
      const scheduler = createScheduler<TestEnv>();

      await expect(
        scheduler.runTask("unknown", mockEnv)
      ).rejects.toThrow("No handler registered for task: unknown");
    });
  });

  describe("atomic locking", () => {
    it("should skip task if lock not acquired", async () => {
      const handlerFn = vi.fn();
      const task = createMockTask();
      const repository = createMockRepository([task]);
      const ctx = createMockCtx();

      // Simulate another worker already acquired the lock
      (repository.acquireLock as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const scheduler = createScheduler<TestEnv>().handler(
        "test:handler",
        handlerFn
      );

      await scheduler.tick(mockEnv, ctx, repository);
      await ctx.flush();

      expect(repository.acquireLock).toHaveBeenCalledWith(task.id);
      expect(handlerFn).not.toHaveBeenCalled();
      expect(repository.markCompleted).not.toHaveBeenCalled();
    });

    it("should not mark task as failed if lock was not acquired", async () => {
      const handlerFn = vi.fn();
      const task = createMockTask();
      const repository = createMockRepository([task]);
      const ctx = createMockCtx();

      // Simulate another worker already acquired the lock
      (repository.acquireLock as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const scheduler = createScheduler<TestEnv>().handler(
        "test:handler",
        handlerFn
      );

      await scheduler.tick(mockEnv, ctx, repository);
      await ctx.flush();

      expect(repository.markFailed).not.toHaveBeenCalled();
    });
  });
});

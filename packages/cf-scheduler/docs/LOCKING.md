# Optimistic Locking Implementation

This document explains how the scheduler prevents double-execution using optimistic locking.

## Problem: Concurrent Execution

When Cloudflare Workers scale horizontally, multiple instances may check the database simultaneously:

```
Time: 1:00:00 AM
Worker A: SELECT * FROM tasks WHERE next_run_at <= now()  → Task #123
Worker B: SELECT * FROM tasks WHERE next_run_at <= now()  → Task #123
Worker A: Executes task #123
Worker B: Executes task #123  ❌ DUPLICATE!
```

## Solution: Optimistic Locking

The scheduler uses a lock-based approach to ensure only one worker executes each task:

### 1. Acquire Lock

```sql
-- Generate unique lock ID
lockId = crypto.randomUUID()

-- Atomically lock tasks
UPDATE scheduled_tasks
SET execution_lock_id = ?,
    execution_locked_at = ?
WHERE id IN (
  SELECT id FROM scheduled_tasks
  WHERE status = 'active'
  AND next_run_at <= ?
  AND (execution_lock_id IS NULL OR execution_locked_at < ?)
  LIMIT ?
)
```

**Key points:**
- Only tasks without a lock (`execution_lock_id IS NULL`) can be acquired
- Or tasks with stale locks (>10 minutes old) can be reclaimed
- Each worker gets a unique `lockId`

### 2. Fetch Locked Tasks

```sql
SELECT * FROM scheduled_tasks
WHERE execution_lock_id = ?
```

Only returns tasks this worker successfully locked.

### 3. Execute & Release

```sql
-- After execution (success or failure)
UPDATE scheduled_tasks
SET execution_lock_id = NULL,
    execution_locked_at = NULL,
    next_run_at = ?,
    last_run_at = ?
WHERE id = ?
```

Lock is released, making task available for next scheduled run.

## Stale Lock Recovery

If a worker crashes mid-execution, the lock remains. The scheduler automatically recovers:

```sql
-- Locks older than 10 minutes are considered stale
execution_locked_at < (now - 10 minutes)
```

Stale locks are reclaimed by the next worker that checks for due tasks.

## Schema

```sql
CREATE TABLE scheduled_tasks (
  -- ... other fields ...
  execution_lock_id TEXT,          -- UUID of worker holding lock
  execution_locked_at TEXT,        -- When lock was acquired
  -- ... other fields ...
);

CREATE INDEX idx_scheduled_tasks_lock ON scheduled_tasks(execution_lock_id);
```

## Behavior Under Concurrency

```
Time: 1:00:00 AM - Both workers check simultaneously

Worker A: UPDATE sets lock_id=A  ✅ (gets Task #123)
Worker B: UPDATE sets lock_id=B  ✅ (gets Task #456)

Worker A: SELECT WHERE lock_id=A  → Task #123
Worker B: SELECT WHERE lock_id=B  → Task #456

Worker A: Executes #123, releases lock
Worker B: Executes #456, releases lock
```

**Result:** No duplicate executions, tasks are distributed across workers.

## Performance

- **Lock acquisition:** Single atomic UPDATE
- **Index usage:** `idx_scheduled_tasks_lock` for fast lookups
- **Minimal overhead:** ~2ms per cron trigger for <20 tasks

## Configuration

The lock timeout is hardcoded to 10 minutes:

```typescript
const staleLockThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
```

This means:
- Normal execution: Lock held for seconds, released immediately
- Worker crash: Lock auto-expires after 10 minutes
- Long-running task: If takes >10 minutes, may be picked up by another worker (edge case)

For tasks that consistently run >10 minutes, consider increasing `timeout_seconds` and the stale threshold.

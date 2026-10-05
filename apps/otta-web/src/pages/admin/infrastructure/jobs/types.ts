export interface ScheduledTask {
    id: string;
    name: string;
    description: string | null;
    schedule: string;
    taskType: string;
    task: string;
    payload: string | null;
    isActive: boolean;
    timezone: string | null;
    lastRunAt: string | number | null;
    nextRunAt: string | number | null;
    lastStatus: string | null;
    lastError: string | null;
    runCount: number;
    failCount: number;
    createdAt: string | number;
    updatedAt: string | number;
}

export interface CronOverview {
    tasks: ScheduledTask[];
    pagination: { page: number; perPage: number; total: number; totalPages: number };
    registeredHandlers: { name: string; description: string }[];
    stats: { total: number; active: number; totalRuns: number; totalFails: number };
}

export interface NewTask {
    name: string;
    description: string;
    schedule: string;
    taskType: 'handler';
    task: string;
    payload: string;
    isActive: boolean;
}

export interface QueueStats {
    totalDispatched: number;
    totalProcessed: number;
    totalFailed: number;
    totalDLQ: number;
    byJobType: Record<string, { dispatched: number; processed: number; failed: number }>;
    lastUpdated: number;
}

export interface QueueOverview {
    stats: QueueStats;
    pendingCount: number;
    registeredHandlers: { type: string; description: string }[];
    queueBinding: string;
}

export interface ProcessedJob {
    id: string;
    type: string;
    status: 'completed' | 'failed';
    processedAt: number;
    duration?: number;
    error?: string;
    attempts: number;
}

export interface DeadLetterJob {
    id: string;
    type: string;
    payload: unknown;
    error: string;
    failedAt: number;
    attempts: number;
}

export interface DeadLetterPage {
    jobs: DeadLetterJob[];
    cursor?: string;
    hasMore: boolean;
}

export interface JobTypeStat {
    type: string;
    dispatched: number;
    processed: number;
    failed: number;
}

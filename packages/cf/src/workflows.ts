/**
 * Workflows wrapper
 * Start, inspect and steer durable multi-step runs. The `WorkflowEntrypoint` class itself is
 * your code; this is the binding you call it through.
 *
 * @see https://developers.cloudflare.com/workflows/
 */

import type { Workflow, WorkflowInstance, WorkflowInstanceCreateOptions } from '@cloudflare/workers-types';
import { attempt, CloudflareError, type Result } from './types';

export interface WorkflowsConfig<P = unknown> {
    workflow: Workflow<P>;
}

export type WorkflowStatus = Awaited<ReturnType<WorkflowInstance['status']>>;

/** One Workflow binding. */
export class WorkflowsClient<P = unknown> {
    private workflow: Workflow<P>;

    constructor(config: WorkflowsConfig<P>) {
        if (!config.workflow) {
            throw new CloudflareError('Workflow binding is required', 'WORKFLOW_MISSING_BINDING');
        }
        this.workflow = config.workflow;
    }

    /** Start an instance. Pass `id` to make the start idempotent (a second call with the same id fails). */
    start(
        params: P,
        options: Omit<WorkflowInstanceCreateOptions<P>, 'params'> = {},
    ): Promise<Result<{ id: string }, Error>> {
        return attempt(async () => {
            const instance = await this.workflow.create({ ...options, params });
            return { id: instance.id };
        });
    }

    startBatch(batch: Array<WorkflowInstanceCreateOptions<P>>): Promise<Result<string[], Error>> {
        return attempt(async () => (await this.workflow.createBatch(batch)).map((instance) => instance.id));
    }

    get(id: string): Promise<Result<WorkflowInstance, Error>> {
        return attempt(() => this.workflow.get(id));
    }

    status(id: string): Promise<Result<WorkflowStatus, Error>> {
        return attempt(async () => (await this.workflow.get(id)).status());
    }

    pause(id: string): Promise<Result<void, Error>> {
        return attempt(async () => (await this.workflow.get(id)).pause());
    }

    resume(id: string): Promise<Result<void, Error>> {
        return attempt(async () => (await this.workflow.get(id)).resume());
    }

    terminate(id: string): Promise<Result<void, Error>> {
        return attempt(async () => (await this.workflow.get(id)).terminate());
    }

    restart(id: string): Promise<Result<void, Error>> {
        return attempt(async () => (await this.workflow.get(id)).restart());
    }

    /** Deliver an event an instance is waiting for (`step.waitForEvent`). */
    sendEvent(id: string, type: string, payload?: unknown): Promise<Result<void, Error>> {
        return attempt(async () => (await this.workflow.get(id)).sendEvent({ type, payload }));
    }
}

export function createWorkflowsClient<P = unknown>(config: WorkflowsConfig<P>): WorkflowsClient<P> {
    return new WorkflowsClient<P>(config);
}

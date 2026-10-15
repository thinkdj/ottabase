// One handler per job type, from the package manifests. A type no package claims is acked
// with a warning rather than retried forever. Built on first use (the manifests may import
// this module), like otta-web's.
import { createQueueHandler, createRegistry, type JobHandler } from '@ottabase/queue';
import { packages } from '../ottabase/registry';

function build() {
    const registry = createRegistry<CloudflareEnv>();
    for (const [type, handler] of Object.entries(packages.queue())) {
        registry.register(type, handler as JobHandler<unknown, CloudflareEnv>);
    }
    registry.setDefault(async (job, ctx) => {
        console.warn(JSON.stringify({ event: 'queue_unknown_job_type', type: job.type }));
        ctx.ack();
    });
    return createQueueHandler(registry);
}

let handler: ReturnType<typeof build> | null = null;

export const queueHandler: ReturnType<typeof build> = (batch, env) => {
    handler ??= build();
    return handler(batch, env);
};

import type { PackageRegistry } from '@ottabase/kernel';
import { ScheduledTask } from '@ottabase/ottaorm/models';

/**
 * Seed a `scheduled_tasks` row for every cron contribution that declares a `schedule`,
 * once per app. Idempotent by task name, so re-running after a package is added seeds only
 * the new one; a row the operator paused or re-timed is left alone.
 */
export async function ensurePackageSchedules(
    registry: PackageRegistry<CloudflareEnv>,
    appId: string,
): Promise<string[]> {
    const seeded: string[] = [];
    for (const [name, job] of Object.entries(registry.cron())) {
        if (!job.schedule) continue;
        if (await ScheduledTask.findByName(appId, name)) continue;
        await ScheduledTask.createRegistered(
            {
                name,
                description: job.description,
                schedule: job.schedule,
                taskType: 'handler',
                task: name,
                payload: job.payload ? JSON.stringify(job.payload) : null,
                isActive: true,
                appId,
            },
            [name],
        );
        seeded.push(name);
    }
    return seeded;
}

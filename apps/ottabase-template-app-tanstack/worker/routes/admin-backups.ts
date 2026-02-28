/**
 * Admin Backup API Routes
 *
 * Endpoints for managing D1→R2 database backups:
 * - GET  /api/admin/backups            — List backups + setup status
 * - POST /api/admin/backups            — Create a new backup
 * - GET  /api/admin/backups/settings   — Get backup settings
 * - PUT  /api/admin/backups/settings   — Update backup settings (retentionDays, schedule)
 * - GET  /api/admin/backups/:id        — Download backup SQL
 * - DELETE /api/admin/backups/:id      — Delete a backup
 */

import { createBackupService, type D1Like, type R2Like } from '@ottabase/backups';
import { ScheduledTask } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { requireAdminAccess } from '../lib/admin-guard';
import { initAdminCron } from '../lib/db-utils';
import { readJson } from '../lib/utils';
import type { ApiRouteContext } from './router';

/** Shared helper: create a BackupService from env bindings */
function getBackupService(env: ApiRouteContext['env']) {
    if (!env.OBCF_D1) {
        return { error: errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' }) };
    }
    if (!env.OBCF_R2) {
        return { error: errorResponse('R2 bucket binding not configured', 500, { code: 'CONFIG_ERROR' }) };
    }
    const config = getOttabaseConfig(env);
    const appName = config.appName || config.appId || 'ottabase';
    return {
        service: createBackupService(env.OBCF_D1 as unknown as D1Like, env.OBCF_R2 as unknown as R2Like, { appName }),
    };
}

/** Find the backup:database cron task if it exists */
async function findBackupCronTask(env: ApiRouteContext['env']): Promise<ScheduledTask | null> {
    try {
        const initErr = initAdminCron(env);
        if (initErr) return null;

        const tasks = await ScheduledTask.all();
        return (
            (tasks.find(
                (t) =>
                    String(t.get('task')).includes('backup') || String(t.get('name')).toLowerCase().includes('backup'),
            ) as ScheduledTask | undefined) ?? null
        );
    } catch {
        return null;
    }
}

/** Check if a backup:database cron job is configured and active */
async function isCronConfigured(env: ApiRouteContext['env']): Promise<boolean> {
    const task = await findBackupCronTask(env);
    return task !== null && !!task.get('isActive');
}

/**
 * GET /api/admin/backups — List all backups with setup status
 */
export async function handleAdminBackupsList(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { service, error } = getBackupService(context.env);
    if (error) return error;

    try {
        const [backupList, cronConfigured] = await Promise.all([service!.listBackups(), isCronConfigured(context.env)]);

        const setupStatus = await service!.checkSetup({ cronConfigured });

        return jsonResponse({
            ...backupList,
            setup: setupStatus,
        });
    } catch (err) {
        return errorResponse(err instanceof Error ? err.message : 'Failed to list backups', 500, {
            code: 'BACKUP_LIST_ERROR',
        });
    }
}

/**
 * POST /api/admin/backups — Create a new backup
 */
export async function handleAdminBackupsCreate(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { service, error } = getBackupService(context.env);
    if (error) return error;

    const body = await readJson<{ label?: string }>(context.request);

    try {
        const result = await service!.createBackup({
            label: body.label || 'manual',
            type: 'full',
        });

        if (!result.success) {
            return errorResponse(result.error || 'Backup failed', 500, { code: 'BACKUP_CREATE_ERROR' });
        }

        return jsonResponse(result, 201);
    } catch (err) {
        return errorResponse(err instanceof Error ? err.message : 'Backup failed', 500, {
            code: 'BACKUP_CREATE_ERROR',
        });
    }
}

/**
 * GET /api/admin/backups/settings — Get current backup settings
 */
export async function handleAdminBackupsSettingsGet(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    try {
        const initErr = initAdminCron(context.env);

        // Find the backup cron task
        const task = initErr ? null : await findBackupCronTask(context.env);

        return jsonResponse({
            retentionDays: 30, // Default; admin can update via PUT
            schedule: task ? String(task.get('schedule')) : null,
            scheduleActive: task ? !!task.get('isActive') : false,
            taskId: task ? String(task.get('id')) : null,
            taskName: task ? String(task.get('name')) : null,
        });
    } catch (err) {
        return errorResponse(err instanceof Error ? err.message : 'Failed to get settings', 500, {
            code: 'BACKUP_SETTINGS_ERROR',
        });
    }
}

/**
 * PUT /api/admin/backups/settings — Update backup settings (schedule, retention)
 * Creates or updates a backup:database cron task.
 */
export async function handleAdminBackupsSettingsPut(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const body = await readJson<{
        schedule?: string;
        retentionDays?: number;
        isActive?: boolean;
    }>(context.request);

    try {
        const initErr = initAdminCron(context.env);
        if (initErr) return initErr;

        // Validate schedule if provided
        if (body.schedule !== undefined && typeof body.schedule !== 'string') {
            return errorResponse('schedule must be a cron expression string', 400, { code: 'VALIDATION_ERROR' });
        }

        // Validate retentionDays
        if (body.retentionDays !== undefined) {
            if (typeof body.retentionDays !== 'number' || body.retentionDays < 1 || body.retentionDays > 365) {
                return errorResponse('retentionDays must be between 1 and 365', 400, { code: 'VALIDATION_ERROR' });
            }
        }

        const existingTask = await findBackupCronTask(context.env);

        if (existingTask) {
            // Update existing task
            if (body.schedule !== undefined) {
                existingTask.set('schedule', body.schedule);
            }
            if (body.isActive !== undefined) {
                existingTask.set('isActive', body.isActive);
            }
            await existingTask.save();
            return jsonResponse({
                success: true,
                message: 'Backup settings updated',
                task: existingTask.toJson(),
            });
        } else if (body.schedule) {
            // Create new backup cron task
            const newTask = await ScheduledTask.create({
                name: 'Automated Database Backup',
                description: 'Automated D1→R2 database backup',
                schedule: body.schedule,
                taskType: 'handler',
                task: 'backup:database',
                payload: body.retentionDays ? JSON.stringify({ retentionDays: body.retentionDays }) : null,
                isActive: body.isActive ?? true,
            });
            return jsonResponse(
                {
                    success: true,
                    message: 'Backup schedule created',
                    task: newTask.toJson(),
                },
                201,
            );
        }

        return jsonResponse({ success: true, message: 'No changes made' });
    } catch (err) {
        return errorResponse(err instanceof Error ? err.message : 'Failed to update settings', 500, {
            code: 'BACKUP_SETTINGS_ERROR',
        });
    }
}

/**
 * GET /api/admin/backups/:id — Download backup SQL content
 */
export async function handleAdminBackupDownload(context: ApiRouteContext, backupId: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { service, error } = getBackupService(context.env);
    if (error) return error;

    try {
        const result = await service!.downloadBackup(backupId);
        if (!result.success) {
            return errorResponse(result.error || 'Backup not found', 404, { code: 'BACKUP_NOT_FOUND' });
        }

        const filename = result.filename || `backup-${backupId}.sql`;
        return new Response(result.content, {
            headers: {
                'Content-Type': 'application/sql',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (err) {
        return errorResponse(err instanceof Error ? err.message : 'Download failed', 500, {
            code: 'BACKUP_DOWNLOAD_ERROR',
        });
    }
}

/**
 * DELETE /api/admin/backups/:id — Delete a specific backup
 */
export async function handleAdminBackupDelete(context: ApiRouteContext, backupId: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { service, error } = getBackupService(context.env);
    if (error) return error;

    try {
        const result = await service!.deleteBackup(backupId);
        if (!result.success) {
            return errorResponse(result.error || 'Delete failed', 500, { code: 'BACKUP_DELETE_ERROR' });
        }

        return jsonResponse({ success: true, message: 'Backup deleted' });
    } catch (err) {
        return errorResponse(err instanceof Error ? err.message : 'Delete failed', 500, {
            code: 'BACKUP_DELETE_ERROR',
        });
    }
}

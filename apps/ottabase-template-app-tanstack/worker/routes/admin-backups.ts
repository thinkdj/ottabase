/**
 * Admin Backup API Routes
 *
 * Endpoints for managing D1→R2 database backups:
 * - GET  /api/admin/backups         — List backups + setup status
 * - POST /api/admin/backups         — Create a new backup
 * - GET  /api/admin/backups/:id     — Download backup SQL
 * - DELETE /api/admin/backups/:id   — Delete a backup
 */

import { createBackupService } from '@ottabase/backups';
import { ScheduledTask } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
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
    return { service: createBackupService(env.OBCF_D1 as any, env.OBCF_R2 as any) };
}

/** Check if a backup:database cron job is configured */
async function isCronConfigured(env: ApiRouteContext['env']): Promise<boolean> {
    try {
        const initErr = initAdminCron(env as any);
        if (initErr) return false;

        const tasks = await ScheduledTask.all();
        return tasks.some(
            (t) =>
                t.get('isActive') &&
                (String(t.get('task')).includes('backup') || String(t.get('name')).toLowerCase().includes('backup')),
        );
    } catch {
        return false;
    }
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

        return new Response(result.content, {
            headers: {
                'Content-Type': 'application/sql',
                'Content-Disposition': `attachment; filename="backup-${backupId}.sql"`,
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

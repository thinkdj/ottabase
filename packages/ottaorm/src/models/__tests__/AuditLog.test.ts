import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../validation';
import { AuditLog } from '../AuditLog';

/** Only the typed DbDriver surface pruneOlderThan may use; D1 reports the row count in `meta.changes`. */
function fakeDriver(changes: number) {
    const executeRaw = vi.fn(async (_sql: string, _params?: unknown[]) => ({ success: true, meta: { changes } }));
    return { driver: { executeRaw } as never, executeRaw };
}

describe('AuditLog.pruneOlderThan', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("deletes this app's and unowned rows older than the window, with bound params", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-11T00:00:00Z'));
        const { driver, executeRaw } = fakeDriver(42);

        await expect(AuditLog.pruneOlderThan(90, 'otta-web', driver)).resolves.toBe(42);

        expect(executeRaw).toHaveBeenCalledWith(
            'DELETE FROM audit_logs WHERE created_at < ? AND (app_id = ? OR app_id IS NULL)',
            [Date.parse('2026-07-13T00:00:00Z'), 'otta-web'],
        );
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects a retention window of %s', async (days) => {
        // The window is operator input (task payload); a bad value must not become "delete all".
        const { driver, executeRaw } = fakeDriver(0);
        await expect(AuditLog.pruneOlderThan(days, 'otta-web', driver)).rejects.toBeInstanceOf(ValidationError);
        expect(executeRaw).not.toHaveBeenCalled();
    });
});

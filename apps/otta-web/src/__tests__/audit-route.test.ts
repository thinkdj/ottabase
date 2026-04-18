import { describe, expect, it } from 'vitest';
import { handleAuditLogs } from '../../worker/routes/audit';

describe('handleAuditLogs', () => {
    it('returns 500 when D1 binding is missing', async () => {
        const request = new Request('http://localhost/api/audit/logs');
        const response = await handleAuditLogs({
            request,
            url: new URL(request.url),
            env: {} as any,
        });

        expect(response.status).toBe(500);
    });
});

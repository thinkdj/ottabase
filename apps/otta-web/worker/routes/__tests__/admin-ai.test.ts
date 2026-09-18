import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/admin-guard', () => ({
    requireAdminAccess: vi.fn(),
}));

vi.mock('../../lib/ai-config', () => ({
    getAiConfigSnapshot: vi.fn(() => ({
        packageEnabled: true,
        configured: true,
        transport: { name: 'cloudflare-ai-gateway' },
        secrets: [{ key: 'CFAI_OPENAI_API_KEY', present: true }],
    })),
}));

import { requireAdminAccess } from '../../lib/admin-guard';
import { getAiConfigSnapshot } from '../../lib/ai-config';
import { handleAdminAiConfig } from '../admin-ai';

function context() {
    const request = new Request('http://localhost/api/admin/ai/config');
    return {
        request,
        env: { OBCF_D1: {}, CFAI_OPENAI_API_KEY: 'sk-must-not-appear' },
        url: new URL(request.url),
    } as never;
}

describe('GET /api/admin/ai/config', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('refuses a caller that is not a platform admin', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(new Response('no', { status: 403 }) as never);
        const response = await handleAdminAiConfig(context());
        expect(response.status).toBe(403);
        expect(getAiConfigSnapshot).not.toHaveBeenCalled();
    });

    it('returns the redacted snapshot for a platform admin', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({ user: { id: 'owner' } } as never);
        const response = await handleAdminAiConfig(context());
        const body = (await response.json()) as { transport: { name: string } };

        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(getAiConfigSnapshot).toHaveBeenCalledOnce();
        expect(body.transport.name).toBe('cloudflare-ai-gateway');
        expect(JSON.stringify(body)).not.toContain('sk-must-not-appear');
    });
});

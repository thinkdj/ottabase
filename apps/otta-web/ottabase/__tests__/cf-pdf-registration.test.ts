// ============================================================
// The app package's PDF route reaches the router through the kernel mount, with the
// host adapter wired in: a POST is answered by the cf-pdf handler, any other method
// declines so the request keeps falling through.
// ============================================================
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createCfPdfRequestHandlerMock, pdfHandlerMock } = vi.hoisted(() => {
    const pdfHandler = vi.fn();
    return {
        createCfPdfRequestHandlerMock: vi.fn(() => pdfHandler),
        pdfHandlerMock: pdfHandler,
    };
});

vi.mock('@ottabase/cf-pdf/router', () => ({
    createCfPdfRequestHandler: createCfPdfRequestHandlerMock,
}));

import { createPackageRegistry, mountPackages } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { appPackage } from '../packages/app';

function app() {
    const router = new Router<CloudflareEnv>();
    const packages = createPackageRegistry<CloudflareEnv>({ packages: [appPackage] });
    const mounted = mountPackages(router, { packages });
    return { router, mounted };
}

const env = {} as CloudflareEnv;

describe('Cloudflare PDF route registration', () => {
    beforeEach(() => {
        pdfHandlerMock.mockReset();
        pdfHandlerMock.mockResolvedValue(new Response('pdf', { status: 200 }));
    });

    it('is mounted from the app manifest', () => {
        expect(app().mounted).toContain('/api/cf-pdf');
    });

    it('dispatches POST /api/cf-pdf to the host-configured handler', async () => {
        const request = new Request('https://app.test/api/cf-pdf', { method: 'POST' });
        const response = await app().router.handle(request, env);
        expect(response?.status).toBe(200);
        expect(pdfHandlerMock).toHaveBeenCalledWith(request, env);
    });

    it('does not claim unsupported methods', async () => {
        const response = await app().router.handle(new Request('https://app.test/api/cf-pdf'), env);
        expect(response).toBeNull();
        expect(pdfHandlerMock).not.toHaveBeenCalled();
    });
});

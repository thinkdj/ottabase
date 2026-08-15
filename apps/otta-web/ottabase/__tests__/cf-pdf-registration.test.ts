import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRouteContext } from '../../worker/routes/router';

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

import { handleCustomRoutes } from '../config.routes';

function makeContext(route: string, method: string): ApiRouteContext {
    const request = new Request(`https://app.test${route}`, { method });
    return {
        request,
        env: {} as ApiRouteContext['env'],
        url: new URL(request.url),
        route,
        method,
        withAuthCors: (response) => response,
        corsHeaders: {},
    };
}

describe('Cloudflare PDF route registration', () => {
    beforeEach(() => {
        pdfHandlerMock.mockReset();
        pdfHandlerMock.mockResolvedValue(new Response('pdf', { status: 200 }));
    });

    it('dispatches POST /api/cf-pdf through the normal custom-route path', async () => {
        const context = makeContext('/api/cf-pdf', 'POST');
        const response = await handleCustomRoutes(context);

        expect(response?.status).toBe(200);
        expect(pdfHandlerMock).toHaveBeenCalledWith(context.request, context.env);
    });

    it('does not claim unsupported methods', async () => {
        const response = await handleCustomRoutes(makeContext('/api/cf-pdf', 'GET'));

        expect(response).toBeNull();
        expect(pdfHandlerMock).not.toHaveBeenCalled();
    });
});

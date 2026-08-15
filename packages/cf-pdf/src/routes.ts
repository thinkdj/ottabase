// ============================================================
// @ottabase/cf-pdf — Worker route
// ============================================================
// The route owns the request contract and host-provided access boundary. The renderer
// itself remains reusable and has no knowledge of sessions, rate limit bindings, or tenancy.

import { Router } from '@ottabase/ottarouter';
import { errorResponse } from '@ottabase/utils/http-errors';
import { buildPdfResponse, generatePdf, isPdfRenderError } from './server';
import { injectPdfInfoMetadata } from './metadata';
import { CF_PDF_BASE_PATH, CF_PDF_MAX_HTML_BYTES, CF_PDF_MAX_REQUEST_BYTES } from './constants';
import { DEFAULT_PDF_RESOURCE_ORIGINS, normalizePdfResourceOrigins } from './security';
import type { CfPdfRequest, PdfGenerateOptions, PdfPuppeteerModule } from './types';
import type { BrowserWorker } from '@cloudflare/puppeteer';

export interface CfPdfCaller {
    /** Stable id from the host's verified session, used for rate-limit scoping. */
    userId: string;
}

export interface CfPdfRouterOptions<Env> {
    resolveCaller: (request: Request, env: Env) => Promise<CfPdfCaller | null>;
    getBrowserBinding: (env: Env) => BrowserWorker | null | undefined;
    loadPuppeteer: () => Promise<PdfPuppeteerModule>;
    rateLimit: (request: Request, env: Env, caller: CfPdfCaller) => Promise<Response | null>;
    /** Static fallback origins. Dynamic origins are preferred for host-owned assets. */
    resourceOrigins?: readonly string[];
    getResourceOrigins?: (request: Request, env: Env) => readonly string[] | Promise<readonly string[]>;
    /** Host-controlled rendering policy; request input cannot widen these options. */
    renderOptions?: Omit<Partial<PdfGenerateOptions>, 'puppeteer' | 'allowedResourceOrigins'>;
    metadata?: { creator?: string; producer?: string };
}

export type CfPdfRequestHandler<Env> = (request: Request, env: Env) => Promise<Response>;

class PdfRequestError extends Error {
    constructor(
        readonly status: 400 | 413 | 415,
        readonly code: 'UNSUPPORTED_MEDIA_TYPE' | 'PDF_REQUEST_TOO_LARGE' | 'INVALID_BODY' | 'VALIDATION_ERROR',
        message: string,
    ) {
        super(message);
        this.name = 'PdfRequestError';
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonBody(request: Request): Promise<unknown> {
    const contentType = request.headers.get('content-type');
    if (!contentType || !/^application\/json(?:\s*;|$)/i.test(contentType.trim())) {
        throw new PdfRequestError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
    }

    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > CF_PDF_MAX_REQUEST_BYTES) {
        throw new PdfRequestError(413, 'PDF_REQUEST_TOO_LARGE', 'The PDF request is too large.');
    }

    let bytes: ArrayBuffer;
    try {
        bytes = await request.arrayBuffer();
    } catch {
        throw new PdfRequestError(400, 'INVALID_BODY', 'Provide a valid JSON PDF request.');
    }
    if (bytes.byteLength > CF_PDF_MAX_REQUEST_BYTES) {
        throw new PdfRequestError(413, 'PDF_REQUEST_TOO_LARGE', 'The PDF request is too large.');
    }

    try {
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        throw new PdfRequestError(400, 'INVALID_BODY', 'Provide a valid JSON PDF request.');
    }
}

function parseRequest(value: unknown): CfPdfRequest {
    if (!isRecord(value) || typeof value.html !== 'string' || value.html.trim().length === 0) {
        throw new PdfRequestError(400, 'VALIDATION_ERROR', 'The PDF request is invalid.');
    }
    if (Object.keys(value).some((key) => !['html', 'fileName', 'metadata'].includes(key))) {
        throw new PdfRequestError(400, 'VALIDATION_ERROR', 'The PDF request is invalid.');
    }
    if (new TextEncoder().encode(value.html).byteLength > CF_PDF_MAX_HTML_BYTES) {
        throw new PdfRequestError(413, 'PDF_REQUEST_TOO_LARGE', 'The PDF HTML document is too large.');
    }
    if (value.fileName !== undefined && (typeof value.fileName !== 'string' || value.fileName.length > 120)) {
        throw new PdfRequestError(400, 'VALIDATION_ERROR', 'The PDF filename is invalid.');
    }

    if (value.metadata !== undefined) {
        if (!isRecord(value.metadata)) {
            throw new PdfRequestError(400, 'VALIDATION_ERROR', 'The PDF metadata is invalid.');
        }
        if (Object.keys(value.metadata).some((key) => !['title', 'author', 'subject', 'keywords'].includes(key))) {
            throw new PdfRequestError(400, 'VALIDATION_ERROR', 'The PDF metadata is invalid.');
        }
        for (const key of ['title', 'author', 'subject', 'keywords']) {
            const field = value.metadata[key];
            if (typeof field !== 'string' || field.length > 4_096) {
                throw new PdfRequestError(400, 'VALIDATION_ERROR', 'The PDF metadata is invalid.');
            }
        }
    }

    return {
        html: value.html,
        fileName: value.fileName as string | undefined,
        metadata: value.metadata as CfPdfRequest['metadata'],
    };
}

function renderErrorResponse(error: unknown): Response {
    if (isPdfRenderError(error)) {
        if (error.code === 'PDF_INPUT_TOO_LARGE') {
            return errorResponse('The PDF HTML document is too large.', 413, { code: error.code });
        }
        if (error.code === 'PDF_OUTPUT_TOO_LARGE') {
            return errorResponse('The generated PDF is too large.', 422, { code: error.code });
        }
        if (error.code === 'INVALID_PDF_OPTION' || error.code === 'INVALID_RESOURCE_ORIGIN') {
            return errorResponse('PDF generation is not configured correctly.', 503, {
                code: 'PDF_CONFIGURATION_ERROR',
                exposure: 'public',
            });
        }
    }

    return errorResponse('PDF generation is temporarily unavailable.', 503, {
        code: 'PDF_GENERATION_FAILED',
        exposure: 'public',
    });
}

/** Build a host-agnostic request handler for `POST /api/cf-pdf`. */
export function createCfPdfRequestHandler<Env>(config: CfPdfRouterOptions<Env>): CfPdfRequestHandler<Env> {
    let puppeteerPromise: Promise<PdfPuppeteerModule> | null = null;

    return async (request, env) => {
        const caller = await config.resolveCaller(request, env);
        if (!caller?.userId) return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });

        const browserBinding = config.getBrowserBinding(env);
        if (!browserBinding) {
            return errorResponse('PDF generation is unavailable in this environment.', 503, {
                code: 'BROWSER_BINDING_UNAVAILABLE',
                exposure: 'public',
            });
        }

        const limited = await config.rateLimit(request, env, caller);
        if (limited) return limited;

        try {
            const body = parseRequest(await readJsonBody(request));
            const rawOrigins = config.getResourceOrigins
                ? await config.getResourceOrigins(request, env)
                : (config.resourceOrigins ?? DEFAULT_PDF_RESOURCE_ORIGINS);
            const allowedResourceOrigins = normalizePdfResourceOrigins(rawOrigins);
            // Memoize the module load, but NOT a failure: caching a rejected promise would pin
            // every later request in this isolate to one transient import error, leaving PDF
            // export stuck at 503 until the isolate recycles. Drop it so the next call retries.
            puppeteerPromise ??= config.loadPuppeteer().catch((error: unknown) => {
                puppeteerPromise = null;
                throw error;
            });
            const puppeteer = await puppeteerPromise;

            let pdf = await generatePdf(castHtml(body.html), browserBinding, {
                ...config.renderOptions,
                puppeteer,
                allowedResourceOrigins,
            });

            if (body.metadata) {
                const result = injectPdfInfoMetadata(pdf, body.metadata, config.metadata);
                if (result.injected) pdf = result.pdf;
            }

            return buildPdfResponse(pdf, body.fileName ?? 'document');
        } catch (error) {
            if (error instanceof PdfRequestError) {
                return errorResponse(error.message, error.status, { code: error.code });
            }
            return renderErrorResponse(error);
        }
    };
}

/** Build a router that hosts can mount at `CF_PDF_BASE_PATH`. */
export function createCfPdfRouter<Env>(config: CfPdfRouterOptions<Env>): Router<Env> {
    const router = new Router<Env>();
    const handleRequest = createCfPdfRequestHandler(config);

    router.post('/', (c) => handleRequest(c.req, c.env));
    return router;
}

// The parser already guarantees this string, but keeping the assertion local makes the
// hand-off to the generic renderer explicit and prevents future request-shape changes
// from widening its public contract accidentally.
function castHtml(value: string): string {
    return value;
}

export { CF_PDF_BASE_PATH };

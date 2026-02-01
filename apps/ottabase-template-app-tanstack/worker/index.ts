/**
 * Cloudflare Worker Entry Point
 *
 * This is the main router that delegates to modular handlers.
 * Handlers not yet extracted are handled inline below.
 */

import { RealtimeActor } from '@ottabase/cf-realtime/server';
import { queueHandler } from '../ottabase/queue';
import { handlePreflight, getCorsHeaders } from './middleware/cors';
import { initDbConnection } from './utils/db';

// Import modular handlers
import { handleHealthCheck } from './handlers/health';
import { handleDemo } from './handlers/demo';
import { handleEmailProviders, handleEmailTest } from './handlers/email';
import { handleAuthConfig, handleRegistration, handleAuthRoutes } from './handlers/auth';
import { handleCronList, handleCronCreate, handleCronTaskOperations } from './handlers/cron';
import { handleBlogStudio } from './handlers/blog';

// Re-export RealtimeActor for Durable Objects
export { RealtimeActor };

// Import the original cloudflare-worker for handlers not yet extracted
// This allows incremental migration
import originalWorker from '../cloudflare-worker';

export default {
    async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
        try {
            // ============================================================
            // CRITICAL: Register DB connection FIRST for ALL requests
            // ============================================================
            initDbConnection(env);

            const url = new URL(request.url);
            const origin = request.headers.get('Origin') || '*';

            // ============================================================
            // Middleware: CORS Preflight
            // ============================================================
            const preflightResponse = handlePreflight(request);
            if (preflightResponse) return preflightResponse;

            // ============================================================
            // Simple Handlers
            // ============================================================

            if (url.pathname === '/api/health') {
                return handleHealthCheck();
            }

            if (url.pathname === '/api/auth/config' && request.method === 'GET') {
                return handleAuthConfig(env, origin);
            }

            if (url.pathname === '/api/email/providers' && request.method === 'GET') {
                return handleEmailProviders(env);
            }

            if (url.pathname === '/api/email/test' && request.method === 'POST') {
                return handleEmailTest(request, env);
            }

            // ============================================================
            // Cron Management
            // ============================================================

            if (url.pathname === '/api/admin/cron' && request.method === 'GET') {
                return handleCronList(env);
            }

            if (url.pathname === '/api/admin/cron' && request.method === 'POST') {
                return handleCronCreate(request, env);
            }

            const cronTaskMatch = url.pathname.match(/^\/api\/admin\/cron\/(.+)$/);
            if (cronTaskMatch) {
                return handleCronTaskOperations(request, env, cronTaskMatch[1]);
            }

            // ============================================================
            // Blog Studio
            // ============================================================

            if (url.pathname.startsWith('/api/blog/studio/')) {
                const blogResponse = await handleBlogStudio(request, url, env);
                if (blogResponse) return blogResponse;
            }

            // ============================================================
            // Auth Routes
            // ============================================================

            if (url.pathname === '/api/auth/register' && request.method === 'POST') {
                return handleRegistration(request, env);
            }

            if (url.pathname.startsWith('/api/auth/')) {
                return handleAuthRoutes(request, env, origin);
            }

            // ============================================================
            // Demo Endpoints
            // ============================================================

            if (url.pathname.startsWith('/api/demo')) {
                return handleDemo(request, url);
            }

            // ============================================================
            // For all other routes, delegate to original worker
            // This allows incremental migration of handlers
            // ============================================================

            return originalWorker.fetch(request, env);
        } catch (error) {
            console.error('Worker error:', error);

            // Import errorResponse dynamically to handle errors
            const { errorResponse } = await import('@ottabase/utils/http-errors');

            if (error instanceof Error) {
                return errorResponse(error.message, 500, {
                    code: 'INTERNAL_ERROR',
                    details: error.stack,
                });
            }

            return errorResponse('An unexpected error occurred', 500, {
                code: 'UNKNOWN_ERROR',
            });
        }
    },

    // Queue consumer handler
    queue: queueHandler,
};
